# app/routers/run.py
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from pathlib import Path
from datetime import datetime
import json

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
    return_json: bool = False,  # Optional query parameter to return JSON instead of file
):
    """
    Version 3 pipeline endpoint:
      - Accepts 4 files (PDF + 3 xlsx)
      - Calls the v3 pipeline to evaluate eligibility in 100-row batches
      - Computes site ranking (Option A)
      - Returns a 4-sheet XLSX as a downloadable file or JSON with metadata
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

    # Persist output to disk
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    out_name = f"eligibility_results_v3_{ts}.xlsx"
    out_path = Path(settings.OUTPUT_DIR) / out_name
    try:
        out_path.write_bytes(xlsx_bytes)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to write XLSX output: {e}")

    # If JSON response requested, return metadata with file as base64
    if return_json:
        import base64
        file_base64 = base64.b64encode(xlsx_bytes).decode('utf-8')
        return JSONResponse({
            "filename": out_name,
            "file_data": file_base64,
            "metadata": meta,
        })

    # Return file with metadata in headers
    response = FileResponse(
        path=str(out_path),
        filename=out_name,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
    # Add metadata to headers (JSON-encoded)
    response.headers["X-Metadata"] = json.dumps(meta)
    return response


