from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from config import db
import io
from typing import List
from models import (
    UserRole, MedicineBucket, ProductType, OrderStatus, OrderItem, OrderCreate,
    OrderResponse,
)
from services import (
    generate_id, get_utc_now, get_current_user, log_audit, CATEGORY_DISCOUNTS,
    CART_DISCOUNT_TIERS, calculate_discounts, build_invoice_pdf,
)
from services import notify_order_status

router = APIRouter(prefix="/api")


@router.get("/discount-config")
async def get_discount_config():
    """Return discount configuration for frontend display"""
    return {
        "category_discounts": CATEGORY_DISCOUNTS,
        "cart_discount_tiers": [{"threshold": t, "rate": r} for t, r in CART_DISCOUNT_TIERS]
    }

@router.post("/orders", response_model=OrderResponse)
async def create_order(data: OrderCreate, user: dict = Depends(get_current_user)):
    if user["role"] != UserRole.CUSTOMER.value:
        raise HTTPException(status_code=403, detail="Only customers can create orders")
    
    # Validate items and determine highest bucket (only for medicines)
    items = []
    total_amount = 0.0  # Calculate from MEDILO price master
    highest_bucket = None  # None means no medicines requiring review
    bucket_priority = {MedicineBucket.OTC: 0, MedicineBucket.SCHEDULE_H: 1, MedicineBucket.SCHEDULE_H1: 2}
    has_medicines_requiring_review = False
    items_for_discount = []
    
    for item in data.items:
        medicine = await db.medicines.find_one({"id": item.medicine_id, "is_active": True}, {"_id": 0})
        if not medicine:
            raise HTTPException(status_code=400, detail=f"Product {item.medicine_id} not found")
        
        # Get MEDILO-controlled price from medicine master
        unit_price = medicine.get("price", 0)
        product_type = medicine.get("product_type", ProductType.MEDICINE.value)
        
        order_item = OrderItem(
            medicine_id=item.medicine_id,
            medicine_name=medicine["name"],
            medicine_bucket=medicine.get("bucket"),  # May be None for non-medicines
            product_type=product_type,
            medicine_strength=medicine.get("strength", ""),
            medicine_pack_size=medicine.get("pack_size", ""),
            quantity=item.quantity,
            unit_price=unit_price
        )
        items.append(order_item.model_dump())
        total_amount += unit_price * item.quantity
        items_for_discount.append({"unit_price": unit_price, "quantity": item.quantity, "product_type": product_type})
        
        # Only check bucket for Medicine type products
        if product_type == ProductType.MEDICINE.value and medicine.get("bucket"):
            med_bucket = MedicineBucket(medicine["bucket"])
            if highest_bucket is None or bucket_priority[med_bucket] > bucket_priority[highest_bucket]:
                highest_bucket = med_bucket
            if med_bucket in [MedicineBucket.SCHEDULE_H, MedicineBucket.SCHEDULE_H1]:
                has_medicines_requiring_review = True
    
    # Calculate discounts
    discount_info = calculate_discounts(items_for_discount)
    
    # Validate prescription requirements (only for medicines)
    if highest_bucket == MedicineBucket.SCHEDULE_H1 and not data.prescription_image:
        raise HTTPException(status_code=400, detail="Prescription upload is mandatory for Schedule H1 medicines")
    
    if highest_bucket == MedicineBucket.SCHEDULE_H and not data.prescription_image and not data.schedule_h_declaration:
        raise HTTPException(status_code=400, detail="Either prescription upload or declaration is required for Schedule H medicines")
    
    # Determine initial status based on whether order has medicines requiring pharmacist review
    if has_medicines_requiring_review:
        initial_status = OrderStatus.PENDING_PHARMACIST_REVIEW
    else:
        initial_status = OrderStatus.PHARMACIST_APPROVED  # No pharmacist review needed
    
    order = {
        "id": generate_id(),
        "customer_id": user["id"],
        "customer_phone": user["phone"],
        "customer_name": user["name"],
        "items": items,
        "status": initial_status.value,
        "prescription_image": data.prescription_image,
        "schedule_h_declaration": data.schedule_h_declaration,
        "delivery_address": data.delivery_address,
        "latitude": data.latitude,
        "longitude": data.longitude,
        "highest_bucket": highest_bucket.value if highest_bucket else None,
        "pharmacy_id": None,
        "pharmacy_name": None,
        "pharmacy_address": None,
        "pharmacy_latitude": None,
        "pharmacy_longitude": None,
        "pharmacist_id": None,
        "pharmacist_notes": None,
        "delivery_partner_id": None,
        "delivery_partner_name": None,
        "rejection_reason": None,
        "total_amount": discount_info["total_amount"],
        "subtotal": discount_info["subtotal"],
        "category_discount": discount_info["category_discount"],
        "cart_discount": discount_info["cart_discount"],
        "total_savings": discount_info["total_savings"],
        "invoice_generated": False,
        "created_at": get_utc_now(),
        "updated_at": get_utc_now()
    }
    
    await db.orders.insert_one(order)
    await log_audit("order_created", "order", order["id"], user["id"], user["role"], {"status": initial_status.value, "total_amount": discount_info["total_amount"], "total_savings": discount_info["total_savings"]})

    await notify_order_status(user["id"], order["id"], initial_status.value)

    return OrderResponse(**{k: v for k, v in order.items() if k not in ["_id", "highest_bucket"]})

