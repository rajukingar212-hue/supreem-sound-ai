import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import Base, engine, SessionLocal
from app.core.security import get_password_hash
from app.models import User
from app.api import auth, batches, jobs, settings as settings_api, stats, downloads, events, credentials

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("supreem.main")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure tables exist and seed user safely
    logger.info("Initializing database schemas...")
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.email == "creator@supreemsound.ai").first()
        is_production = settings.ENVIRONMENT.lower() == "production"

        if not admin:
            if is_production:
                if settings.INITIAL_ADMIN_PASSWORD:
                    admin = User(
                        email="creator@supreemsound.ai",
                        hashed_password=get_password_hash(settings.INITIAL_ADMIN_PASSWORD),
                        full_name="Lead Sound Designer",
                        is_superuser=True
                    )
                    db.add(admin)
                    db.commit()
                    logger.info("PRODUCTION: Created admin user with configured INITIAL_ADMIN_PASSWORD.")
                else:
                    logger.warning(
                        "PRODUCTION SECURITY: Default user creator@supreemsound.ai NOT created because predictable passwords are prohibited in production. "
                        "Provide INITIAL_ADMIN_PASSWORD or register via /api/auth/register."
                    )
            else:
                admin = User(
                    email="creator@supreemsound.ai",
                    hashed_password=get_password_hash("password123"),
                    full_name="Lead Sound Designer",
                    is_superuser=True
                )
                db.add(admin)
                db.commit()
                logger.info("DEVELOPMENT MODE: Seeded local dev user creator@supreemsound.ai (password123). Set ENVIRONMENT=production for live deployments.")
    finally:
        db.close()

    yield
    logger.info("Supreem Sound AI backend shutting down.")

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Automated AI-Powered Video Sound Design & Batch Processing Platform",
    lifespan=lifespan
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Routers
api_v1_prefix = settings.API_V1_PREFIX
app.include_router(auth.router, prefix=api_v1_prefix)
app.include_router(batches.router, prefix=api_v1_prefix)
app.include_router(jobs.router, prefix=api_v1_prefix)
app.include_router(settings_api.router, prefix=api_v1_prefix)
app.include_router(credentials.router, prefix=api_v1_prefix)
app.include_router(stats.router, prefix=api_v1_prefix)
app.include_router(downloads.router, prefix=api_v1_prefix)
app.include_router(events.router, prefix=api_v1_prefix)

@app.get("/health")
def healthcheck():
    api_readiness = settings.validate_api_readiness()
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
        "ffmpeg": "available",
        "target_true_peak": f"{settings.TARGET_TRUE_PEAK_DBTP} dBTP",
        "max_true_peak": f"{settings.MAX_TRUE_PEAK_DBTP} dBTP",
        "sample_rate": f"{settings.SAMPLE_RATE} Hz",
        "channels": "Stereo",
        "bit_depth": f"{settings.AUDIO_BIT_DEPTH}-bit PCM",
        "api_providers": {
            "gemini": {
                "ready": api_readiness["gemini"]["configured"],
                "model": settings.GEMINI_MODEL
            },
            "elevenlabs": {
                "ready": api_readiness["elevenlabs"]["configured"],
                "model_id": settings.ELEVENLABS_MODEL_ID
            }
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
