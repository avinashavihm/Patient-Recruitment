# app/pipeline_v3.py
from __future__ import annotations

import io
import json
from typing import Any, Dict, Tuple, List

import pandas as pd

# from .services.criteria_extractor import extract_or_load_criteria
from .agents.eligibility_agent import evaluate_in_batches
from .services.site_ranking import compute_site_ranking
from .services.criteria_extractor import extract_or_load_criteria_text

# from .agents.eligibility_agent import evaluate_in_batches, DEBUG_CAPTURE

# ----- Required headers (per your spec) -----
# Patients: all columns are required (as agreed)
PATIENT_REQUIRED_COLS = [
    "Patient_ID",
    "Age",
    "Weight_kg",
    "T_cruzi_Diagnosis",
    "Informed_Consent_Signed",
    "Lives_in_Vector_Free_Area",
    "Chronic_Chagas_Symptoms",
    "Previous_Chagas_Treatment",
    "History_of_Azole_Hypersensitivity",
    "Concomitant_CYP3A4_Meds",
]

# Mapping: ONLY Patient_ID and Site_ID are required; rest optional
MAPPING_REQUIRED_COLS = ["Patient_ID", "Site_ID"]
MAPPING_OPTIONAL_COLS = ["Assignment_Date", "Assignment_Method", "Enrollment_Status", "Cohort", "Priority_Flag"]

# Site history: only these are required for Option A scoring
SITE_HISTORY_REQUIRED_COLS = ["siteId", "status", "screeningFailureRate"]
# Everything else is optional and ignored by the Option A formula


# ----- Helpers -----
def _read_excel_bytes(file_bytes: bytes) -> pd.DataFrame:
    """Read a single-sheet .xlsx from raw bytes and normalize headers (trim spaces)."""
    buf = io.BytesIO(file_bytes)
    df = pd.read_excel(buf, engine="openpyxl")
    # Normalize column names by stripping whitespace
    df.columns = [str(c).strip() for c in df.columns]
    return df

def _validate_headers(df: pd.DataFrame, required_cols: List[str], context: str) -> None:
    missing = [c for c in required_cols if c not in df.columns]
    if missing:
        raise ValueError(f"{context} missing required columns: {missing}. Found: {list(df.columns)}")

def _pretty_json_cell(obj: Dict[str, Any]) -> str:
    return json.dumps(obj, indent=2, ensure_ascii=False)

def _build_rosters(
    patients_df: pd.DataFrame,
    elig_df: pd.DataFrame,
    map_df: pd.DataFrame,
) -> Tuple[pd.DataFrame, pd.DataFrame]:

    base = patients_df.merge(
        map_df[["Patient_ID", "Site_ID"]],
        on="Patient_ID",
        how="left",
    )
    e = elig_df.rename(
        columns={
            "patient_id": "Patient_ID",
            "eligible": "Eligible",
            "reasons": "Reasons",
            "missing": "Missing_Data",
            "confidence": "Confidence",
        }
    )

    merged = base.merge(
        e[["Patient_ID", "Eligible", "Reasons", "Missing_Data", "Confidence"]],
        on="Patient_ID",
        how="left",
    )

    # 3) Ensure eligibility columns exist even if model failed
    for c in ["Eligible", "Reasons", "Missing_Data", "Confidence"]:
        if c not in merged.columns:
            merged[c] = None

    # 4) Order columns: all patient cols -> Site_ID -> eligibility cols
    patient_cols = [c for c in patients_df.columns]
    final_cols = patient_cols + ["Site_ID", "Eligible", "Reasons", "Missing_Data", "Confidence"]
    # Keep only unique and existing (guard)
    final_cols = [c for i, c in enumerate(final_cols) if c in merged.columns and c not in final_cols[:i]]
    all_roster = merged[final_cols].copy()

    # 5) Eligible-only view
    eligible_roster = all_roster[all_roster["Eligible"] == True].copy()

    return eligible_roster, all_roster


def _build_xlsx_bytes(
    site_ranking: pd.DataFrame,
    eligible_roster: pd.DataFrame,
    all_roster: pd.DataFrame,
    criteria_text: str,
) -> bytes:
    out = io.BytesIO()
    with pd.ExcelWriter(out, engine="openpyxl") as writer:
        site_ranking.to_excel(writer, index=False, sheet_name="Site Ranking")
        eligible_roster.to_excel(writer, index=False, sheet_name="Eligible Patients Roster")
        all_roster.to_excel(writer, index=False, sheet_name="All Patients Roster")
        pd.DataFrame({"Extracted Criteria Text": [criteria_text]}).to_excel(
            writer, index=False, sheet_name="Extracted Criteria"
        )
    return out.getvalue()


