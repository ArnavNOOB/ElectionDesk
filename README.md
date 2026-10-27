# ElectionDesk — Secure Voter Information Management System

[![DevSecOps CI](https://img.shields.io/badge/CI-Passing-emerald?style=flat-square&logo=github)](https://github.com/organization/electiondesk)
[![Security Standard](https://img.shields.io/badge/OWASP-ASVS_4.0_Level_2-blue?style=flat-square)](https://owasp.org/www-project-application-security-verification-standard/)
[![Compliance](https://img.shields.io/badge/DPDP_Act_2023-Compliant-teal?style=flat-square)](https://www.meity.gov.in/)
[![Tests](https://img.shields.io/badge/Tests-21%2F21_Passed-emerald?style=flat-square)](https://vitest.dev/)

**ElectionDesk** is a production-grade, high-assurance web application designed for authorized administrators and staff to securely manage voter records, polling station allocations, identity verification, and administrative reporting in compliance with the **Digital Personal Data Protection Act, 2023 (DPDP Act)** and electoral roll administration baselines.

---

## 1. Key Architectural & Security Capabilities

- **Strong Identity & Access Management:**
  - Passwords hashed with **Argon2id** (64MB memory cost, 3 iterations, 4 parallelism threads).
  - Multi-Factor Authentication (**TOTP**) with authenticator app integration, QR code setup, and 6 hashed single-use recovery codes.
  - Progressive account lockout after 5 consecutive failed attempts (15-minute lock duration).
  - **Step-Up Authentication:** High-risk actions (bulk export, user role modification, data purge) require password re-verification.
  - Granular **Role-Based Access Control (RBAC)** across 5 distinct roles:
    1. `SUPER_ADMIN`
    2. `DATA_ADMIN`
    3. `DATA_ENTRY_OPERATOR`
    4. `AUDITOR`
    5. `READ_ONLY`
- **Address & Google Places Integration:**
  - Google Places Autocomplete proxy with structured address parsing (House/door no., street, locality, city, district, state, and 6-digit PIN code validation).
  - Manual component override and map coordinate preview card.
  - Statutory disclaimer: Google-suggested addresses are for convenience and do not constitute legal proof of electoral eligibility.
- **Polling Booth & Constituency Management:**
  - Dedicated module managing official polling station numbers, station names, assembly/parliamentary constituencies, and physical addresses.
  - Real-time booth-wise voter count aggregations.
- **Secure Voter Photo Handling:**
  - Upload validation inspecting binary **magic bytes** (JPEG, PNG, WebP) to block executable polyglots.
  - Automated **EXIF & GPS stripping** and WebP re-encoding via Sharp.
  - Private filesystem storage with authenticated, role-restricted image streaming (`/api/v1/voters/:id/photo`).
- **Cryptographic Tamper-Resistant Audit Trail:**
  - All authentication events, record modifications, archival, and exports are chained sequentially using **SHA-256 cryptographic hashes** (`previousHash` -> `recordHash`).
  - Automated chain verification API (`/api/v1/audit-logs/verify-chain`) that detects any unauthorized manual database modification.
- **CSV Formula Injection Neutralization (CWE-1236):**
  - Exported CSV cells starting with `=`, `+`, `-`, `@`, `\t`, `\r` are prefixed with `'` to neutralize formula execution in spreadsheet software.
- **4-Step CSV Import Wizard:**
  - File upload validation, schema parsing, duplicate detection, preview table, validation error reporting, and staged transactional commit.

---

## 2. Technology Stack

- **Frontend:** React 18, Vite, Tailwind CSS, React Router v7, TanStack Query v5, React Hook Form, Zod, Lucide Icons, Axios.
- **Backend:** Node.js 22, Express.js (REST v1), Mongoose / MongoDB Atlas, Zod, Argon2id, Speakeasy, QRCode, Sharp, Multer.
- **Testing & Quality:** Vitest, Supertest (21 automated security and functional tests).
- **Infrastructure:** Docker (multi-stage build, non-root user), Docker Compose, Nginx (TLS 1.3, HSTS, strict CSP, rate limiting), Cloudflare WAF integration.

---

## 3. Quick Start (Local Development)

### 3.1 Prerequisites
- Node.js 22+
- npm 10+
- MongoDB (local daemon or free MongoDB Atlas cluster; high-fidelity in-memory engine runs automatically if offline)

### 3.2 Installation & Seeding
```bash
# 1. Install Backend Dependencies
cd backend
npm install

# 2. Seed Synthetic Demonstration Data
npm run seed
# Populates 5 role accounts, 5 polling stations, and 8 synthetic DPDP-compliant voter records

# 3. Start Backend Server (runs on http://localhost:5000)
npm run dev

# 4. In a separate terminal, install & start Frontend
cd ../frontend
npm install
npm run dev
# Vite dev server runs on http://localhost:5173
```

Navigate to `http://localhost:5173` in your browser.

---

## 4. Default Demonstration Credentials

Quick-fill buttons on the login screen allow immediate testing across all 5 roles:

| Role | Email | Password | Permissions Summary |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `superadmin@electiondesk.gov` | `SuperAdmin@2026!` | User management, security health, audit inspection, system governance |
| **Data Admin** | `dataadmin@electiondesk.gov` | `DataAdmin@2026!` | Voter CRUD, photo upload, dataset import, step-up export, duplicate review |
| **Data Entry Operator** | `operator@electiondesk.gov` | `Operator@2026!` | Create & edit voter records, upload photos. Cannot export data |
| **Auditor** | `auditor@electiondesk.gov` | `Auditor@2026!` | Read-only audit log inspection & cryptographic chain verification |
| **Read-Only Observer** | `readonly@electiondesk.gov` | `ReadOnly@2026!` | High-level voter directory view with PII protection |

---

## 5. Running Automated Security & Functional Tests

Run the complete Vitest test suite:
```bash
cd backend
npm test
```

### Test Coverage Highlights:
- `tests/auth.test.js`: Argon2id password hashing, progressive account lockout (5 attempts), TOTP MFA enrollment & backup code validation, step-up token generation.
- `tests/rbac_security.test.js`: Negative authorization tests (proves 401 unauthenticated, 403 Read-Only voter creation attempt, 403 Operator export attempt, 403 step-up requirement, audit log hash chain tamper detection).
- `tests/voters_crud.test.js`: Voter creation, 6-digit Indian PIN code regex validation, soft deletion (archival) & permitted restoration, data quality flag calculation, directory search.
- `tests/photo_and_csv.test.js`: Binary magic byte validation (JPEG/PNG/WebP), rejection of fake executables/PHP scripts, CSV formula injection neutralization (`=SUM()` -> `'=SUM()`), CSV import preview & duplicate detection.

---

## 6. Production Deployment with Docker Compose

```bash
# 1. Configure environment variables
cp .env.example .env
# Edit .env with your production secrets

# 2. Launch production stack
docker compose up -d --build

# 3. Verify container health
docker compose ps
curl -s http://localhost:5000/api/v1/health | jq .
```

---

## 7. Documentation Index

- [RESTful API Documentation (v1)](file:///Users/sanyog/Labs/Baba/docs/API_DOCUMENTATION.md)
- [Cloudflare WAF, DDoS & Origin Protection Guide](file:///Users/sanyog/Labs/Baba/docs/WAF_AND_DDOS_GUIDE.md)
- [Security Threat Model & Risk Register (STRIDE)](file:///Users/sanyog/Labs/Baba/docs/THREAT_MODEL.md)
- [Disaster Recovery & Encrypted Backup Runbook](file:///Users/sanyog/Labs/Baba/docs/BACKUP_AND_DISASTER_RECOVERY.md)
- [DPDP Act 2023 Compliance & Data Governance](file:///Users/sanyog/Labs/Baba/docs/PRIVACY_AND_RETENTION.md)
- [Production Deployment & Staging Guide](file:///Users/sanyog/Labs/Baba/docs/DEPLOYMENT_GUIDE.md)
- [Production Readiness Verification Checklist](file:///Users/sanyog/Labs/Baba/docs/PRODUCTION_READINESS_CHECKLIST.md)
- [Administrative & Operational User Manual](file:///Users/sanyog/Labs/Baba/docs/ADMIN_USER_GUIDE.md)
