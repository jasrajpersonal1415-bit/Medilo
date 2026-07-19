from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from config import db, put_object, get_object, APP_NAME
from models import *
from services import *

router = APIRouter(prefix="/api")


@router.get("/pharmacy/orders", response_model=List[OrderResponse])
async def get_pharmacy_orders(user: dict = Depends(get_current_user)):
    if user["role"] != UserRole.PHARMACY_STAFF.value:
        raise HTTPException(status_code=403, detail="Only pharmacy staff can access this")
    
    if not user.get("pharmacy_id"):
        raise HTTPException(status_code=400, detail="User not linked to a pharmacy")
    
    orders = await db.orders.find(
        {"pharmacy_id": user["pharmacy_id"]},
        {"_id": 0, "highest_bucket": 0}
    ).sort("created_at", -1).to_list(1000)
    return [OrderResponse(**o) for o in orders]

@router.post("/pharmacy/orders/{order_id}/action", response_model=OrderResponse)
async def pharmacy_action(order_id: str, data: PharmacyAction, user: dict = Depends(get_current_user)):
    if user["role"] != UserRole.PHARMACY_STAFF.value:
        raise HTTPException(status_code=403, detail="Only pharmacy staff can perform this action")
    
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order.get("pharmacy_id") != user.get("pharmacy_id"):
        raise HTTPException(status_code=403, detail="Order not assigned to your pharmacy")
    
    update_data = {"updated_at": get_utc_now()}
    
    if data.action == "accept":
        if order["status"] != OrderStatus.ASSIGNED_TO_PHARMACY.value:
            raise HTTPException(status_code=400, detail="Invalid order status for this action")
        update_data["status"] = OrderStatus.PHARMACY_ACCEPTED.value
    elif data.action == "reject":
        if order["status"] != OrderStatus.ASSIGNED_TO_PHARMACY.value:
            raise HTTPException(status_code=400, detail="Invalid order status for this action")
        update_data["status"] = OrderStatus.PHARMACY_REJECTED.value
        update_data["rejection_reason"] = data.rejection_reason
    elif data.action == "mark_preparing":
        if order["status"] != OrderStatus.INVENTORY_CONFIRMED.value:
            raise HTTPException(status_code=400, detail="Inventory must be confirmed first")
        update_data["status"] = OrderStatus.PREPARING.value
    elif data.action == "mark_ready":
        if order["status"] != OrderStatus.PREPARING.value:
            raise HTTPException(status_code=400, detail="Order must be preparing first")
        update_data["status"] = OrderStatus.READY_FOR_PICKUP.value
    else:
        raise HTTPException(status_code=400, detail="Invalid action")
    
    await db.orders.update_one({"id": order_id}, {"$set": update_data})
    await log_audit(f"pharmacy_{data.action}", "order", order_id, user["id"], user["role"])
    
    order = await db.orders.find_one({"id": order_id}, {"_id": 0, "highest_bucket": 0})
    return OrderResponse(**order)

@router.post("/pharmacy/orders/{order_id}/confirm-inventory", response_model=OrderResponse)
async def confirm_inventory(order_id: str, data: InventoryConfirmation, user: dict = Depends(get_current_user)):
    if user["role"] != UserRole.PHARMACY_STAFF.value:
        raise HTTPException(status_code=403, detail="Only pharmacy staff can confirm inventory")
    
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order.get("pharmacy_id") != user.get("pharmacy_id"):
        raise HTTPException(status_code=403, detail="Order not assigned to your pharmacy")
    
    if order["status"] != OrderStatus.PHARMACY_ACCEPTED.value:
        raise HTTPException(status_code=400, detail="Order must be accepted before inventory confirmation")
    
    # Update items with inventory details (batch & expiry only - NO price input)
    # Price is already set from MEDILO master during order creation
    updated_items = []
    
    for order_item in order["items"]:
        inv_item = next((i for i in data.items if i.get("medicine_id") == order_item["medicine_id"]), None)
        if not inv_item:
            raise HTTPException(status_code=400, detail=f"Missing inventory for {order_item['medicine_name']}")
        
        # Only update batch and expiry - price comes from MEDILO master (already in order_item)
        updated_item = {
            **order_item,
            "batch_number": inv_item.get("batch_number"),
            "expiry_date": inv_item.get("expiry_date")
        }
        updated_items.append(updated_item)
    
    update_data = {
        "items": updated_items,
        "status": OrderStatus.INVENTORY_CONFIRMED.value,
        "invoice_generated": True,
        "updated_at": get_utc_now()
    }
    
    await db.orders.update_one({"id": order_id}, {"$set": update_data})
    await log_audit("inventory_confirmed", "order", order_id, user["id"], user["role"], {"total_amount": order["total_amount"]})
    
    order = await db.orders.find_one({"id": order_id}, {"_id": 0, "highest_bucket": 0})
    return OrderResponse(**order)

