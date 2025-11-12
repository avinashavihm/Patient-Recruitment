from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers.run import router as run_router
from fastapi.responses import RedirectResponse
from fastapi import FastAPI
# from .routers import run
# from .routers import debug  # NEW

def root():
    return RedirectResponse(url="/docs")

app = FastAPI(title="Patient Recruitment Agent (POC)", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True, 
    allow_methods=["*"], 
    allow_headers=["*"],
    expose_headers=["X-Metadata", "Content-Disposition"]  # Expose custom headers to frontend
)
@app.get("/", include_in_schema=False)
@app.get("/health")
def health():
    return {"status": "ok"}

app.include_router(run_router, prefix="")



# app = FastAPI()
# app.include_router(run.router, prefix="")
# app.include_router(debug.router, prefix="")

