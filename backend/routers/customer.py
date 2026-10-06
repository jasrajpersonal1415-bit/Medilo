from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Body
from config import db, put_object, APP_NAME, VAPID_PUBLIC_KEY
import uuid
from enum import Enum
from typing import Optional
from pydantic import BaseModel
from models import (
    UserRole,
)
from services import (
    generate_id, get_utc_now, get_current_user,
)

router = APIRouter(prefix="/api")


# ==================== Address Book Models ====================
class AddressLabel(str, Enum):
    HOME = "Home"
    WORK = "Work"
    HOSTEL = "Hostel"
    OTHER = "Other"

class AddressCreate(BaseModel):
    label: AddressLabel = AddressLabel.HOME
    full_name: str
    mobile: str
    house_flat: str
    street: str
    landmark: Optional[str] = ""
    city: str
    state: str
    pincode: str
    is_default: bool = False

class AddressResponse(BaseModel):
    id: str
    customer_id: str
    label: str
    full_name: str
    mobile: str
    house_flat: str
    street: str
    landmark: Optional[str] = ""
    city: str
    state: str
    pincode: str
    is_default: bool = False
    created_at: str

class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None

# ==================== Customer Profile & Address & Wishlist Routes ====================
@router.get("/customer/profile")
async def get_customer_profile(user: dict = Depends(get_current_user)):
    if user["role"] != UserRole.CUSTOMER.value:
        raise HTTPException(status_code=403, detail="Customer only")
    db_user = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    order_count = await db.orders.count_documents({"customer_id": user["id"]})
    total_spend_pipeline = [
        {"$match": {"customer_id": user["id"], "status": "delivered"}},
        {"$group": {"_id": None, "total": {"$sum": "$total_amount"}}}
    ]
    spend_result = await db.orders.aggregate(total_spend_pipeline).to_list(1)
    total_spend = spend_result[0]["total"] if spend_result else 0
    address_count = await db.addresses.count_documents({"customer_id": user["id"]})
    wishlist_count = await db.wishlist.count_documents({"customer_id": user["id"]})
    
    return {
        "id": db_user["id"],
        "name": db_user.get("name", ""),
        "phone": db_user.get("phone", ""),
        "email": db_user.get("email", ""),
        "created_at": db_user.get("created_at", ""),
        "total_orders": order_count,
        "total_spend": round(total_spend, 2),
        "address_count": address_count,
        "wishlist_count": wishlist_count,
    }

@router.put("/customer/profile")
async def update_customer_profile(data: ProfileUpdate, user: dict = Depends(get_current_user)):
    if user["role"] != UserRole.CUSTOMER.value:
        raise HTTPException(status_code=403, detail="Customer only")
    update_fields = {}
    if data.name is not None:
        update_fields["name"] = data.name
    if data.email is not None:
        update_fields["email"] = data.email
    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields to update")
    await db.users.update_one({"id": user["id"]}, {"$set": update_fields})
    return {"message": "Profile updated"}

# Address Book
@router.get("/customer/addresses")
async def list_addresses(user: dict = Depends(get_current_user)):
    if user["role"] != UserRole.CUSTOMER.value:
        raise HTTPException(status_code=403, detail="Customer only")
    addresses = await db.addresses.find({"customer_id": user["id"]}, {"_id": 0}).sort("is_default", -1).to_list(50)
    return addresses

@router.post("/customer/addresses")
async def create_address(data: AddressCreate, user: dict = Depends(get_current_user)):
    if user["role"] != UserRole.CUSTOMER.value:
        raise HTTPException(status_code=403, detail="Customer only")
    
    if data.is_default:
        await db.addresses.update_many({"customer_id": user["id"]}, {"$set": {"is_default": False}})
    
    # If first address, make it default
    count = await db.addresses.count_documents({"customer_id": user["id"]})
    if count == 0:
        data.is_default = True
    
    address = {
        "id": generate_id(),
        "customer_id": user["id"],
        **data.model_dump(),
        "label": data.label.value,
        "created_at": get_utc_now()
    }
    await db.addresses.insert_one(address)
    address.pop("_id", None)
    return address

@router.put("/customer/addresses/{address_id}")
async def update_address(address_id: str, data: AddressCreate, user: dict = Depends(get_current_user)):
    if user["role"] != UserRole.CUSTOMER.value:
        raise HTTPException(status_code=403, detail="Customer only")
    existing = await db.addresses.find_one({"id": address_id, "customer_id": user["id"]})
    if not existing:
        raise HTTPException(status_code=404, detail="Address not found")
    
    if data.is_default:
        await db.addresses.update_many({"customer_id": user["id"]}, {"$set": {"is_default": False}})
    
    update_data = data.model_dump()
    update_data["label"] = data.label.value
    await db.addresses.update_one({"id": address_id}, {"$set": update_data})
    return {"message": "Address updated"}

