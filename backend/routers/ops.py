from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from fastapi.responses import StreamingResponse, Response
from config import db, put_object, get_object, APP_NAME
from models import *
from services import *

router = APIRouter(prefix="/api")


@router.post("/ops/products/import/validate")
async def validate_csv_import(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    if user["role"] != UserRole.OPS.value:
        raise HTTPException(status_code=403, detail="Only ops can import products")
    
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")
    
    content = await file.read()
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        try:
            text = content.decode("latin-1")
        except UnicodeDecodeError:
            raise HTTPException(status_code=400, detail="Unable to decode file. Use UTF-8 encoding.")
    
    reader = csv.DictReader(io.StringIO(text))
    required_headers = {"Product Name", "Category", "Type", "Batch", "Expiry Date", "Quantity", "MRP", "Purchase Price", "Manufacturer"}
    actual_headers = set(reader.fieldnames or [])
    missing = required_headers - actual_headers
    if missing:
        raise HTTPException(status_code=400, detail=f"Missing required columns: {', '.join(sorted(missing))}")
    
    rows = []
    all_errors = []
    for i, row in enumerate(reader, start=2):
        if i > 10002:
            all_errors.append(f"File exceeds 10,000 row limit")
            break
        parsed, errs = parse_csv_row(row, i)
        all_errors.extend(errs)
        rows.append(parsed)
    
    if not rows:
        raise HTTPException(status_code=400, detail="CSV file is empty (no data rows)")
    
    # Check for duplicates within CSV
    seen = {}
    duplicates_in_csv = []
    for r in rows:
        key = (r["name"].lower(), r["batch"].lower()) if r["name"] and r["batch"] else None
        if key:
            if key in seen:
                duplicates_in_csv.append(f"Row {r['row_num']}: Duplicate of row {seen[key]} ({r['name']} + {r['batch']})")
            else:
                seen[key] = r["row_num"]
    
    # Check duplicates against DB
    existing_matches = []
    new_entries = []
    update_entries = []
    for r in rows:
        if r["name"] and r["batch"]:
            existing = await db.medicines.find_one(
                {"name": {"$regex": f"^{r['name']}$", "$options": "i"}, "batch": r["batch"], "is_active": True},
                {"_id": 0, "id": 1, "name": 1, "batch": 1, "quantity": 1}
            )
            if existing:
                update_entries.append({**r, "existing_id": existing["id"], "existing_quantity": existing.get("quantity", 0)})
            else:
                new_entries.append(r)
        else:
            new_entries.append(r)
    
    # Sort by expiry date
    def sort_key(x):
        try:
            return x.get("expiry_date") or "9999-99-99"
        except:
            return "9999-99-99"
    
    rows_sorted = sorted(rows, key=sort_key)
    
    return {
        "total_rows": len(rows),
        "valid_rows": len(rows) - len([e for e in all_errors if e]),
        "errors": all_errors,
        "duplicates_in_csv": duplicates_in_csv,
        "new_entries": len(new_entries),
        "update_entries": len(update_entries),
        "preview": rows_sorted[:100],
        "all_data": rows_sorted,
        "has_errors": len(all_errors) > 0
    }

@router.post("/ops/products/import/confirm")
async def confirm_csv_import(data: dict, user: dict = Depends(get_current_user)):
    if user["role"] != UserRole.OPS.value:
        raise HTTPException(status_code=403, detail="Only ops can import products")
    
    rows = data.get("rows", [])
    if not rows:
        raise HTTPException(status_code=400, detail="No data to import")
    
    created = 0
    updated = 0
    errors = []
    
    for r in rows:
        try:
            name = r.get("name", "").strip()
            batch = r.get("batch", "").strip()
            if not name or not batch:
                continue
            
            # Check if exists
            existing = await db.medicines.find_one(
                {"name": {"$regex": f"^{name}$", "$options": "i"}, "batch": batch, "is_active": True},
                {"_id": 0}
            )
            
            if existing:
                # Update quantity (add to existing)
                new_qty = (existing.get("quantity") or 0) + (r.get("quantity") or 0)
                update_fields = {"quantity": new_qty}
                if r.get("price") is not None:
                    update_fields["price"] = r["price"]
                if r.get("purchase_price") is not None:
                    update_fields["purchase_price"] = r["purchase_price"]
                if r.get("expiry_date"):
                    update_fields["expiry_date"] = r["expiry_date"]
                
                await db.medicines.update_one({"id": existing["id"]}, {"$set": update_fields})
                updated += 1
            else:
                # Create new entry
                medicine = {
                    "id": generate_id(),
                    "name": name,
                    "generic_name": name,
                    "manufacturer": r.get("manufacturer", ""),
                    "bucket": r.get("bucket"),
                    "product_type": r.get("product_type", "Medicine"),
                    "strength": "",
                    "form": "tablet",
                    "pack_size": "",
                    "price": r.get("price", 0),
                    "purchase_price": r.get("purchase_price"),
                    "batch": batch,
                    "expiry_date": r.get("expiry_date"),
                    "quantity": r.get("quantity", 0),
                    "description": None,
                    "is_active": True,
                    "created_at": get_utc_now()
                }
                await db.medicines.insert_one(medicine)
                created += 1
        except Exception as e:
            errors.append(f"Error processing {r.get('name', 'unknown')}: {str(e)}")
    
    await log_audit("csv_import", "medicine", "bulk", user["id"], user["role"],
                    {"created": created, "updated": updated, "total": len(rows)})
    
    return {
        "created": created,
        "updated": updated,
        "errors": errors,
        "total_processed": created + updated
    }


@router.get("/ops/orders", response_model=List[OrderResponse])
async def ops_get_orders(status: OrderStatus = None, user: dict = Depends(get_current_user)):
    if user["role"] != UserRole.OPS.value:
        raise HTTPException(status_code=403, detail="Only ops can access this")
    
    query = {}
    if status:
        query["status"] = status.value
    
    orders = await db.orders.find(query, {"_id": 0, "highest_bucket": 0}).sort("created_at", -1).to_list(1000)
    return [OrderResponse(**o) for o in orders]

@router.get("/ops/audit-logs", response_model=List[AuditLogResponse])
async def get_audit_logs(
    entity_type: str = None,
    entity_id: str = None,
    limit: int = 100,
    user: dict = Depends(get_current_user)
):
    if user["role"] != UserRole.OPS.value:
        raise HTTPException(status_code=403, detail="Only ops can access audit logs")
    
    query = {}
    if entity_type:
        query["entity_type"] = entity_type
    if entity_id:
        query["entity_id"] = entity_id
    
    logs = await db.audit_logs.find(query, {"_id": 0}).sort("timestamp", -1).to_list(limit)
    return [AuditLogResponse(**log) for log in logs]

@router.get("/ops/audit-logs/export")
async def export_audit_logs(
    start_date: str = None,
    end_date: str = None,
    entity_type: str = None,
    user: dict = Depends(get_current_user)
):
    if user["role"] != UserRole.OPS.value:
        raise HTTPException(status_code=403, detail="Only ops can export audit logs")
    
    query = {}
    if entity_type:
        query["entity_type"] = entity_type
    if start_date:
        query["timestamp"] = {"$gte": start_date}
    if end_date:
        query.setdefault("timestamp", {})["$lte"] = end_date + "T23:59:59"
    
    logs = await db.audit_logs.find(query, {"_id": 0}).sort("timestamp", -1).to_list(10000)
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Timestamp", "Action", "Entity Type", "Entity ID", "User ID", "User Role", "Details"])
    
    for log in logs:
        details_str = ""
        if log.get("details"):
            try:
                import json
                details_str = json.dumps(log["details"])
            except Exception:
                details_str = str(log.get("details", ""))
        writer.writerow([
            log.get("timestamp", ""),
            log.get("action", ""),
            log.get("entity_type", ""),
            log.get("entity_id", ""),
            log.get("user_id", ""),
            log.get("user_role", ""),
            details_str
        ])
    
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=medilo_audit_logs_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.csv"}
    )

