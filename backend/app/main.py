from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.health import router as health_router
from app.api.jobs import router as jobs_router
from app.api.drs import router as drs_router
from app.api.actions import router as actions_router
from app.api.tasks import router as tasks_router
from app.api.availability import router as availability_router
from app.version import APP_VERSION


app = FastAPI(
    title="mySim Operations Dashboard",
    version=APP_VERSION,
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(health_router)
app.include_router(jobs_router)
app.include_router(drs_router,prefix="/api")
app.include_router(actions_router,prefix="/api")
app.include_router(tasks_router,prefix="/api")
app.include_router(availability_router,prefix="/api")


@app.get("/")
async def root():
    return {
        "name": "mySim Operations Dashboard",
        "version": APP_VERSION,
        "status": "online",
    }