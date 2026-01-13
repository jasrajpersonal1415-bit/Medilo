# MEDILO Healthcare Pilot - Product Requirements Document

## Project Overview
**Name:** MEDILO Healthcare Pilot Application  
**Type:** Closed, Throw-Away Pilot  
**Max Users:** 300  
**Region:** India (Single City/Zone)  
**Status:** MVP Complete  
**Last Updated:** January 13, 2026

---

## Original Problem Statement
Build a CLOSED, THROW-AWAY PILOT APPLICATION for a healthcare startup called MEDILO (India). Maximum 300 users. Pharmacist accountability mandatory. No forced medicine substitution. Compliance > speed > growth. System must be auditable end-to-end.

---

## User Personas

### 1. Customer (Patient)
- **Access:** Mobile only (mobile web app)
- **Auth:** Phone number login (no OTP for pilot)
- **Can:** Search medicines, place orders, upload prescriptions, track orders, download invoices
- **Cannot:** Choose pharmacy, force substitutions, bypass prescription rules

### 2. Pharmacy Staff
- **Access:** Desktop only (web dashboard)
- **Auth:** Email + Password
- **Can:** View assigned orders, accept/reject, confirm inventory (batch, expiry ONLY), manage order preparation and delivery status
- **Cannot:** Modify orders, bypass inventory confirmation, SET OR EDIT PRICES

### 3. Registered Pharmacist
- **Access:** Desktop only (web dashboard)
- **Auth:** Email + Password
- **Can:** Review orders, view prescriptions, approve/reject/request prescription, assign pharmacies
- **Cannot:** Skip review for Schedule H/H1 medicines

### 4. MEDILO Internal Ops
- **Access:** Desktop only (web dashboard)
- **Auth:** Email + Password
- **Can:** View all orders, audit logs, users, manage medicines and pharmacies, SET AND CONTROL MEDICINE PRICES
- **Cannot:** Modify orders, override rules, approve medicines

### 5. Delivery Partner
- **Access:** Mobile only (mobile web app)
- **Auth:** Phone number login
- **Can:** View assigned deliveries, accept deliveries, update status (picked_up, out_for_delivery, delivered), report issues
- **Cannot:** See medicine details, see prices, modify orders

---

## Core Requirements

### Medicine Risk Classification (CRITICAL)
| Bucket | Category | Prescription | Pharmacist Review |
|--------|----------|--------------|-------------------|
| 🟢 OTC | Over-the-counter | Not required | Not required |
| 🟡 Schedule H | Chronic medicines | Optional (declaration allowed) | Required (silent) |
| 🔴 Schedule H1 | Controlled | MANDATORY | MANDATORY |

### Order Workflow (STRICT SEQUENCE)
1. Order placed by customer
2. Pharmacist review (mandatory for Schedule H & H1)
3. Pharmacist approval
4. Pharmacy assignment
5. Pharmacy accepts
6. Inventory confirmation (batch, expiry ONLY - price from MEDILO master)
7. Invoice auto-generation (with MEDILO-controlled prices)
8. Preparation → Ready for Pickup
9. Delivery partner assigned → Picked up → Out for Delivery → Delivered

### Centralized Pricing (CRITICAL - IMPLEMENTED ✅)
| Rule | Description |
|------|-------------|
| Price Master | MEDILO backend maintains centralized price list |
| Price Definition | By medicine name, strength, and pack size |
| Automatic Application | Price applied automatically during order creation |
| Customer Visibility | Price visible to customer before order confirmation |
| Invoice Pricing | Invoice uses MEDILO-defined prices only |
| Pharmacy Restrictions | Pharmacies CANNOT add/edit/override prices |
| Audit Trail | All price-related actions logged |

### Authentication Rules (PILOT)
- **Customers:** Phone number only (no OTP)
- **Staff:** Email + Password with role-based access
- **Delivery Partners:** Phone number only
- **No super-admin override powers**

---

## What's Been Implemented ✅

### Backend (FastAPI + MongoDB)
- [x] User authentication (customer phone login, staff email+password, delivery partner phone login)
- [x] JWT token-based authorization
- [x] Role-based access control (customer, pharmacy_staff, pharmacist, ops, delivery_partner)
- [x] Medicine CRUD with bucket classification (OTC, SCHEDULE_H, SCHEDULE_H1)
- [x] **Centralized pricing** - MEDILO-controlled medicine prices
- [x] Pharmacy management
- [x] Order management with strict workflow enforcement
- [x] **Order total calculated from medicine master prices**
- [x] Pharmacist review endpoints (approve, reject, request prescription, assign)
- [x] Pharmacy fulfillment endpoints (accept, reject, inventory confirmation, status updates)
- [x] **Inventory confirmation without price input**
- [x] Invoice generation (HTML format with MEDILO prices)
- [x] Delivery partner endpoints (orders, accept, status updates, issue reporting)
- [x] Audit logging for all actions
- [x] User management (activate/deactivate)