@router.get("/orders", response_model=List[OrderResponse])
async def get_orders(user: dict = Depends(get_current_user)):
    if user["role"] == UserRole.CUSTOMER.value:
        query = {"customer_id": user["id"]}
    elif user["role"] == UserRole.PHARMACY_STAFF.value:
        query = {"pharmacy_id": user.get("pharmacy_id")}
    else:
        query = {}
    
    orders = await db.orders.find(query, {"_id": 0, "highest_bucket": 0}).sort("created_at", -1).to_list(1000)
    return [OrderResponse(**o) for o in orders]

@router.get("/orders/{order_id}", response_model=OrderResponse)
async def get_order(order_id: str, user: dict = Depends(get_current_user)):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0, "highest_bucket": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Check access
    if user["role"] == UserRole.CUSTOMER.value and order["customer_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    if user["role"] == UserRole.PHARMACY_STAFF.value and order.get("pharmacy_id") != user.get("pharmacy_id"):
        raise HTTPException(status_code=403, detail="Access denied")
    
    return OrderResponse(**order)


@router.post("/orders/{order_id}/upload-prescription", response_model=OrderResponse)
async def upload_prescription(order_id: str, prescription_image: str, user: dict = Depends(get_current_user)):
    if user["role"] != UserRole.CUSTOMER.value:
        raise HTTPException(status_code=403, detail="Only customers can upload prescriptions")
    
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order["customer_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if order["status"] != OrderStatus.PRESCRIPTION_REQUESTED.value:
        raise HTTPException(status_code=400, detail="Prescription upload not required")
    
    update_data = {
        "prescription_image": prescription_image,
        "status": OrderStatus.PENDING_PHARMACIST_REVIEW.value,
        "updated_at": get_utc_now()
    }
    
    await db.orders.update_one({"id": order_id}, {"$set": update_data})
    await log_audit("prescription_uploaded", "order", order_id, user["id"], user["role"])

    await notify_order_status(order["customer_id"], order_id, OrderStatus.PENDING_PHARMACIST_REVIEW.value)

    order = await db.orders.find_one({"id": order_id}, {"_id": 0, "highest_bucket": 0})
    return OrderResponse(**order)

@router.post("/orders/{order_id}/cancel", response_model=OrderResponse)
async def cancel_order(order_id: str, user: dict = Depends(get_current_user)):
    if user["role"] != UserRole.CUSTOMER.value:
        raise HTTPException(status_code=403, detail="Only customers can cancel orders")
    
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order["customer_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Can only cancel before delivery starts
    non_cancellable = [OrderStatus.OUT_FOR_DELIVERY.value, OrderStatus.DELIVERED.value]
    if order["status"] in non_cancellable:
        raise HTTPException(status_code=400, detail="Order cannot be cancelled at this stage")
    
    update_data = {
        "status": OrderStatus.CANCELLED.value,
        "updated_at": get_utc_now()
    }
    
    await db.orders.update_one({"id": order_id}, {"$set": update_data})
    await log_audit("order_cancelled", "order", order_id, user["id"], user["role"])

    await notify_order_status(order["customer_id"], order_id, OrderStatus.CANCELLED.value)

    order = await db.orders.find_one({"id": order_id}, {"_id": 0, "highest_bucket": 0})
    return OrderResponse(**order)


@router.get("/orders/{order_id}/invoice")
async def get_invoice(order_id: str, user: dict = Depends(get_current_user)):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Check access
    if user["role"] == UserRole.CUSTOMER.value and order["customer_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")

    if not order.get("invoice_generated"):
        raise HTTPException(status_code=400, detail="Invoice not yet generated")

    pharmacy = await db.pharmacies.find_one({"id": order.get("pharmacy_id")}, {"_id": 0})
    pdf_bytes = build_invoice_pdf(order, pharmacy)

    filename = f"MEDILO_Invoice_{order_id[:8].upper()}.pdf"
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

