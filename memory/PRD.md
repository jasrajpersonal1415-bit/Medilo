# MEDILO Healthcare Pilot - Product Requirements Document

## Project Overview
**Name:** MEDILO Healthcare Pilot Application  
**Type:** Closed, Throw-Away Pilot  
**Max Users:** 300  
**Region:** India (Single City/Zone)  
**Status:** MVP Complete  
**Last Updated:** January 8, 2026

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
- **Can:** View assigned orders, accept/reject, confirm inventory (batch, expiry, price), manage order preparation and delivery status
- **Cannot:** Modify orders, bypass inventory confirmation

### 3. Registered Pharmacist
- **Access:** Desktop only (web dashboard)
- **Auth:** Email + Password
- **Can:** Review orders, view prescriptions, approve/reject/request prescription, assign pharmacies
- **Cannot:** Skip review for Schedule H/H1 medicines

### 4. MEDILO Internal Ops
- **Access:** Desktop only (web dashboard)
- **Auth:** Email + Password
- **Can:** View all orders, audit logs, users, manage medicines and pharmacies (READ + CREATE)
- **Cannot:** Modify orders, override rules, approve medicines

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
6. Inventory confirmation (batch, expiry, price)
7. Invoice auto-generation
8. Preparation → Out for Delivery → Delivered

### Authentication Rules (PILOT)
- **Customers:** Phone number only (no OTP)
- **Staff:** Email + Password with role-based access
- **No super-admin override powers**

---

## What's Been Implemented ✅

### Backend (FastAPI + MongoDB)
- [x] User authentication (customer phone login, staff email+password)
- [x] JWT token-based authorization
- [x] Role-based access control (customer, pharmacy_staff, pharmacist, ops)
- [x] Medicine CRUD with bucket classification (OTC, SCHEDULE_H, SCHEDULE_H1)
- [x] Pharmacy management
- [x] Order management with strict workflow enforcement
- [x] Pharmacist review endpoints (approve, reject, request prescription, assign)
- [x] Pharmacy fulfillment endpoints (accept, reject, inventory confirmation, status updates)
- [x] Invoice generation (HTML format)
- [x] Audit logging for all actions
- [x] User management (activate/deactivate)

### Frontend (React + Tailwind + Shadcn UI)

#### Customer Mobile App
- [x] Phone number login/registration
- [x] Medicine search and listing
- [x] Color-coded medicine buckets (green/yellow/red)
- [x] Shopping cart with quantity management
- [x] Prescription upload for Schedule H1
- [x] Declaration checkbox for Schedule H
- [x] Location capture for delivery
- [x] Order placement with validation
- [x] Order history and tracking
- [x] Order timeline visualization
- [x] Invoice download
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
- [x] Inventory confirmation (batch, expiry, unit price)
- [x] Status progression (Preparing → Out for Delivery → Delivered)
- [x] Order cards with medicine details

#### Ops Dashboard (Read + Create)
- [x] All orders view with timeline
- [x] Medicine catalog management (add new)
- [x] Pharmacy registration (add new)
- [x] Staff account creation (pharmacist, pharmacy_staff, ops)
- [x] User activation/deactivation
- [x] Audit logs viewer

---

## Prioritized Backlog

### P0 - Critical (Future)
- [ ] OTP-based authentication (post DLT registration)
- [ ] Payment integration

### P1 - High Priority
- [ ] PDF invoice generation (currently HTML)
- [ ] Push notifications for order status
- [ ] Prescription image validation

### P2 - Medium Priority
- [ ] Order history export (CSV)
- [ ] Pharmacy inventory management
- [ ] Multi-pharmacy availability check
- [ ] Delivery partner integration

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
- **Auth:** JWT (phone-based for customers, email+password for staff)

### API Structure
- `/api/auth/*` - Authentication endpoints
- `/api/medicines` - Medicine CRUD
- `/api/pharmacies` - Pharmacy management
- `/api/orders` - Order management
- `/api/pharmacist/*` - Pharmacist actions
- `/api/pharmacy/*` - Pharmacy staff actions
- `/api/ops/*` - Operations read-only views

---

## Next Action Items
1. Add more sample medicines to test different bucket workflows
2. Create pharmacy and pharmacy_staff accounts to test fulfillment
3. Test complete order flow from customer to delivery
4. Implement PDF invoice generation (currently HTML)
5. Add order history export functionality
