from fastapi import APIRouter, HTTPException, Depends
from config import db
from typing import List
from models import (
    UserRole, OrderStatus, OrderResponse, PharmacistAction,
)
from services import (
    get_utc_now, get_current_user, log_audit,
)

router = APIRouter(prefix="/api")


@router.get("/pharmacist/orders", response_model=List[OrderResponse])
async def get_pharmacist_orders(status: OrderStatus = None, user: dict = Depends(get_current_user)):
    if user["role"] != UserRole.PHARMACIST.value:
        raise HTTPException(status_code=403, detail="Only pharmacists can access this")
    
    query = {}
    if status:
        query["status"] = status.value
    else:
        # Default: show pending orders
        query["status"] = {"$in": [
            OrderStatus.PENDING_PHARMACIST_REVIEW.value,
            OrderStatus.PHARMACIST_APPROVED.value
        ]}
    
    orders = await db.orders.find(query, {"_id": 0, "highest_bucket": 0}).sort("created_at", 1).to_list(1000)
    return [OrderResponse(**o) for o in orders]

@router.post("/pharmacist/orders/{order_id}/action", response_model=OrderResponse)
async def pharmacist_action(order_id: str, data: PharmacistAction, user: dict = Depends(get_current_user)):
    if user["role"] != UserRole.PHARMACIST.value:
        raise HTTPException(status_code=403, detail="Only pharmacists can perform this action")
    
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order["status"] not in [OrderStatus.PENDING_PHARMACIST_REVIEW.value, OrderStatus.PRESCRIPTION_REQUESTED.value]:
        raise HTTPException(status_code=400, detail="Order is not pending pharmacist review")
    
    update_data = {
        "pharmacist_id": user["id"],
        "pharmacist_notes": data.notes,
        "updated_at": get_utc_now()
    }
    
    if data.action == "approve":
        update_data["status"] = OrderStatus.PHARMACIST_APPROVED.value
    elif data.action == "reject":
        update_data["status"] = OrderStatus.PHARMACIST_REJECTED.value
        update_data["rejection_reason"] = data.notes
    elif data.action == "request_prescription":
        update_data["status"] = OrderStatus.PRESCRIPTION_REQUESTED.value
    else:
        raise HTTPException(status_code=400, detail="Invalid action")
    
    await db.orders.update_one({"id": order_id}, {"$set": update_data})
    await log_audit(f"pharmacist_{data.action}", "order", order_id, user["id"], user["role"], {"notes": data.notes})
    
    order = await db.orders.find_one({"id": order_id}, {"_id": 0, "highest_bucket": 0})
    return OrderResponse(**order)

@router.post("/pharmacist/orders/{order_id}/assign", response_model=OrderResponse)
async def assign_pharmacy(order_id: str, pharmacy_id: str, user: dict = Depends(get_current_user)):
    if user["role"] != UserRole.PHARMACIST.value:
        raise HTTPException(status_code=403, detail="Only pharmacists can assign pharmacies")
    
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order["status"] != OrderStatus.PHARMACIST_APPROVED.value:
        raise HTTPException(status_code=400, detail="Order must be approved before assignment")
    
    pharmacy = await db.pharmacies.find_one({"id": pharmacy_id, "is_active": True}, {"_id": 0})
    if not pharmacy:
        raise HTTPException(status_code=404, detail="Pharmacy not found")
    
    update_data = {
        "pharmacy_id": pharmacy_id,
        "pharmacy_name": pharmacy["name"],
        "pharmacy_address": pharmacy.get("address"),
        "pharmacy_latitude": pharmacy.get("latitude"),
        "pharmacy_longitude": pharmacy.get("longitude"),
        "status": OrderStatus.ASSIGNED_TO_PHARMACY.value,
        "updated_at": get_utc_now()
    }
    
    await db.orders.update_one({"id": order_id}, {"$set": update_data})
    await log_audit("pharmacy_assigned", "order", order_id, user["id"], user["role"], {"pharmacy_id": pharmacy_id})
    
    order = await db.orders.find_one({"id": order_id}, {"_id": 0, "highest_bucket": 0})
    return OrderResponse(**order)