# ----- Public API -----
def run_pipeline(
    pdf_bytes: bytes,
    patients_xlsx: bytes,
    map_xlsx: bytes,
    site_hist_xlsx: bytes,
) -> Tuple[bytes, Dict[str, Any]]:
    # 1) Criteria extraction with hash cache
    cache: Dict[str, Any] = {}
    # If you want a page range, pass start_page/end_page here
    # criteria_json = extract_or_load_criteria(pdf_bytes=pdf_bytes, cache_store=cache, start_page=37, end_page=41)
    cache: Dict[str, Any] = {}
    criteria_text = extract_or_load_criteria_text(
        pdf_bytes=pdf_bytes,
        cache_store=cache,
        start_page=38,
        end_page=41,
    )

    # 2) Read Excel inputs (normalize headers)
    patients_df = _read_excel_bytes(patients_xlsx)
    map_df = _read_excel_bytes(map_xlsx)
    site_hist_df = _read_excel_bytes(site_hist_xlsx)

    # 2a) Validate headers (relaxed for mapping, minimal for site history)
    _validate_headers(patients_df, PATIENT_REQUIRED_COLS, context="Patients.xlsx")
    _validate_headers(map_df, MAPPING_REQUIRED_COLS, context="Patient↔Site mapping.xlsx")
    _validate_headers(site_hist_df, SITE_HISTORY_REQUIRED_COLS, context="Site history.xlsx")

    # 2b) Optional mapping columns: create if missing so downstream code never breaks
    for col in MAPPING_OPTIONAL_COLS:
        if col not in map_df.columns:
            map_df[col] = None

    # 2c) Sanity: Patient_ID must be unique
    if patients_df["Patient_ID"].duplicated().any():
        dups = patients_df.loc[patients_df["Patient_ID"].duplicated(), "Patient_ID"].unique().tolist()
        raise ValueError(f"Duplicate Patient_ID(s) in Patients.xlsx: {dups}")

    # 3) Evaluate eligibility in batches of 100 rows
    # elig_df, errors = evaluate_in_batches(criteria_json=criteria_json, patients_df=patients_df)
    elig_df, errors = evaluate_in_batches(criteria_text=criteria_text, patients_df=patients_df)

   
    # 4) Build rosters (keep Site_ID = NULL if mapping is missing)
    # eligible_roster, all_roster = _build_rosters(elig_df=elig_df, map_df=map_df)
    eligible_roster, all_roster = _build_rosters(patients_df=patients_df, elig_df=elig_df, map_df=map_df)
    meta = {
    "errors": errors,
    "counts": {
        "patients": int(len(patients_df)),
        "elig_rows": int(len(elig_df)),
        "all_roster_rows": int(len(all_roster)),
        "eligible_true": int((elig_df["eligible"] == True).sum()) if "eligible" in elig_df.columns else 0,
        "inconclusive": int((elig_df["eligible"] == "Inconclusive").sum()) if "eligible" in elig_df.columns else 0,
    },
    # "debug": {
    #     "prompt_head": DEBUG_CAPTURE.get("last_prompt_head", ""),
    #     "resp_head": DEBUG_CAPTURE.get("last_resp_head", ""),
    # },
}

    # 5) Compute site ranking (Option A uses only siteId, status, screeningFailureRate)
    site_ranking = compute_site_ranking(elig_df=elig_df, map_df=map_df, site_hist_df=site_hist_df)

    # 6) Build XLSX (4 sheets)
    xlsx_bytes = _build_xlsx_bytes(
        site_ranking=site_ranking,
        eligible_roster=eligible_roster,
        all_roster=all_roster,
        criteria_text=criteria_text,
    )

    # 7) Metadata summary
    meta = {
        "errors": errors,
        "counts": {
            "patients": int(len(patients_df)),
            "eligible_true": int((elig_df["eligible"] == True).sum()) if "eligible" in elig_df.columns else 0,
            "inconclusive": int((elig_df["eligible"] == "Inconclusive").sum()) if "eligible" in elig_df.columns else 0,
        },
    }
    return xlsx_bytes, meta
