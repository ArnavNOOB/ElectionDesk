# ElectionDesk RESTful API Specification (v1)

**Base URL:** `/api/v1`  
**Protocol:** HTTPS / TLS 1.3  
**Content-Type:** `application/json` (except file uploads/exports)  
**Authentication:** Bearer JWT in `Authorization` header or HttpOnly `session_token` cookie.  
**Elevation Header:** `x-step-up-token` for privileged operations (bulk export, role modification).

---

## 1. Authentication & Identity (`/auth`)

### `POST /auth/login`
Authenticates user with email and Argon2id hashed password. Enforces 5-attempt progressive lockout.
- **Request Body:**
  ```json
  {
    "email": "dataadmin@electiondesk.gov",
    "password": "DataAdmin@2026!"
  }
  ```
- **Response (200 OK - No MFA):**
  ```json
  {
    "success": true,
    "message": "Authentication successful",
    "data": {
      "mfaRequired": false,
      "token": "eyJhbGciOiJIUzI1Ni...",
      "user": {
        "id": "67b8...",
        "email": "dataadmin@electiondesk.gov",
        "fullName": "Priya Sharma",
        "role": "DATA_ADMIN",
        "mfaEnabled": false
      }
    }
  }
  ```
- **Response (200 OK - MFA Challenge Required):**
  ```json
  {
    "success": true,
    "data": {
      "mfaRequired": true,
      "tempToken": "eyJhbGciOiJIUzI1Ni...",
      "user": { "id": "67b8...", "email": "admin@..." }
    }
  }
  ```

### `POST /auth/mfa/verify`
Submits 6-digit TOTP passcode or single-use emergency backup code.
- **Request Body:**
  ```json
  {
    "tempToken": "eyJhbGciOiJIUzI1Ni...",
    "tokenOrBackupCode": "123456"
  }
  ```

### `POST /auth/mfa/setup` *(Auth required)*
Generates a new TOTP secret key, QR code Data URL, and 6 hashed backup recovery codes.

### `POST /auth/step-up` *(Auth required)*
Issues a 10-minute step-up elevation token (`x-step-up-token`) after password re-verification.

### `GET /auth/me` *(Auth required)*
Retrieves current authenticated profile (excluding password hashes and MFA secrets).

### `POST /auth/logout` *(Auth required)*
Revokes active session cookie and produces a cryptographic audit event.

---

## 2. Voter Records Management (`/voters`)

### `GET /voters` *(Auth: All Roles)*
Lists paginated voter directory records.
- **Query Parameters:**
  - `page` (default: 1)
  - `limit` (default: 20, max: 100)
  - `search` (string: name, EPIC ID, locality)
  - `pollingStationId` (ObjectId)
  - `verificationStatus` (`Verified`, `Pending_Verification`, `Flagged_Duplicate`, `Disputed`)
  - `hasPhoto` (boolean)
  - `isArchived` (boolean, default: false)
  - `sortField` (`createdAt`, `fullName`, `epicNumber`)
  - `sortOrder` (`asc`, `desc`)

### `POST /voters` *(Auth: SUPER_ADMIN, DATA_ADMIN, DATA_ENTRY_OPERATOR)*
Creates a new voter record with strict schema validation.
- **Request Body:**
  ```json
  {
    "epicNumber": "BLR1049281",
    "fullName": "Aarav Rajesh Patel",
    "relativeName": "Rajesh Patel",
    "relationType": "Father",
    "gender": "Male",
    "age": 34,
    "address": {
      "houseNumber": "42/A",
      "street": "12th Main Road",
      "locality": "Indiranagar",
      "city": "Bengaluru",
      "district": "Bengaluru Urban",
      "state": "Karnataka",
      "pinCode": "560038",
      "verified": true
    },
    "pollingStationId": "67b8a1c9...",
    "verificationStatus": "Pending_Verification"
  }
  ```

### `GET /voters/:id` *(Auth: All Roles)*
Retrieves full voter record with populated polling station information.

### `PUT /voters/:id` *(Auth: SUPER_ADMIN, DATA_ADMIN, DATA_ENTRY_OPERATOR)*
Updates permitted fields. Automatically tracks change diff and creates audit log.

### `POST /voters/:id/archive` *(Auth: SUPER_ADMIN, DATA_ADMIN)*
Soft-deletes record under the approved 90-day retention policy.

### `POST /voters/:id/restore` *(Auth: SUPER_ADMIN, DATA_ADMIN)*
Restores an archived record back to active electoral roll.

### `POST /voters/check-duplicates` *(Auth: Admins & Operators)*
Evaluates potential duplicate candidates using name similarity, relative name, and address.

---

## 3. Secure Voter Photo Management (`/voters/:id/photo`)

