from fastapi import APIRouter, HTTPException, Depends
from config import db
from typing import List
from models import (
    UserRole, OrderStatus, DeliveryPartnerCreate,
    UserResponse, TokenResponse, DeliveryOrderResponse, DeliveryPartnerLogin, DeliveryAction,
    DeliveryIssueReport,
)
from services import (
    generate_id, get_utc_now, create_token,
    get_current_user, log_audit,
)

router = APIRouter(prefix="/api")


@router.post("/auth/delivery/register", response_model=UserResponse)
async def register_delivery_partner(data: DeliveryPartnerCreate, user: dict = Depends(get_current_user)):
    """Register a new delivery partner (Ops only)"""
    if user["role"] != UserRole.OPS.value:
        raise HTTPException(status_code=403, detail="Only ops can register delivery partners")
    
    # Check if phone already exists
    existing = await db.users.find_one({"phone": data.phone})
    if existing:
        raise HTTPException(status_code=400, detail="Phone number already registered")
    
    new_user = {
        "id": generate_id(),
        "phone": data.phone,
        "name": data.name,
        "role": UserRole.DELIVERY_PARTNER.value,
        "is_active": True,
        "created_at": get_utc_now()
    }
    await db.users.insert_one(new_user)
    await log_audit("delivery_partner_registered", "user", new_user["id"], user["id"], user["role"])
    
    return UserResponse(**{k: v for k, v in new_user.items() if k != "_id"})

@router.post("/auth/delivery/login", response_model=TokenResponse)
async def login_delivery_partner(data: DeliveryPartnerLogin):
    user = await db.users.find_one({"phone": data.phone, "role": UserRole.DELIVERY_PARTNER.value}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Delivery partner not registered")
    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="Account is deactivated")
    
    await log_audit("delivery_partner_login", "user", user["id"], user["id"], user["role"])
    token = create_token(user["id"], user["role"])
    return TokenResponse(access_token=token, user=UserResponse(**user))


@router.get("/delivery/orders", response_model=List[DeliveryOrderResponse])
async def get_delivery_orders(user: dict = Depends(get_current_user)):
    if user["role"] != UserRole.DELIVERY_PARTNER.value:
        raise HTTPException(status_code=403, detail="Only delivery partners can access this")
    
    # Show orders that are ready for pickup or assigned to this delivery partner
    query = {
        "$or": [
            {"status": OrderStatus.READY_FOR_PICKUP.value, "delivery_partner_id": None},
            {"delivery_partner_id": user["id"], "status": {"$in": [
                OrderStatus.READY_FOR_PICKUP.value,
                OrderStatus.PICKED_UP.value,
                OrderStatus.OUT_FOR_DELIVERY.value
            ]}}
        ]
    }
    
    orders = await db.orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    # Get pharmacy phone numbers
    pharmacy_ids = list(set(o.get("pharmacy_id") for o in orders if o.get("pharmacy_id")))
    pharmacies = {}
    if pharmacy_ids:
        pharm_list = await db.pharmacies.find({"id": {"$in": pharmacy_ids}}, {"_id": 0}).to_list(100)
        pharmacies = {p["id"]: p for p in pharm_list}
    
    result = []
    for o in orders:
        pharmacy = pharmacies.get(o.get("pharmacy_id"), {})
        result.append(DeliveryOrderResponse(
            id=o["id"],
            customer_phone=o["customer_phone"],
            customer_name=o["customer_name"],
            status=o["status"],
            delivery_address=o["delivery_address"],
            latitude=o["latitude"],
            longitude=o["longitude"],
            pharmacy_name=o.get("pharmacy_name"),
            pharmacy_address=o.get("pharmacy_address"),
            pharmacy_phone=pharmacy.get("phone"),
            pharmacy_latitude=o.get("pharmacy_latitude"),
            pharmacy_longitude=o.get("pharmacy_longitude"),
            item_count=len(o.get("items", [])),
            delivery_partner_id=o.get("delivery_partner_id"),
            created_at=o["created_at"],
            updated_at=o["updated_at"]
        ))
    
    return result

@router.get("/delivery/orders/{order_id}", response_model=DeliveryOrderResponse)
async def get_delivery_order(order_id: str, user: dict = Depends(get_current_user)):
    if user["role"] != UserRole.DELIVERY_PARTNER.value:
        raise HTTPException(status_code=403, detail="Only delivery partners can access this")
    
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Check if delivery partner can access this order
    if order.get("delivery_partner_id") and order.get("delivery_partner_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Order assigned to another delivery partner")
    
    if order["status"] not in [
        OrderStatus.READY_FOR_PICKUP.value,
        OrderStatus.PICKED_UP.value,
        OrderStatus.OUT_FOR_DELIVERY.value,
        OrderStatus.DELIVERED.value
    ]:
        raise HTTPException(status_code=403, detail="Order not available for delivery")
    
    # Get pharmacy details
    pharmacy = await db.pharmacies.find_one({"id": order.get("pharmacy_id")}, {"_id": 0}) if order.get("pharmacy_id") else {}
    
    return DeliveryOrderResponse(
        id=order["id"],
        customer_phone=order["customer_phone"],
        customer_name=order["customer_name"],
        status=order["status"],
        delivery_address=order["delivery_address"],
        latitude=order["latitude"],
        longitude=order["longitude"],
        pharmacy_name=order.get("pharmacy_name"),
        pharmacy_address=order.get("pharmacy_address"),
        pharmacy_phone=pharmacy.get("phone") if pharmacy else None,
        pharmacy_latitude=order.get("pharmacy_latitude"),
        pharmacy_longitude=order.get("pharmacy_longitude"),
        item_count=len(order.get("items", [])),
        delivery_partner_id=order.get("delivery_partner_id"),
        created_at=order["created_at"],
        updated_at=order["updated_at"]
    )