@router.get("/ops/order/{order_id}/timeline", response_model=List[AuditLogResponse])
async def get_order_timeline(order_id: str, user: dict = Depends(get_current_user)):
    if user["role"] != UserRole.OPS.value:
        raise HTTPException(status_code=403, detail="Only ops can access this")
    
    logs = await db.audit_logs.find(
        {"entity_type": "order", "entity_id": order_id},
        {"_id": 0}
    ).sort("timestamp", 1).to_list(100)
    return [AuditLogResponse(**log) for log in logs]

# User Management (for Ops)
@router.get("/ops/users", response_model=List[UserResponse])
async def get_users(role: UserRole = None, user: dict = Depends(get_current_user)):
    if user["role"] != UserRole.OPS.value:
        raise HTTPException(status_code=403, detail="Only ops can access this")
    
    query = {}
    if role:
        query["role"] = role.value
    
    users = await db.users.find(query, {"_id": 0, "password_hash": 0}).to_list(1000)
    return [UserResponse(**u) for u in users]

@router.post("/ops/users/{user_id}/toggle-active")
async def toggle_user_active(user_id: str, user: dict = Depends(get_current_user)):
    if user["role"] != UserRole.OPS.value:
        raise HTTPException(status_code=403, detail="Only ops can manage users")
    
    target_user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    new_status = not target_user.get("is_active", True)
    await db.users.update_one({"id": user_id}, {"$set": {"is_active": new_status}})
    await log_audit(
        "user_status_changed",
        "user",
        user_id,
        user["id"],
        user["role"],
        {"new_status": new_status}
    )
    
    return {"message": f"User {'activated' if new_status else 'deactivated'}"}


