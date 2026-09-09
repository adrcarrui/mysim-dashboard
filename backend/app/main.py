import asyncio
import logging
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.actions import router as actions_router
from app.api.availability import router as availability_router
from app.api.devices import router as devices_router
from app.api.drs import router as drs_router
from app.api.health import router as health_router
from app.api.jobs import router as jobs_router
from app.api.recommendations import (
    router as recommendations_router,
)
from app.api.tasks import router as tasks_router
from app.api.task_frequencies import router as task_frequencies_router
from app.api.maintenance_tasks import router as maintenance_tasks_router
from app.services.reference_data_sync_service import run_reference_data_synchronization
from app.database import close_database_connection
from app.services.devices_service import devices_service
from app.services.devices_sync_service import (
    run_devices_synchronization,
)
from app.version import APP_VERSION


logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        loaded = await devices_service.load_cache()

        logger.info(
            "Devices loaded from PostgreSQL: %s",
            loaded,
        )

    except Exception:
        logger.exception(
            "Could not preload devices "
            "from PostgreSQL"
        )

    synchronization_task = asyncio.create_task(
        run_devices_synchronization()
    )

    reference_data_task = asyncio.create_task(
        run_reference_data_synchronization()
    )

    yield

    synchronization_task.cancel()
    reference_data_task.cancel()

    with suppress(asyncio.CancelledError):
        await synchronization_task

    with suppress(asyncio.CancelledError):
        await reference_data_task

    await close_database_connection()


app = FastAPI(
    title="mySim Operations Dashboard",
    version=APP_VERSION,
    lifespan=lifespan,
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

app.include_router(
    drs_router,
    prefix="/api",
)

app.include_router(
    actions_router,
    prefix="/api",
)

app.include_router(
    tasks_router,
    prefix="/api",
)

app.include_router(
    availability_router,
    prefix="/api",
)

app.include_router(
    recommendations_router,
    prefix="/api",
)

app.include_router(
    devices_router,
    prefix="/api",
)

app.include_router(
    task_frequencies_router,
    prefix="/api",
)

app.include_router(
    maintenance_tasks_router,
    prefix="/api",
)

@app.get("/")
async def root():
    return {
        "name": "mySim Operations Dashboard",
        "version": APP_VERSION,
        "status": "online",
    }