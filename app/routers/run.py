# app/routers/run.py
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from pathlib import Path
from datetime import datetime

from ..config import settings
from ..utils.fileio import ensure_dirs
from ..pipeline_v3 import run_pipeline

router = APIRouter()


@router.post("/run")
async def run_pipeline_v3(
    protocol_pdf: UploadFile = File(..., description="Protocol PDF"),
    patients_xlsx: UploadFile = File(..., description="Patients.xlsx (no Site_ID)"),
    mapping_xlsx: UploadFile = File(..., description="Patient↔Site mapping.xlsx"),
    site_history_xlsx: UploadFile = File(..., description="Site history.xlsx"),
):
    """
    Version 3 pipeline endpoint:
      - Accepts 4 files (PDF + 3 xlsx)
      - Calls the v3 pipeline to evaluate eligibility in 100-row batches
      - Computes site ranking (Option A)
      - Returns a 4-sheet XLSX as a downloadable file
    """
    ensure_dirs()

    # Read all files into memory (bytes)
    try:
        pdf_bytes = await protocol_pdf.read()
        patients_bytes = await patients_xlsx.read()
        mapping_bytes = await mapping_xlsx.read()
        site_hist_bytes = await site_history_xlsx.read()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error reading uploaded files: {e}")

    # Run the v3 pipeline (criteria cache is in-memory per request)
    try:
        xlsx_bytes, meta = run_pipeline(
            pdf_bytes=pdf_bytes,
            patients_xlsx=patients_bytes,
            map_xlsx=mapping_bytes,
            site_hist_xlsx=site_hist_bytes,
        )
        print("[V3] META:", meta)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Processing failed: {e}")

    # Persist output to disk and return as file (keeps behavior similar to previous version)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    out_name = f"eligibility_results_v3_{ts}.xlsx"
    out_path = Path(settings.OUTPUT_DIR) / out_name
    try:
        out_path.write_bytes(xlsx_bytes)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to write XLSX output: {e}")

    # Optional: you can log meta here if you have a logger (errors, counts, etc.)
    # Example:
    # if meta.get("errors"):
    #     for err in meta["errors"]:
    #         logger.warning(f"Batch error: {err}")

    return FileResponse(
        path=str(out_path),
        filename=out_name,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