# ==================== Ops: Customer Management Suite ====================
class OpsNotificationSend(BaseModel):
    customer_id: Optional[str] = None
    broadcast: bool = False
    title: str
    message: str
    type: str = "system"

class TicketStatusUpdate(BaseModel):
    status: str

def _ensure_ops(user: dict):
    if user["role"] != UserRole.OPS.value:
        raise HTTPException(status_code=403, detail="Only ops can access this")

async def _grouped_counts(coll, ids, extra_match: dict = None):
    match = {"customer_id": {"$in": ids}}
    if extra_match:
        match.update(extra_match)
    out = {}
    async for row in coll.aggregate([{"$match": match}, {"$group": {"_id": "$customer_id", "c": {"$sum": 1}}}]):
        out[row["_id"]] = row["c"]
    return out

@router.get("/ops/customers")
async def ops_list_customers(search: str = None, user: dict = Depends(get_current_user)):
    _ensure_ops(user)
    query = {"role": UserRole.CUSTOMER.value}
    if search:
        rx = {"$regex": search, "$options": "i"}
        query["$or"] = [{"name": rx}, {"phone": rx}, {"email": rx}]
    customers = await db.users.find(query, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(1000)
    ids = [c["id"] for c in customers]

    order_stats = {}
    async for row in db.orders.aggregate([
        {"$match": {"customer_id": {"$in": ids}}},
        {"$group": {"_id": "$customer_id", "count": {"$sum": 1},
                    "spend": {"$sum": {"$cond": [{"$eq": ["$status", "delivered"]}, {"$ifNull": ["$total_amount", 0]}, 0]}}}}
    ]):
        order_stats[row["_id"]] = {"count": row["count"], "spend": round(row.get("spend") or 0, 2)}

    addr_counts = await _grouped_counts(db.addresses, ids)
    wish_counts = await _grouped_counts(db.wishlist, ids)
    presc_counts = await _grouped_counts(db.prescriptions, ids)
    open_tickets = await _grouped_counts(db.support_tickets, ids, {"status": {"$in": ["Open", "In Progress"]}})

    result = []
    for c in customers:
        cid = c["id"]
        os_ = order_stats.get(cid, {"count": 0, "spend": 0})
        result.append({
            "id": cid,
            "name": c.get("name", ""),
            "phone": c.get("phone", ""),
            "email": c.get("email", ""),
            "is_active": c.get("is_active", True),
            "created_at": c.get("created_at", ""),
            "total_orders": os_["count"],
            "total_spend": os_["spend"],
            "address_count": addr_counts.get(cid, 0),
            "wishlist_count": wish_counts.get(cid, 0),
            "prescription_count": presc_counts.get(cid, 0),
            "open_tickets": open_tickets.get(cid, 0),
        })
    return result

@router.get("/ops/customers/{customer_id}")
async def ops_customer_detail(customer_id: str, user: dict = Depends(get_current_user)):
    _ensure_ops(user)
    c = await db.users.find_one({"id": customer_id, "role": UserRole.CUSTOMER.value}, {"_id": 0, "password_hash": 0})
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found")

    orders = await db.orders.find({"customer_id": customer_id}, {"_id": 0, "highest_bucket": 0}).sort("created_at", -1).to_list(1000)
    addresses = await db.addresses.find({"customer_id": customer_id}, {"_id": 0}).sort("is_default", -1).to_list(50)
    prescriptions = await db.prescriptions.find({"customer_id": customer_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    tickets = await db.support_tickets.find({"customer_id": customer_id}, {"_id": 0}).sort("created_at", -1).to_list(100)

    wishlist_items = await db.wishlist.find({"customer_id": customer_id}, {"_id": 0}).sort("created_at", -1).to_list(200)
    wishlist = []
    for item in wishlist_items:
        product = await db.medicines.find_one({"id": item["product_id"]}, {"_id": 0})
        if product:
            wishlist.append({
                "id": item["id"],
                "product_id": item["product_id"],
                "product_name": product.get("name", ""),
                "product_type": product.get("product_type", "Medicine"),
                "price": product.get("price", 0),
                "manufacturer": product.get("manufacturer", ""),
                "image_path": product.get("image_path"),
                "created_at": item["created_at"],
            })

    total_spend = round(sum((o.get("total_amount") or 0) for o in orders if o.get("status") == "delivered"), 2)
    return {
        "profile": {
            "id": c["id"],
            "name": c.get("name", ""),
            "phone": c.get("phone", ""),
            "email": c.get("email", ""),
            "is_active": c.get("is_active", True),
            "created_at": c.get("created_at", ""),
        },
        "stats": {
            "total_orders": len(orders),
            "total_spend": total_spend,
            "address_count": len(addresses),
            "wishlist_count": len(wishlist),
            "prescription_count": len(prescriptions),
            "open_tickets": sum(1 for t in tickets if t.get("status") in ("Open", "In Progress")),
        },
        "orders": orders,
        "addresses": addresses,
        "prescriptions": prescriptions,
        "wishlist": wishlist,
        "tickets": tickets,
    }

@router.get("/ops/support-tickets")
async def ops_list_tickets(status: str = None, user: dict = Depends(get_current_user)):
    _ensure_ops(user)
    q = {}
    if status:
        q["status"] = status
    tickets = await db.support_tickets.find(q, {"_id": 0}).sort("updated_at", -1).to_list(500)
    return tickets

@router.get("/ops/support-tickets/{ticket_id}")
async def ops_get_ticket(ticket_id: str, user: dict = Depends(get_current_user)):
    _ensure_ops(user)
    ticket = await db.support_tickets.find_one({"id": ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return ticket

@router.post("/ops/support-tickets/{ticket_id}/reply")
async def ops_reply_ticket(ticket_id: str, data: dict, user: dict = Depends(get_current_user)):
    _ensure_ops(user)
    message = data.get("message", "").strip()
    if not message:
        raise HTTPException(status_code=400, detail="Message required")
    ticket = await db.support_tickets.find_one({"id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    new_msg = {"sender": "support", "message": message, "timestamp": get_utc_now()}
    new_status = ticket.get("status", "Open")
    if new_status == "Open":
        new_status = "In Progress"
    await db.support_tickets.update_one(
        {"id": ticket_id},
        {"$push": {"messages": new_msg}, "$set": {"updated_at": get_utc_now(), "status": new_status}}
    )
    await db.notifications.insert_one({
        "id": generate_id(),
        "customer_id": ticket["customer_id"],
        "title": "Support replied to your ticket",
        "message": message[:140],
        "type": "system",
        "is_read": False,
        "created_at": get_utc_now(),
    })
    await log_audit("ticket_reply", "support_ticket", ticket_id, user["id"], user["role"])
    return {"message": "Reply sent"}

@router.post("/ops/support-tickets/{ticket_id}/status")
async def ops_update_ticket_status(ticket_id: str, data: TicketStatusUpdate, user: dict = Depends(get_current_user)):
    _ensure_ops(user)
    valid = ["Open", "In Progress", "Resolved", "Closed"]
    if data.status not in valid:
        raise HTTPException(status_code=400, detail="Invalid status")
    res = await db.support_tickets.update_one(
        {"id": ticket_id},
        {"$set": {"status": data.status, "updated_at": get_utc_now()}}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Ticket not found")
    await log_audit("ticket_status_changed", "support_ticket", ticket_id, user["id"], user["role"], {"status": data.status})
    return {"message": "Status updated"}

@router.post("/ops/notifications/send")
async def ops_send_notification(data: OpsNotificationSend, user: dict = Depends(get_current_user)):
    _ensure_ops(user)
    now = get_utc_now()
    if data.broadcast:
        customers = await db.users.find({"role": UserRole.CUSTOMER.value, "is_active": True}, {"_id": 0, "id": 1}).to_list(1000)
        targets = [c["id"] for c in customers]
    elif data.customer_id:
        targets = [data.customer_id]
    else:
        raise HTTPException(status_code=400, detail="customer_id or broadcast required")
    docs = [{
        "id": generate_id(),
        "customer_id": cid,
        "title": data.title,
        "message": data.message,
        "type": data.type,
        "is_read": False,
        "created_at": now,
    } for cid in targets]
    if docs:
        await db.notifications.insert_many(docs)
    await log_audit("notification_sent", "notification",
                    "broadcast" if data.broadcast else (data.customer_id or ""),
                    user["id"], user["role"], {"count": len(docs)})
    return {"message": f"Notification sent to {len(docs)} customer(s)", "count": len(docs)}

@router.get("/ops/analytics/customers")
async def ops_customer_analytics(user: dict = Depends(get_current_user)):
    _ensure_ops(user)
    total_customers = await db.users.count_documents({"role": UserRole.CUSTOMER.value})
    active_customers = await db.users.count_documents({"role": UserRole.CUSTOMER.value, "is_active": True})
    now = datetime.now(timezone.utc)
    d7 = (now - timedelta(days=7)).isoformat()
    d30 = (now - timedelta(days=30)).isoformat()
    new_7 = await db.users.count_documents({"role": UserRole.CUSTOMER.value, "created_at": {"$gte": d7}})
    new_30 = await db.users.count_documents({"role": UserRole.CUSTOMER.value, "created_at": {"$gte": d30}})
    ordering_customers = len(await db.orders.distinct("customer_id"))

    top_spenders = []
    async for row in db.orders.aggregate([
        {"$match": {"status": "delivered"}},
        {"$group": {"_id": "$customer_id", "spend": {"$sum": {"$ifNull": ["$total_amount", 0]}}, "orders": {"$sum": 1}}},
        {"$sort": {"spend": -1}}, {"$limit": 5}
    ]):
        u = await db.users.find_one({"id": row["_id"]}, {"_id": 0, "name": 1, "phone": 1})
        top_spenders.append({
            "customer_id": row["_id"],
            "name": (u or {}).get("name", ""),
            "phone": (u or {}).get("phone", ""),
            "spend": round(row["spend"], 2),
            "orders": row["orders"],
        })

    status_dist = {}
    async for row in db.orders.aggregate([{"$group": {"_id": "$status", "c": {"$sum": 1}}}]):
        status_dist[row["_id"]] = row["c"]

    open_tickets = await db.support_tickets.count_documents({"status": {"$in": ["Open", "In Progress"]}})
    total_tickets = await db.support_tickets.count_documents({})

    top_wishlist = []
    async for row in db.wishlist.aggregate([
        {"$group": {"_id": "$product_id", "c": {"$sum": 1}}},
        {"$sort": {"c": -1}}, {"$limit": 8}
    ]):
        p = await db.medicines.find_one({"id": row["_id"]}, {"_id": 0, "name": 1, "product_type": 1, "price": 1})
        if p:
            top_wishlist.append({
                "product_id": row["_id"],
                "name": p.get("name", ""),
                "product_type": p.get("product_type", ""),
                "price": p.get("price", 0),
                "count": row["c"],
            })

    return {
        "total_customers": total_customers,
        "active_customers": active_customers,
        "new_customers_7d": new_7,
        "new_customers_30d": new_30,
        "ordering_customers": ordering_customers,
        "top_spenders": top_spenders,
        "order_status_distribution": status_dist,
        "open_tickets": open_tickets,
        "total_tickets": total_tickets,
        "top_wishlist_products": top_wishlist,
    }

