# ElectionDesk — Security Threat Model & Risk Register

**Standard:** STRIDE Framework & OWASP Application Security Verification Standard (ASVS 4.0)  
**Sensitivity Classification:** High Assurance (Electoral Roll & Citizen Identity Data)

---

## 1. System Assets & Security Boundaries

1. **Voter PII Records:** Names, EPIC Roll IDs, relationships, dates of birth, residential addresses, booth allocations.
2. **Citizen Portraits:** Private biometric image files stored in encrypted private volumes.
3. **Privileged Credentials:** Administrator password hashes, MFA base32 secrets, session cookies.
4. **Audit Log Trail:** Historical immutable records of all state modifications and exports.
5. **Database Connection:** Private MongoDB Atlas connection string and cryptographic keys.

---

## 2. STRIDE Threat Analysis & Implemented Mitigations

| STRIDE Category | Threat Scenario | Technical Mitigation in ElectionDesk | Residual Risk |
| :--- | :--- | :--- | :--- |
| **Spoofing (Identity)** | Credential stuffing against staff accounts using leaked public databases. | - Argon2id password hashing (64MB memory, 3 iterations, 4 parallelism).<br>- Mandatory TOTP MFA (authenticator app) for administrative tiers.<br>- Progressive account lockout after 5 consecutive failed attempts. | Low |
| **Tampering (Data Integrity)** | Malicious internal operator modifying electoral roll records or deleting duplicate flags. | - Granular RBAC: Only Super Admin and Data Admin can approve duplicates.<br>- Cryptographic SHA-256 hash chaining of audit logs: any database tampering breaks the audit chain.<br>- Server-side change diff tracking. | Low |
| **Repudiation** | An operator exports sensitive records and denies having done so. | - Immutable audit trail records actor ID, email, role, UTC timestamp, source IP, user agent, and query parameters.<br>- Step-up authentication requires password confirmation immediately prior to export. | Low |
| **Information Disclosure** | Attackers exploiting NoSQL injection or IDOR to scrape entire voter directory. | - Strict Mongoose typed schemas & input sanitization stripping `$`, `.`.<br>- Escaped regex tokens to prevent ReDoS.<br>- Role-based field projection & 5,000 row hard limits on exports.<br>- Private image serving endpoint with role authorization. | Low |
| **Denial of Service (DoS)** | Layer 7 volumetric request flooding or large CSV upload memory exhaustion. | - Dual-layer rate limiting (Cloudflare Edge + Express Rate Limiter).<br>- Bounded JSON parser body size (10MB maximum).<br>- File stream processing with Multer memory caps and Sharp image dimension bounds. | Low |
| **Elevation of Privilege** | Data Entry Operator accessing user management or escalating their role to Super Admin. | - Backend RBAC middleware (`requireRole`) validated independently on every endpoint (not reliant on UI hiding).<br>- Role updates require valid `x-step-up-token` with Super Admin password re-verification. | Low |

---

## 3. Risk Register

| Risk ID | Vulnerability / Threat | Likelihood | Impact | Severity | Mitigation Strategy | Owner |
| :--- | :--- | :---: | :---: | :---: | :--- | :--- |
| **RSK-01** | Compromise of single administrative account via phishing. | Medium | High | High | Require TOTP MFA + Step-up auth for sensitive exports and role changes. Auto-lock after 5 failed attempts. | SecOps Team |
| **RSK-02** | CSV Formula Injection (Spreadsheet Execution) on exported roll files. | Low | High | Medium | Prefix all exported cells starting with `=`, `+`, `-`, `@`, `\t`, `\r` with a single quote `'`. Neutralizes formula parsing. | Engineering |
| **RSK-03** | Malicious photo upload containing web shell or embedded GPS metadata. | Low | High | Medium | Validate magic bytes (JPEG/PNG/WebP). Re-encode with Sharp and strip all EXIF / GPS metadata before private storage. | Engineering |
| **RSK-04** | Accidental exposure of database port to public internet. | Low | Critical | High | MongoDB Atlas VPC peering / Private Link only. Docker network binds to internal bridge with no exposed database port. | Cloud Infra |
| **RSK-05** | Audit log tampering by rogue database administrator. | Low | Critical | High | SHA-256 hash chaining (blockchain-style sequential validation). Discontinuity alerts triggered via `/audit-logs/verify-chain`. | Compliance |