@router.delete("/customer/addresses/{address_id}")
async def delete_address(address_id: str, user: dict = Depends(get_current_user)):
    if user["role"] != UserRole.CUSTOMER.value:
        raise HTTPException(status_code=403, detail="Customer only")
    result = await db.addresses.delete_one({"id": address_id, "customer_id": user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Address not found")
    return {"message": "Address deleted"}

@router.post("/customer/addresses/{address_id}/set-default")
async def set_default_address(address_id: str, user: dict = Depends(get_current_user)):
    if user["role"] != UserRole.CUSTOMER.value:
        raise HTTPException(status_code=403, detail="Customer only")
    existing = await db.addresses.find_one({"id": address_id, "customer_id": user["id"]})
    if not existing:
        raise HTTPException(status_code=404, detail="Address not found")
    await db.addresses.update_many({"customer_id": user["id"]}, {"$set": {"is_default": False}})
    await db.addresses.update_one({"id": address_id}, {"$set": {"is_default": True}})
    return {"message": "Default address updated"}

# Wishlist
@router.get("/customer/wishlist")
async def list_wishlist(user: dict = Depends(get_current_user)):
    if user["role"] != UserRole.CUSTOMER.value:
        raise HTTPException(status_code=403, detail="Customer only")
    wishlist_items = await db.wishlist.find({"customer_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    
    # Enrich with product details
    enriched = []
    for item in wishlist_items:
        product = await db.medicines.find_one({"id": item["product_id"], "is_active": True}, {"_id": 0})
        if product:
            enriched.append({
                "id": item["id"],
                "product_id": item["product_id"],
                "product_name": product.get("name", ""),
                "product_type": product.get("product_type", "Medicine"),
                "price": product.get("price", 0),
                "manufacturer": product.get("manufacturer", ""),
                "image_path": product.get("image_path"),
                "is_active": product.get("is_active", True),
                "created_at": item["created_at"]
            })
    return enriched

@router.post("/customer/wishlist")
async def add_to_wishlist(data: dict, user: dict = Depends(get_current_user)):
    if user["role"] != UserRole.CUSTOMER.value:
        raise HTTPException(status_code=403, detail="Customer only")
    product_id = data.get("product_id")
    if not product_id:
        raise HTTPException(status_code=400, detail="product_id required")
    
    product = await db.medicines.find_one({"id": product_id, "is_active": True}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    existing = await db.wishlist.find_one({"customer_id": user["id"], "product_id": product_id})
    if existing:
        raise HTTPException(status_code=400, detail="Already in wishlist")
    
    wishlist_item = {
        "id": generate_id(),
        "customer_id": user["id"],
        "product_id": product_id,
        "created_at": get_utc_now()
    }
    await db.wishlist.insert_one(wishlist_item)
    return {"message": "Added to wishlist", "id": wishlist_item["id"]}

@router.delete("/customer/wishlist/{product_id}")
async def remove_from_wishlist(product_id: str, user: dict = Depends(get_current_user)):
    if user["role"] != UserRole.CUSTOMER.value:
        raise HTTPException(status_code=403, detail="Customer only")
    result = await db.wishlist.delete_one({"customer_id": user["id"], "product_id": product_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not in wishlist")
    return {"message": "Removed from wishlist"}

# ==================== Prescriptions ====================
@router.post("/customer/prescriptions")
async def upload_prescription(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user)
):
    if user["role"] != UserRole.CUSTOMER.value:
        raise HTTPException(status_code=403, detail="Customer only")
    
    allowed = {"image/jpeg", "image/png", "image/webp", "application/pdf"}
    if file.content_type not in allowed:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, WebP, and PDF files are allowed")
    
    data = await file.read()
    if len(data) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File must be less than 10MB")
    
    ext = file.filename.split(".")[-1] if "." in file.filename else "png"
    path = f"{APP_NAME}/prescriptions/{user['id']}/{uuid.uuid4()}.{ext}"
    result = put_object(path, data, file.content_type)
    
    prescription = {
        "id": generate_id(),
        "customer_id": user["id"],
        "file_path": result["path"],
        "file_name": file.filename,
        "file_type": file.content_type,
        "file_size": len(data),
        "status": "uploaded",
        "created_at": get_utc_now()
    }
    await db.prescriptions.insert_one(prescription)
    prescription.pop("_id", None)
    return prescription

@router.get("/customer/prescriptions")
async def list_prescriptions(user: dict = Depends(get_current_user)):
    if user["role"] != UserRole.CUSTOMER.value:
        raise HTTPException(status_code=403, detail="Customer only")
    prescriptions = await db.prescriptions.find(
        {"customer_id": user["id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return prescriptions

@router.delete("/customer/prescriptions/{prescription_id}")
async def delete_prescription(prescription_id: str, user: dict = Depends(get_current_user)):
    if user["role"] != UserRole.CUSTOMER.value:
        raise HTTPException(status_code=403, detail="Customer only")
    result = await db.prescriptions.delete_one({"id": prescription_id, "customer_id": user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Prescription not found")
    return {"message": "Prescription deleted"}

# ==================== Support Tickets ====================
class TicketCategory(str, Enum):
    ORDER_ISSUE = "Order Issue"
    DELIVERY_ISSUE = "Delivery Issue"
    PAYMENT_ISSUE = "Payment Issue"
    PRODUCT_ISSUE = "Product Issue"
    PRESCRIPTION_ISSUE = "Prescription Issue"
    ACCOUNT_ISSUE = "Account Issue"
    OTHER = "Other"

class TicketCreate(BaseModel):
    subject: str
    category: TicketCategory
    description: str
    order_id: Optional[str] = None

@router.post("/customer/support-tickets")
async def create_support_ticket(data: TicketCreate, user: dict = Depends(get_current_user)):
    if user["role"] != UserRole.CUSTOMER.value:
        raise HTTPException(status_code=403, detail="Customer only")
    
    ticket = {
        "id": generate_id(),
        "ticket_number": f"TKT-{uuid.uuid4().hex[:8].upper()}",
        "customer_id": user["id"],
        "customer_name": user.get("name", ""),
        "customer_phone": user.get("phone", ""),
        "subject": data.subject,
        "category": data.category.value,
        "description": data.description,
        "order_id": data.order_id,
        "status": "Open",
        "messages": [{
            "sender": "customer",
            "message": data.description,
            "timestamp": get_utc_now()
        }],
        "created_at": get_utc_now(),
        "updated_at": get_utc_now()
    }
    await db.support_tickets.insert_one(ticket)
    ticket.pop("_id", None)
    return ticket

@router.get("/customer/support-tickets")
async def list_support_tickets(user: dict = Depends(get_current_user)):
    if user["role"] != UserRole.CUSTOMER.value:
        raise HTTPException(status_code=403, detail="Customer only")
    tickets = await db.support_tickets.find(
        {"customer_id": user["id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return tickets

@router.get("/customer/support-tickets/{ticket_id}")
async def get_support_ticket(ticket_id: str, user: dict = Depends(get_current_user)):
    if user["role"] != UserRole.CUSTOMER.value:
        raise HTTPException(status_code=403, detail="Customer only")
    ticket = await db.support_tickets.find_one(
        {"id": ticket_id, "customer_id": user["id"]}, {"_id": 0}
    )
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return ticket

@router.post("/customer/support-tickets/{ticket_id}/reply")
async def reply_to_ticket(ticket_id: str, data: dict, user: dict = Depends(get_current_user)):
    if user["role"] != UserRole.CUSTOMER.value:
        raise HTTPException(status_code=403, detail="Customer only")
    message = data.get("message", "").strip()
    if not message:
        raise HTTPException(status_code=400, detail="Message required")
    
    ticket = await db.support_tickets.find_one({"id": ticket_id, "customer_id": user["id"]})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    new_msg = {"sender": "customer", "message": message, "timestamp": get_utc_now()}
    await db.support_tickets.update_one(
        {"id": ticket_id},
        {"$push": {"messages": new_msg}, "$set": {"updated_at": get_utc_now()}}
    )
    return {"message": "Reply sent"}

# ==================== Notifications ====================
@router.get("/customer/notifications")
async def list_notifications(user: dict = Depends(get_current_user)):
    if user["role"] != UserRole.CUSTOMER.value:
        raise HTTPException(status_code=403, detail="Customer only")
    notifs = await db.notifications.find(
        {"customer_id": user["id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return notifs

@router.get("/customer/notifications/unread-count")
async def notification_unread_count(user: dict = Depends(get_current_user)):
    if user["role"] != UserRole.CUSTOMER.value:
        raise HTTPException(status_code=403, detail="Customer only")
    count = await db.notifications.count_documents({"customer_id": user["id"], "is_read": False})
    return {"count": count}

@router.post("/customer/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, user: dict = Depends(get_current_user)):
    if user["role"] != UserRole.CUSTOMER.value:
        raise HTTPException(status_code=403, detail="Customer only")
    await db.notifications.update_one(
        {"id": notification_id, "customer_id": user["id"]},
        {"$set": {"is_read": True}}
    )
    return {"message": "Marked as read"}

@router.post("/customer/notifications/read-all")
async def mark_all_notifications_read(user: dict = Depends(get_current_user)):
    if user["role"] != UserRole.CUSTOMER.value:
        raise HTTPException(status_code=403, detail="Customer only")
    await db.notifications.update_many(
        {"customer_id": user["id"], "is_read": False},
        {"$set": {"is_read": True}}
    )
    return {"message": "All marked as read"}

@router.delete("/customer/notifications/{notification_id}")
async def delete_notification(notification_id: str, user: dict = Depends(get_current_user)):
    if user["role"] != UserRole.CUSTOMER.value:
        raise HTTPException(status_code=403, detail="Customer only")
    await db.notifications.delete_one({"id": notification_id, "customer_id": user["id"]})
    return {"message": "Notification deleted"}

@router.delete("/customer/notifications")
async def clear_all_notifications(user: dict = Depends(get_current_user)):
    if user["role"] != UserRole.CUSTOMER.value:
        raise HTTPException(status_code=403, detail="Customer only")
    await db.notifications.delete_many({"customer_id": user["id"]})
    return {"message": "All notifications cleared"}

# Delete Account Request
@router.post("/customer/delete-account-request")
async def request_account_deletion(user: dict = Depends(get_current_user)):
    if user["role"] != UserRole.CUSTOMER.value:
        raise HTTPException(status_code=403, detail="Customer only")
    existing = await db.support_tickets.find_one(
        {"customer_id": user["id"], "category": "Account Issue", "subject": {"$regex": "Delete Account"}, "status": {"$ne": "Resolved"}}
    )
    if existing:
        raise HTTPException(status_code=400, detail="A delete account request is already pending")
    
    ticket = {
        "id": generate_id(),
        "ticket_number": f"TKT-{uuid.uuid4().hex[:8].upper()}",
        "customer_id": user["id"],
        "customer_name": user.get("name", ""),
        "customer_phone": user.get("phone", ""),
        "subject": "Delete Account Request",
        "category": "Account Issue",
        "description": "Customer has requested account deletion. Please review and process as per policy.",
        "order_id": None,
        "status": "Open",
        "messages": [{"sender": "system", "message": "Account deletion request submitted. Our team will review and process within 7 working days.", "timestamp": get_utc_now()}],
        "created_at": get_utc_now(),
        "updated_at": get_utc_now()
    }
    await db.support_tickets.insert_one(ticket)
    return {"message": "Account deletion request submitted", "ticket_id": ticket["id"]}


# ==================== Web Push Subscriptions ====================
@router.get("/push/vapid-public-key")
async def get_vapid_public_key(user: dict = Depends(get_current_user)):
    return {"public_key": VAPID_PUBLIC_KEY}

@router.post("/push/subscribe")
async def subscribe_push(subscription: dict = Body(...), user: dict = Depends(get_current_user)):
    if user["role"] != UserRole.CUSTOMER.value:
        raise HTTPException(status_code=403, detail="Only customers can subscribe")
    endpoint = subscription.get("endpoint")
    if not endpoint:
        raise HTTPException(status_code=400, detail="Invalid subscription")
    await db.push_subscriptions.update_one(
        {"endpoint": endpoint},
        {"$set": {
            "customer_id": user["id"],
            "subscription": subscription,
            "endpoint": endpoint,
            "updated_at": get_utc_now(),
        }, "$setOnInsert": {"id": generate_id(), "created_at": get_utc_now()}},
        upsert=True,
    )
    return {"message": "Subscribed to push notifications"}

@router.post("/push/unsubscribe")
async def unsubscribe_push(data: dict = Body(...), user: dict = Depends(get_current_user)):
    if user["role"] != UserRole.CUSTOMER.value:
        raise HTTPException(status_code=403, detail="Only customers can unsubscribe")
    endpoint = data.get("endpoint")
    if endpoint:
        await db.push_subscriptions.delete_one({"endpoint": endpoint, "customer_id": user["id"]})
    return {"message": "Unsubscribed"}

