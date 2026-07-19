from fastapi import FastAPI, APIRouter
from starlette.middleware.cors import CORSMiddleware
import os

from config import client, db, logger, init_storage
from services import get_utc_now
from routers import (
    auth, medicines, customer, pharmacies, orders,
    pharmacist, pharmacy, ops, delivery,
)

app = FastAPI(title="MEDILO Healthcare API")

for module in (auth, medicines, customer, pharmacies, orders, pharmacist, pharmacy, ops, delivery):
    app.include_router(module.router)

# Health check
health_router = APIRouter(prefix="/api")


@health_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": get_utc_now()}


app.include_router(health_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()


@app.on_event("startup")
async def migrate_categories():
    """Migrate old category values and init storage"""
    result = await db.medicines.update_many(
        {"product_type": "Beauty"},
        {"$set": {"product_type": "Beauty & Personal Care"}}
    )
    if result.modified_count > 0:
        logger.info(f"Migrated {result.modified_count} products from 'Beauty' to 'Beauty & Personal Care'")

    try:
        init_storage()
        logger.info("Object storage initialized successfully")
    except Exception as e:
        logger.error(f"Object storage init failed: {e}")
