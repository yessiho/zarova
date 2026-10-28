# Zarova — Fintech Platform

A production-deployed full-stack fintech platform built as a portfolio project.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-zarova.vercel.app-0f4c81?style=flat-square)](https://zarova.vercel.app)
[![API Docs](https://img.shields.io/badge/API%20Docs-Swagger-85EA2D?style=flat-square)](https://zarova-api.onrender.com/api)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org)
[![NestJS](https://img.shields.io/badge/NestJS-12-E0234E?style=flat-square&logo=nestjs)](https://nestjs.com)
[![Next.js](https://img.shields.io/badge/Next.js-16-000?style=flat-square&logo=next.js)](https://nextjs.org)

---

## What it is

Zarova is a fintech platform that handles multi-wallet management, peer-to-peer transfers, external payments via Paystack, double-entry accounting, compliance workflows, and full admin operations — built the way a real financial product would be.

**Demo credentials**

| Role | Email | Password |
|------|-------|----------|
| User | `amara.okafor@demo.zarova.com` | `Demo@1234` |
| Admin | `admin@zarova.com` | `Admin@1234` |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser                                                        │
│  Next.js 16 (React 19) — Vercel                                 │
│  zarova.vercel.app                                              │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTPS / WebSocket
┌──────────────────────────▼──────────────────────────────────────┐
│  NestJS 12 API — Render                                         │
│  zarova-api.onrender.com                                        │
│                                                                 │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │  Auth       │  │  RBAC        │  │  WebSocket Gateway     │ │
│  │  JWT + 2FA  │  │  10 roles    │  │  socket.io /notifs     │ │
│  │  TOTP       │  │  52 perms    │  └────────────────────────┘ │
│  └─────────────┘  └──────────────┘                             │
│                                                                 │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │  Wallets    │  │  Ledger      │  │  Paystack              │ │
│  │  NGN/USD    │  │  Double-     │  │  Webhook               │ │
│  │  /EUR/GBP   │  │  entry       │  │  HMAC-SHA512           │ │
│  └─────────────┘  └──────────────┘  └────────────────────────┘ │
│                                                                 │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │  KYC        │  │  Compliance  │  │  Email                 │ │
│  │  Cloudinary │  │  Risk        │  │  Nodemailer            │ │
│  │  upload     │  │  Alerts      │  │  HTML templates        │ │
│  └─────────────┘  └──────────────┘  └────────────────────────┘ │
└──────────────────────────┬──────────────────────────────────────┘
                           │ Prisma 8
┌──────────────────────────▼──────────────────────────────────────┐
│  PostgreSQL 16                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Stack

| Layer | Technology |
|-------|-----------|
| Backend | NestJS 12 · TypeScript 5 · Prisma 8 (contract-first ORM) |
| Database | PostgreSQL 16 |
| Frontend | Next.js 16 · React 19 · Tailwind CSS 4 |
| Auth | JWT (15 min) · 2FA/TOTP (RFC 6238) · bcrypt |
| Access control | RBAC — 10 roles, 52 fine-grained permissions |
| Payments | Paystack — wallet funding, HMAC-SHA512 webhooks |
| File upload | Cloudinary — KYC document images |
| Real-time | Socket.IO — live in-app notification push |
| Email | Nodemailer — HTML email templates |
| Testing | Jest 30 — unit tests for AuthService, RbacService |
| CI/CD | GitHub Actions — lint → test → build pipeline |
| Deployment | Render (API) · Vercel (frontend) |

---

## Features

### User portal
- Register, log in, forgot/reset password with email link
- Two-factor authentication (TOTP via Google Authenticator)
- Multi-currency wallets (NGN, USD, EUR, GBP)
- Peer-to-peer transfers with double-entry ledger
- Fund wallet via Paystack (card/bank transfer)
- Bill payments (airtime, data, electricity, cable, internet)
- KYC submission with real document upload (Cloudinary)
- In-app notifications + real-time WebSocket push
- Webhook registration with HMAC-SHA256 signing
- Audit trail for all financial actions

### Admin portal
- Role-based access control (RBAC) with 10 role types
- Dashboard with live charts (transaction volume, user growth)
- Customer management (view, suspend, activate)
- Transaction oversight and reversal
- Payment approval workflow
- Compliance case management
- Risk alert review
- KYC document review and approval
- Double-entry ledger reconciliation
- System settings management
- Full audit log

---

## Key technical decisions

**Why Prisma 8 (contract-first)?**  
Prisma 8 inverts the traditional schema-first flow — you write a `contract.prisma` file, and Prisma emits the TypeScript types and migration plan. This separates intent (the contract) from implementation (migrations), making schema evolution explicit and reviewable.

**Why double-entry ledger?**  
A simple `balance` column is not auditable. Every financial movement creates two ledger entries that always net to zero, so any discrepancy is immediately detectable. The `reconciliation` module verifies this invariant.

**Why RBAC over simple role flags?**  
The admin portal needs fine-grained control — a Compliance Officer should see KYC but not modify system settings. The guard chain (`JwtAuthGuard → type check → RbacGuard`) checks each required permission against the admin's assigned roles in the DB, so access rules are data-driven and auditable.

**WebSocket authentication:**  
The Socket.IO gateway verifies a JWT passed in `socket.handshake.auth.token` on connection. Invalid tokens disconnect immediately. Each authenticated socket joins a private room (`user:<id>`) so server pushes are user-scoped.

---

## Running locally

```bash
# 1. Install
npm install

# 2. Set env vars
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local

# 3. API (http://localhost:3001 — Swagger at /api)
cd apps/api && npm run start:dev

# 4. Frontend (http://localhost:3000)
cd apps/web && npm run dev
```

**Minimum required env vars (API):**

```env
DATABASE_URL=postgresql://...
JWT_SECRET=change-me-in-production
FRONTEND_URL=http://localhost:3000
```

**Optional** (features degrade gracefully when absent):

```env
# Email
EMAIL_HOST=smtp.resend.com
EMAIL_PORT=587
EMAIL_USER=resend
EMAIL_PASS=re_...
EMAIL_FROM=Zarova <noreply@zarova.com>

# Cloudinary (KYC upload)
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

# Paystack
PAYSTACK_SECRET_KEY=sk_live_...
PAYSTACK_WEBHOOK_SECRET=...
```

---

## Project structure

```
zarova/
├── apps/
│   ├── api/                  NestJS 12 backend
│   │   └── src/
│   │       ├── auth/         JWT auth, 2FA, TOTP
│   │       ├── rbac/         Roles, permissions, guard
│   │       ├── wallets/      Multi-currency wallets
│   │       ├── transactions/ Transfers, deposits
│   │       ├── ledger/       Double-entry accounting
│   │       ├── kyc/          Identity verification
│   │       ├── notifications/ In-app + WebSocket push
│   │       ├── paystack/     Payment gateway
│   │       ├── upload/       Cloudinary file upload
│   │       ├── seed/         Demo data (first boot)
│   │       └── ...           compliance, risk, audit, reports
│   └── web/                  Next.js 16 frontend
│       └── src/
│           ├── app/(dashboard)/   User portal pages
│           ├── app/(admin)/       Admin portal pages
│           ├── components/        Reusable UI components
│           ├── hooks/             useNotificationSocket
│           └── lib/               API client, auth session
└── packages/
    └── types/                Shared TypeScript types
```

---

## Testing

```bash
cd apps/api
npm test           # Run all unit tests
npm run test:cov   # With coverage report
```

Covers: `AuthService` (user login, admin login, register, forgot-password) and `RbacService` (requireAdmin, getAdminPermissions, requirePermission).

---

## CI/CD

GitHub Actions runs on every push to `main`:

1. **Lint** — oxlint
2. **Test** — Jest with PostgreSQL service container
3. **Build** — `nest build` + `next build`

Render auto-deploys the API; Vercel auto-deploys the frontend.

---

## Author

Built by **Peter** as a portfolio project demonstrating production-quality fintech engineering.
