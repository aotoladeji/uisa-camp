# 🏆 UI Sports Academy — 2026 Summer Sports Camp Platform

A complete registration, payment, and administration platform for the **University of Ibadan Sports Academy 2026 Summer Sports Camp**.

---

## Architecture

```
uisa-camp/
├── server/               ← Node.js + Express API
│   ├── db/
│   │   ├── schema-postgres.sql ← Full PostgreSQL schema
│   │   └── pool.js       ← DB connection pool
│   ├── middleware/
│   │   ├── auth.js       ← JWT authentication
│   │   ├── upload.js     ← Multer file uploads
│   │   └── email.js      ← Nodemailer email templates
│   ├── routes/
│   │   ├── auth.js       ← Admin login / user management
│   │   ├── applicants.js ← Registration + admin CRUD
│   │   └── payments.js   ← Receipt upload + verification
│   ├── .env.example      ← Environment variable template
│   ├── app.js            ← Express app (importable for tests)
│   └── index.js          ← Express entry point
│
└── client/               ← React frontend
    └── src/
        ├── pages/
        │   ├── HomePage.js       ← Public landing page
        │   ├── RegisterPage.js   ← 7-step registration form
        │   ├── PaymentPage.js    ← Receipt upload
        │   ├── StatusPage.js     ← Application status check
        │   └── admin/
        │       ├── AdminLogin.js        ← Login
        │       ├── AdminLayout.js       ← Sidebar shell
        │       ├── AdminDashboard.js    ← Charts + stats
        │       ├── AdminApplicants.js   ← Applicant list
        │       ├── AdminApplicantDetail.js ← Full profile + status update
        │       ├── AdminPayments.js     ← Payment verification
        │       └── AdminUsers.js        ← Admin user management
        ├── context/AuthContext.js
        └── utils/api.js
```

---

## Prerequisites

| Tool        | Version  |
|-------------|----------|
| Node.js     | ≥ 18.x   |
| npm         | ≥ 9.x    |
| PostgreSQL  | 14+      |

---

## Quick Setup

### 1. Database

Create a PostgreSQL database named `uisa_camp` and grant your app user table/trigger privileges.

The server auto-initializes all required tables/triggers from `server/db/schema-postgres.sql` on startup.

Example:

```sql
CREATE DATABASE uisa_camp;
```

### 2. Server Environment

```bash
cd server
cp .env.example .env
```

Edit `.env` with your values:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=uisa_camp
DB_SCHEMA=uisa_app
DB_SSL=false

JWT_SECRET=your_very_long_random_secret_here

SMTP_HOST=smtp.gmail.com
SMTP_USER=uisportsacademy@gmail.com
SMTP_PASS=your_gmail_app_password

CLIENT_URL=http://localhost:3000
```

> **Gmail setup:** Enable 2FA on your Gmail account, then create an App Password at myaccount.google.com/apppasswords

### 3. Install & Run

```bash
# From project root
npm run install:all

# Starts backend (5000) + frontend (3000)
npm run dev

