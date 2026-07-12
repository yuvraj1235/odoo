"""FastAPI application entry point."""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine, Base
from app.seed import seed_database
from app.database import AsyncSessionLocal

from app.routers import (
    auth, users, departments, categories, assets,
    allocations, bookings, maintenance, audits, analytics, logs, ai
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables on startup
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        from sqlalchemy import text
        try:
            await conn.execute(text("ALTER TABLE maintenance_requests ADD COLUMN sla_status VARCHAR(20) DEFAULT 'normal'"))
        except Exception:
            pass

    # Seed initial data
    async with AsyncSessionLocal() as session:
        await seed_database(session)

    yield

    await engine.dispose()


app = FastAPI(
    title="AssetFlow API",
    description="Enterprise Asset & Resource Management System",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PREFIX = "/api/v1"
app.include_router(auth.router, prefix=PREFIX)
app.include_router(users.router, prefix=PREFIX)
app.include_router(departments.router, prefix=PREFIX)
app.include_router(categories.router, prefix=PREFIX)
app.include_router(assets.router, prefix=PREFIX)
app.include_router(allocations.router, prefix=PREFIX)
app.include_router(bookings.router, prefix=PREFIX)
app.include_router(maintenance.router, prefix=PREFIX)
app.include_router(audits.router, prefix=PREFIX)
app.include_router(analytics.router, prefix=PREFIX)
app.include_router(logs.router, prefix=PREFIX)
app.include_router(ai.router, prefix=PREFIX)


@app.get("/")
async def root():
    return {"message": "AssetFlow API is running", "docs": "/docs"}
