# ElectionDesk — Administrative & Operational User Manual

This manual provides instructions for staff and administrators operating **ElectionDesk — Secure Voter Information Management System**.

---

## 1. User Roles & Account Profiles

ElectionDesk enforces 5 distinct roles with least-privilege access:

| Role | Operational Scope | Default Demo Credentials |
| :--- | :--- | :--- |
| **Super Administrator** | Full system configuration, user account management, role elevation, security threat resolution, immutable audit inspection. | `superadmin@electiondesk.gov` / `SuperAdmin@2026!` |
| **Data Administrator** | Complete voter CRUD operations, dataset imports, verified data exports (requires step-up auth), duplicate resolution. | `dataadmin@electiondesk.gov` / `DataAdmin@2026!` |
| **Data Entry Operator** | Create new records, edit assigned constituency records, upload voter photos. Cannot export data or manage user accounts. | `operator@electiondesk.gov` / `Operator@2026!` |
| **Auditor** | Independent read-only access to cryptographic audit logs, compliance reports, and system activity logs. Cannot modify records. | `auditor@electiondesk.gov` / `Auditor@2026!` |
| **Read-Only Observer** | High-level viewing of authorized directory records with sensitive identity fields redacted. | `readonly@electiondesk.gov` / `ReadOnly@2026!` |

---

## 2. Authentication & MFA Setup

1. **Sign In:** Navigate to `/login`. Enter your official email and password.
2. **Two-Factor Authentication Enrollment:**
   - On first login or via settings, navigate to MFA setup.
   - Scan the displayed QR code with your authenticator app (Google Authenticator, Microsoft Authenticator, or 1Password).
   - Record the 6 emergency backup codes in a secure offline location.
   - Enter the 6-digit TOTP passcode to confirm enrollment.
3. **Emergency Recovery:**
   - If your device is unavailable, click *"Lost device? Use emergency backup code"* on the verification screen and enter an unused backup code.

---

## 3. Voter Record Management Workflows

### 3.1 Adding a New Voter Record
1. Navigate to **Add Voter Record** (`/voters/new`).
2. **Section 1:** Enter the official EPIC ID, legal name, relative name, relationship type, gender, and age (minimum 18).
3. **Section 2 (Address Autocomplete):**
   - Type in the Google Places Autocomplete search box.
   - Select the matching street or landmark to auto-populate door number, street, city, district, state, and 6-digit PIN code.
   - If field corrections are needed, click *"Edit Components"* to adjust fields manually.
4. **Section 3 (Polling Booth):** Select the officially gazetted polling station for the voter's residence.
5. Click **"Save Voter Record"**. If a potential duplicate is detected, a warning banner will appear.

### 3.2 Secure Photo Upload
1. Open the voter's details page (`/voters/:id`).
2. Click **"Upload Voter Photo"**. Select a JPEG, PNG, or WebP portrait (< 5MB).
3. The server automatically validates binary magic bytes, strips embedded EXIF and GPS coordinates, re-encodes the image to WebP, and stores it in private storage.
4. Click the eye icon on the thumbnail to open the protected full-size preview.

### 3.3 Duplicate Review & Data Quality Queue
1. Navigate to **Data Quality & Duplicates** (`/data-quality`).
2. The queue highlights records flagged as potential duplicates based on identical names, relatives, or addresses.
3. Click **"Compare Matches"** to open a side-by-side inspection view.
4. Review the details and select either **"Verify as Legitimate"** (clears flag) or **"Confirm as Disputed"**.

### 3.4 Bulk Dataset Import Wizard
1. Navigate to **Import Wizard** (`/import`).
2. Download the sample CSV template to ensure your spreadsheet headers match:
   `EPIC_NO,FULL_NAME,RELATIVE_NAME,RELATION_TYPE,GENDER,AGE,HOUSE_NO,STREET,LOCALITY,WARD,CITY,DISTRICT,STATE,PIN_CODE,BOOTH_NUMBER`.
3. Upload your file. Step 2 generates a schema validation summary, checks for duplicates, and previews valid rows.
4. Click **"Confirm & Commit Records"** to execute a transactional batch insert.

### 3.5 Exporting Roll Data (Step-Up Authentication)
1. Navigate to **Export Center** (`/export`).
2. Select optional filters (Polling Booth, Verification Status).
3. Click **"Authorize & Download CSV"**.
4. When prompted by the **Step-Up Verification Dialog**, re-enter your account password.
5. Once verified, the sanitized CSV file (protected against CSV formula injection) will download immediately.