@router.post("/delivery/orders/{order_id}/accept", response_model=DeliveryOrderResponse)
async def accept_delivery(order_id: str, user: dict = Depends(get_current_user)):
    if user["role"] != UserRole.DELIVERY_PARTNER.value:
        raise HTTPException(status_code=403, detail="Only delivery partners can accept deliveries")
    
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order["status"] != OrderStatus.READY_FOR_PICKUP.value:
        raise HTTPException(status_code=400, detail="Order is not ready for pickup")
    
    if order.get("delivery_partner_id") and order.get("delivery_partner_id") != user["id"]:
        raise HTTPException(status_code=400, detail="Order already assigned to another delivery partner")
    
    update_data = {
        "delivery_partner_id": user["id"],
        "delivery_partner_name": user["name"],
        "status": OrderStatus.PICKED_UP.value,  # Change status to picked_up when delivery is accepted
        "updated_at": get_utc_now()
    }
    
    await db.orders.update_one({"id": order_id}, {"$set": update_data})
    await log_audit("delivery_accepted", "order", order_id, user["id"], user["role"])
    
    # Return updated order
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    pharmacy = await db.pharmacies.find_one({"id": order.get("pharmacy_id")}, {"_id": 0}) if order.get("pharmacy_id") else {}
    
    return DeliveryOrderResponse(
        id=order["id"],
        customer_phone=order["customer_phone"],
        customer_name=order["customer_name"],
        status=order["status"],
        delivery_address=order["delivery_address"],
        latitude=order["latitude"],
        longitude=order["longitude"],
        pharmacy_name=order.get("pharmacy_name"),
        pharmacy_address=order.get("pharmacy_address"),
        pharmacy_phone=pharmacy.get("phone") if pharmacy else None,
        pharmacy_latitude=order.get("pharmacy_latitude"),
        pharmacy_longitude=order.get("pharmacy_longitude"),
        item_count=len(order.get("items", [])),
        delivery_partner_id=order.get("delivery_partner_id"),
        created_at=order["created_at"],
        updated_at=order["updated_at"]
    )

@router.post("/delivery/orders/{order_id}/action", response_model=DeliveryOrderResponse)
async def delivery_action(order_id: str, data: DeliveryAction, user: dict = Depends(get_current_user)):
    if user["role"] != UserRole.DELIVERY_PARTNER.value:
        raise HTTPException(status_code=403, detail="Only delivery partners can perform this action")
    
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order.get("delivery_partner_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Order not assigned to you")
    
    update_data = {"updated_at": get_utc_now()}
    
    if data.action == "pickup":
        if order["status"] != OrderStatus.READY_FOR_PICKUP.value:
            raise HTTPException(status_code=400, detail="Order must be ready for pickup")
        update_data["status"] = OrderStatus.PICKED_UP.value
    elif data.action == "out_for_delivery":
        if order["status"] != OrderStatus.PICKED_UP.value:
            raise HTTPException(status_code=400, detail="Order must be picked up first")
        update_data["status"] = OrderStatus.OUT_FOR_DELIVERY.value
    elif data.action == "delivered":
        if order["status"] != OrderStatus.OUT_FOR_DELIVERY.value:
            raise HTTPException(status_code=400, detail="Order must be out for delivery")
        update_data["status"] = OrderStatus.DELIVERED.value
    else:
        raise HTTPException(status_code=400, detail="Invalid action. Use: pickup, out_for_delivery, delivered")
    
    await db.orders.update_one({"id": order_id}, {"$set": update_data})
    await log_audit(f"delivery_{data.action}", "order", order_id, user["id"], user["role"])
    
    # Return updated order
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    pharmacy = await db.pharmacies.find_one({"id": order.get("pharmacy_id")}, {"_id": 0}) if order.get("pharmacy_id") else {}
    
    return DeliveryOrderResponse(
        id=order["id"],
        customer_phone=order["customer_phone"],
        customer_name=order["customer_name"],
        status=order["status"],
        delivery_address=order["delivery_address"],
        latitude=order["latitude"],
        longitude=order["longitude"],
        pharmacy_name=order.get("pharmacy_name"),
        pharmacy_address=order.get("pharmacy_address"),
        pharmacy_phone=pharmacy.get("phone") if pharmacy else None,
        pharmacy_latitude=order.get("pharmacy_latitude"),
        pharmacy_longitude=order.get("pharmacy_longitude"),
        item_count=len(order.get("items", [])),
        delivery_partner_id=order.get("delivery_partner_id"),
        created_at=order["created_at"],
        updated_at=order["updated_at"]
    )

@router.post("/delivery/orders/{order_id}/report-issue")
async def report_delivery_issue(order_id: str, data: DeliveryIssueReport, user: dict = Depends(get_current_user)):
    if user["role"] != UserRole.DELIVERY_PARTNER.value:
        raise HTTPException(status_code=403, detail="Only delivery partners can report issues")
    
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order.get("delivery_partner_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Order not assigned to you")
    
    # Log the issue
    issue = {
        "id": generate_id(),
        "order_id": order_id,
        "delivery_partner_id": user["id"],
        "issue_type": data.issue_type,
        "description": data.description,
        "created_at": get_utc_now()
    }
    await db.delivery_issues.insert_one(issue)
    await log_audit("delivery_issue_reported", "order", order_id, user["id"], user["role"], {
        "issue_type": data.issue_type,
        "description": data.description
    })
    
    return {"message": "Issue reported successfully", "issue_id": issue["id"]}

