# Disaster Recovery, Encrypted Backup, and Incident Response Runbook

This runbook defines operational recovery objectives, automated backup schedules, isolated restoration procedures, and incident response workflows for the **ElectionDesk** system.

---

## 1. Operational Recovery Objectives

- **Recovery Point Objective (RPO):** ≤ 15 minutes. (Maximum permissible data loss in the event of catastrophic primary cluster failure).
- **Recovery Time Objective (RTO):** ≤ 60 minutes. (Maximum permissible downtime before full system restoration in secondary availability zone).

---

## 2. Automated Encrypted Backup Strategy

### 2.1 MongoDB Atlas Automated Snapshots
1. **Continuous Point-in-Time Recovery (PITR):**
   - MongoDB Atlas continuous oplog streaming enabled.
   - Retains 7-day granular point-in-time recovery to any second.
2. **Scheduled Encrypted Snapshots:**
   - **Hourly Snapshots:** Retained for 48 hours.
   - **Daily Snapshots:** Encrypted with AWS KMS / GCP KMS customer-managed key (CMK); retained for 30 days.
   - **Monthly Snapshots:** Cold storage, write-once-read-many (WORM) compliance vault; retained for 5 years per statutory mandate.
3. **Voter Portrait Storage Backups:**
   - Object storage cross-region replication (CRR) enabled with versioning and immutable lock.

---

## 3. Isolated Restoration Verification Runbook

Restoration procedures must be tested monthly in an isolated staging VPC without access to production networks:

### Step 1: Provision Isolated Test Environment
```bash
# Provision isolated target container on isolated Docker bridge
docker run -d --name mongo_recovery_test \
  --network none \
  -v /var/data/recovery_test:/data/db \
  mongo:7.0 --bind_ip 127.0.0.1
```

### Step 2: Download and Decrypt Latest Verified Snapshot
```bash
# Fetch encrypted snapshot from backup bucket using dedicated KMS role
aws kms decrypt --ciphertext-blob fileb://snapshot_20261025.enc \
  --output text --query Plaintext | base64 -d > /tmp/snapshot.tar.gz

tar -xzvf /tmp/snapshot.tar.gz -C /tmp/dump/
```

### Step 3: Execute Restoration via `mongorestore`
```bash
mongorestore --host 127.0.0.1:27017 \
  --drop \
  --dir /tmp/dump/electiondesk/ \
  --numParallelCollections 4
```

### Step 4: Validate Database & Cryptographic Audit Chain
```bash
# Run integrity verification script
cd backend && npm run test
```
Verify that `verifyAuditChainIntegrity()` returns `{ valid: true }`.

---

## 4. Security Incident Response & Account Containment

### 4.1 Incident Severity Classification

| Level | Definition | Response SLA |
| :--- | :--- | :--- |
| **P1 - CRITICAL** | Active compromise of database credentials, unencrypted data exfiltration, or unauthorized mass role elevation. | **< 15 minutes** |
| **P2 - HIGH** | Brute-force account lockout against administrative user, repeated step-up authentication failures, or WAF bypass. | **< 1 hour** |
| **P3 - MEDIUM** | Rate limit anomaly, suspicious photo upload attempt (blocked), or repeated validation rejections. | **< 4 hours** |
| **P4 - LOW** | Minor cosmetic defect or single unexpected 500 error. | **< 24 hours** |

### 4.2 Account & Session Revocation Procedure
If a staff credential is suspected of compromise:
1. **Immediate Revocation via Super Admin Dashboard:**
   - Navigate to `/users` → Select affected user → Click **"Suspend"**.
   - This immediately increments `sessionVersion`, invalidating all active JWT tokens and HttpOnly session cookies across all devices.
2. **Reset MFA Token:**
   - Click **"Reset MFA"** to erase the compromised TOTP secret key and burn all active backup codes.
3. **Database-Level Force Lockout:**
   ```javascript
   db.users.updateOne(
     { email: "compromised_user@electiondesk.gov" },
     { $set: { isActive: false, lockUntil: new Date(Date.now() + 86400000 * 30), sessionVersion: 9999 } }
   );
   ```

### 4.3 Statutory Breach Notification (DPDP Act, 2023)
Under the provisions of the Digital Personal Data Protection Act, 2023:
1. The Data Protection Officer (DPO) must be notified immediately upon confirmation of unauthorized personal data disclosure.
2. An assessment of impacted data categories (e.g. citizen names, addresses, EPIC roll numbers) must be compiled.
3. The Data Protection Board of India and affected data principals must be formally notified within statutory timelines (72 hours).