# Optional: run API smoke tests
npm run test:server
```

---

## Default Admin Login

| Field    | Value                          |
|----------|--------------------------------|
| Username | Admin                          |
| Password | admin123                       |

> **Change this immediately** after first login via Admin Users → Create Admin.

---

## Features

### Public Portal
- **Landing page** with camp info, sports, payment details, contacts
- **7-step registration form** (Personal → Sport → Guardian → Academic → Medical → Consent → Review)
- **Payment receipt upload** with bank transfer instructions
- **Status checker** — applicant tracks progress by form number + email

### Admin Portal (`/admin`)
- **Dashboard** — live stats cards + pie/bar charts (recharts)
- **Applicants** — searchable/filterable table, full profile view, status updates with email notifications
- **Payments** — verify or reject receipts, inline preview for image receipts
- **Admin Users** — create/deactivate admins, role management (super_admin / admin / verifier)

### Email Notifications
Automated emails sent on:
1. Registration confirmed (with payment instructions)
2. Receipt uploaded (under review)
3. Payment verified ✅
4. Admitted 🏆
5. Rejected

---

## API Endpoints

### Public
| Method | Path                          | Description               |
|--------|-------------------------------|---------------------------|
| POST   | /api/applicants               | Submit registration       |
| GET    | /api/applicants/lookup        | Check status by form+email|
| POST   | /api/payments/submit          | Upload payment receipt     |

### Admin (requires Bearer token)
| Method | Path                          | Description               |
|--------|-------------------------------|---------------------------|
| POST   | /api/auth/login               | Admin login               |
| GET    | /api/auth/me                  | Current admin info        |
| GET    | /api/applicants               | List applicants (filter)  |
| GET    | /api/applicants/:id           | Full applicant detail     |
| PATCH  | /api/applicants/:id/status    | Update status + assignments|
| GET    | /api/applicants/stats/summary | Dashboard stats           |
| GET    | /api/payments                 | List payments             |
| PATCH  | /api/payments/:id/verify      | Verify or reject payment  |
| GET    | /api/auth/admins              | List admins (super_admin) |
| POST   | /api/auth/create-admin        | Create admin (super_admin)|
| PATCH  | /api/auth/admins/:id          | Deactivate/change role    |

---

## Payment Flow

```
1. Applicant registers → gets form number + email
2. Applicant makes bank transfer to Access Bank 1805832892
   - Narration: "Name SPORT" (e.g. "John Adeyemi Football")
   - ₦207,000 (Early Bird, before July 3) | ₦230,000 (Regular)
3. Applicant uploads receipt via /payment page
4. Admin reviews receipt in Payments tab → Verify or Reject
5. On verify: applicant status → "Payment Verified" + email sent
6. Admin reviews full application → Admits or Rejects
7. On Admit: room/group/coach assigned + admission email sent
```

---

## Database Tables

| Table         | Purpose                          |
|---------------|----------------------------------|
| applicants    | All registration data (Sections A–H) |
| payments      | Receipt uploads + verification   |
| admin_users   | Portal access with roles         |
| audit_log     | Admin action history             |
| notifications | Email send log                   |

---

## Deployment (Production)

```bash
# 1) Build frontend release package
# Point frontend to your hosted backend API before build
set REACT_APP_API_URL=https://api.yourdomain.com/api
npm run release:build

# 2) Deploy frontend package to S3 bucket
# Option A: use env var
set S3_BUCKET=your-bucket-name
npm run release:s3 -- --region us-east-1 --website

# Option B: pass bucket directly
npm run release:s3 -- --bucket your-bucket-name --region us-east-1 --website
```

Notes:
- Frontend output is published from `release/web`.
- `--website` configures S3 website index and error documents to `index.html` for SPA routing.
- For CloudFront private-bucket setups, use custom error responses (`403/404 -> /index.html`) instead of S3 website mode.

Backend API is not static and cannot run on S3. Host backend separately (EC2, ECS, Render, Railway, etc):

```bash
pm2 start server/index.js --name uisa-server
```

Backend environment:

```bash
NODE_ENV=production
CLIENT_URL=https://your-frontend-domain
PORT=5000
```

---

## Camp Details

| Detail       | Info                                           |
|--------------|------------------------------------------------|
| Dates        | August 3 – 28, 2026                            |
| Venue        | International School, University of Ibadan      |
| Fee          | ₦230,000 / child (₦207,000 early bird)         |
| Bank         | Access Bank — 1805832892                       |
| Account Name | University of Ibadan MacArthur Grants          |
| Early Bird   | 10% off before July 3, 2026                    |
| Deadline     | July 25, 2026                                  |
| Sports       | Football, Basketball, Athletics, Swimming, Tennis |
| Ages         | 6–17 (Junior) · 18–23 (Elite)                  |

---

*…Developing Champions in Sports & Character*