### Frontend (React + Tailwind + Shadcn UI)

#### Customer Mobile App
- [x] Phone number login/registration
- [x] Medicine search and listing with **MEDILO prices displayed**
- [x] Color-coded medicine buckets (green/yellow/red)
- [x] Shopping cart with quantity management and **total from MEDILO prices**
- [x] Prescription upload for Schedule H1
- [x] Declaration checkbox for Schedule H
- [x] Location capture for delivery
- [x] Order placement with validation
- [x] Order history and tracking
- [x] Order timeline visualization
- [x] Invoice download (shows MEDILO prices)
- [x] Order cancellation

#### Pharmacist Dashboard
- [x] Pending orders queue
- [x] Prescription viewer
- [x] Approve/Reject with notes
- [x] Request prescription action
- [x] Pharmacy assignment with dropdown
- [x] Filter by status (Pending, Approved, All)

#### Pharmacy Dashboard
- [x] Assigned orders view
- [x] Accept/Reject orders
- [x] **Inventory confirmation (batch, expiry ONLY - NO price input)**
- [x] **Read-only MEDILO price display**
- [x] Status progression (Preparing → Ready for Pickup)
- [x] Order cards with medicine details

#### Ops Dashboard (Read + Create)
- [x] All orders view with timeline
- [x] **Medicine catalog management with PRICE FIELD**
- [x] Pharmacy registration (add new)
- [x] Staff account creation (pharmacist, pharmacy_staff, ops)
- [x] **Delivery partner registration**
- [x] User activation/deactivation
- [x] Audit logs viewer

#### Delivery Partner Dashboard
- [x] Phone number login
- [x] Available deliveries list (ready for pickup)
- [x] Accept delivery
- [x] Status updates (picked_up, out_for_delivery, delivered)
- [x] Issue reporting
- [x] Limited order view (no medicine details, no prices)

---

## Prioritized Backlog

### P0 - Critical (Future)
- [ ] OTP-based authentication (post DLT registration)
- [ ] Payment integration

### P1 - High Priority
- [ ] PDF invoice generation (currently HTML)
- [ ] Audit log export (CSV)
- [ ] Push notifications for order status
- [ ] Prescription image validation

### P2 - Medium Priority
- [ ] Order history export (CSV)
- [ ] Pharmacy inventory management
- [ ] Multi-pharmacy availability check

### P3 - Nice to Have
- [ ] Medicine alternatives suggestion
- [ ] Prescription reminder system
- [ ] Analytics dashboard for Ops

---

## Technical Architecture

### Stack
- **Backend:** FastAPI (Python 3.x)
- **Database:** MongoDB
- **Frontend:** React 19 + Tailwind CSS + Shadcn UI
- **Auth:** JWT (phone-based for customers/delivery, email+password for staff)

### API Structure
- `/api/auth/*` - Authentication endpoints
- `/api/medicines` - Medicine CRUD (with price)
- `/api/pharmacies` - Pharmacy management
- `/api/orders` - Order management
- `/api/pharmacist/*` - Pharmacist actions
- `/api/pharmacy/*` - Pharmacy staff actions (no price input)
- `/api/ops/*` - Operations read-only views
- `/api/delivery/*` - Delivery partner actions

---

## Key Database Models

### medicines
```json
{
  "id": "uuid",
  "name": "string",
  "generic_name": "string",
  "bucket": "OTC|SCHEDULE_H|SCHEDULE_H1",
  "strength": "string",
  "form": "string",
  "manufacturer": "string",
  "price": "float (MEDILO-controlled)",
  "pack_size": "string"
}
```

### orders
```json
{
  "id": "uuid",
  "customer_id": "uuid",
  "items": [{
    "medicine_id": "uuid",
    "medicine_name": "string",
    "quantity": "int",
    "unit_price": "float (from medicine master)"
  }],
  "total_amount": "float (calculated from MEDILO prices)",
  "status": "enum",
  "pharmacy_id": "uuid",
  "delivery_partner_id": "uuid"
}
```

---

## Test Credentials

| Role | Email/Phone | Password |
|------|-------------|----------|
| Ops | ops@medilo.com | test123 |
| Pharmacist | pharmacist@medilo.com | test123 |
| Pharmacy Staff | pharmacy_staff@test.com | test123 |
| Customer | 9876543210 | (phone only) |
| Delivery Partner | (registered via Ops) | (phone only) |

---

## Changelog

### January 13, 2026
- ✅ **Centralized Pricing Feature Complete**
  - MEDILO Ops controls all medicine prices
  - Pharmacies cannot add/edit/override prices
  - Order total calculated from medicine master
  - Invoice shows MEDILO-controlled prices
  - Pharmacy inventory confirmation accepts batch & expiry ONLY
  - All pricing tests passed (100% success rate)

### January 8, 2026
- ✅ Delivery Partner feature added
- ✅ Invoice download fix for customers
- ✅ Initial MVP with 4 roles (Customer, Pharmacy, Pharmacist, Ops)