### `POST /voters/:id/photo` *(Auth: Admins & Operators)*
Uploads an image file (`multipart/form-data`).
- Inspects magic bytes (JPEG/PNG/WebP). Rejects polyglots and executables.
- Sharp strips all EXIF metadata and embedded GPS coordinates.
- Re-encodes to standardized WebP format in private storage.

### `GET /voters/:id/photo` *(Auth: SUPER_ADMIN, DATA_ADMIN, DATA_ENTRY_OPERATOR, AUDITOR)*
Streams protected image with strict security headers:
- `Content-Type: image/webp`
- `Content-Disposition: inline; filename="voter_photo.webp"`
- `X-Content-Type-Options: nosniff`
- `Cache-Control: private, max-age=3600`

### `DELETE /voters/:id/photo` *(Auth: SUPER_ADMIN, DATA_ADMIN)*
Permanently purges voter portrait under statutory retention policies.

---

## 4. Polling Station Management (`/polling-stations`)

### `GET /polling-stations`
Lists officially verified polling stations.
### `GET /polling-stations/summary`
Calculates station counts, assigned electors, and average booth loading.
### `POST /polling-stations` *(Auth: SUPER_ADMIN, DATA_ADMIN)*
Registers a new official polling station.
### `PUT /polling-stations/:id` *(Auth: SUPER_ADMIN, DATA_ADMIN)*
Updates station metadata.

---

## 5. Secure Import & Export (`/import-export`)

### `POST /import-export/preview` *(Auth: SUPER_ADMIN, DATA_ADMIN)*
Validates uploaded CSV dataset (`multipart/form-data`).
- Returns row-by-row validation report, duplicates, and valid preview rows.

### `POST /import-export/commit` *(Auth: SUPER_ADMIN, DATA_ADMIN)*
Commits validated rows to database in a transactional batch.

### `GET /import-export/voters` *(Auth: SUPER_ADMIN, DATA_ADMIN + Step-Up Auth)*
Generates filtered CSV export.
- **Enforced Security:**
  - Requires `x-step-up-token` header.
  - CSV formula injection protection: all cells starting with `=`, `+`, `-`, `@` are prefixed with `'`.
  - Rate limited to 5 exports per 10 minutes.
  - Capped at 5,000 records.

---

## 6. Audit Trail & Verification (`/audit-logs`)

### `GET /audit-logs` *(Auth: SUPER_ADMIN, AUDITOR)*
Filters immutable audit logs by actor, action, entity, and outcome.

### `GET /audit-logs/verify-chain` *(Auth: SUPER_ADMIN, AUDITOR)*
Validates the cryptographic SHA-256 hash chaining of all audit records sequentially.

---

## 7. System Security & Health (`/security`)

### `GET /security/health` *(Auth: SUPER_ADMIN)*
Reports server uptime, database pool status, memory allocation, and unresolved threat alerts.

### `PATCH /security/events/:id/resolve` *(Auth: SUPER_ADMIN)*
Marks a security incident as resolved with actor attribution.

---

## 8. Address Verification & Places API (`/places`)

Official address lookup and autocomplete services with dedicated support for **Patiala, Punjab** administrative boundaries, assembly constituencies, and postal PIN codes (`147001` - `147004`).

### `GET /places/patiala` *(Auth required)*
Retrieves high-level administrative summary for Patiala district, Punjab, including parliamentary constituency (`13 - Patiala`), valid PIN codes, and covered assembly constituencies.

### `GET /places/patiala/localities` *(Auth required)*
Returns the master dataset of verified localities, administrative wards, and assembly constituencies in Patiala, Punjab (e.g. Model Town, Leela Bhawan, Urban Estate Phase 1 & 2, Punjabi University, Baradari Gardens, Tripuri, Thapar Campus).

### `GET /places/patiala/search` *(Auth required)*
Searches Patiala addresses by query, PIN code, or ward.
- Query parameters:
  - `query` (optional string): e.g. `Model Town`, `Leela Bhawan`, `Urban Estate`
  - `pinCode` (optional string): e.g. `147001`, `147002`, `147004`
  - `ward` (optional string): e.g. `Ward 14`, `Ward 23`

### `GET /places/autocomplete` *(Auth required)*
Google Places compatible autocomplete endpoint. Autocompletes addresses across India, with intelligent ranking and structured component parsing prioritizing Patiala, Punjab when queried.
- Query parameter: `input` (string, min 2 characters)

### `GET /places/details/:placeId` *(Auth required)*
Retrieves full structured address components (`houseNumber`, `street`, `locality`, `city`, `district`, `state`, `pinCode`, `latitude`, `longitude`, `verified`) for any selected place ID.

