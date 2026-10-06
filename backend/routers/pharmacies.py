from fastapi import APIRouter, HTTPException, Depends
from config import db
from typing import List
from models import (
    UserRole, PharmacyCreate, PharmacyResponse,
)
from services import (
    generate_id, get_utc_now, get_current_user, log_audit,
)

router = APIRouter(prefix="/api")


@router.post("/pharmacies", response_model=PharmacyResponse)
async def create_pharmacy(data: PharmacyCreate, user: dict = Depends(get_current_user)):
    if user["role"] not in [UserRole.OPS.value]:
        raise HTTPException(status_code=403, detail="Only ops can add pharmacies")
    
    pharmacy = {
        "id": generate_id(),
        **data.model_dump(),
        "is_active": True,
        "created_at": get_utc_now()
    }
    await db.pharmacies.insert_one(pharmacy)
    await log_audit("pharmacy_created", "pharmacy", pharmacy["id"], user["id"], user["role"], {"name": data.name})
    return PharmacyResponse(**{k: v for k, v in pharmacy.items() if k != "_id"})

@router.get("/pharmacies", response_model=List[PharmacyResponse])
async def get_pharmacies(user: dict = Depends(get_current_user)):
    pharmacies = await db.pharmacies.find({"is_active": True}, {"_id": 0}).to_list(100)
    return [PharmacyResponse(**p) for p in pharmacies]

@router.get("/pharmacies/{pharmacy_id}", response_model=PharmacyResponse)
async def get_pharmacy(pharmacy_id: str):
    pharmacy = await db.pharmacies.find_one({"id": pharmacy_id}, {"_id": 0})
    if not pharmacy:
        raise HTTPException(status_code=404, detail="Pharmacy not found")
    return PharmacyResponse(**pharmacy)

@router.put("/pharmacies/{pharmacy_id}", response_model=PharmacyResponse)
async def update_pharmacy(pharmacy_id: str, data: PharmacyCreate, user: dict = Depends(get_current_user)):
    if user["role"] not in [UserRole.OPS.value]:
        raise HTTPException(status_code=403, detail="Only ops can update pharmacies")
    
    result = await db.pharmacies.update_one(
        {"id": pharmacy_id},
        {"$set": data.model_dump()}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Pharmacy not found")
    
    await log_audit("pharmacy_updated", "pharmacy", pharmacy_id, user["id"], user["role"])
    pharmacy = await db.pharmacies.find_one({"id": pharmacy_id}, {"_id": 0})
    return PharmacyResponse(**pharmacy)
