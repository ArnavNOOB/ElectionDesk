# ElectionDesk — Staging and Production Deployment Guide

This guide describes how to provision, configure, and operate **ElectionDesk** in production environments.

---

## 1. Environment Separation Strategy

Maintain strict separation between Development, Staging, and Production tiers:
- **Development:** Local Docker Compose or sandbox with synthetic seed fixtures and In-Memory storage fallback.
- **Staging:** Exact replica of production infrastructure in an isolated VPC with simulated datasets for pre-release validation.
- **Production:** Hardened instances, customer-managed KMS encryption, MongoDB Atlas private networking, Cloudflare WAF, and automated backups.

---

## 2. Infrastructure Prerequisites

1. **Virtual Machines / Container Orchestrator:**
   - 2x Compute Nodes (Ubuntu 24.04 LTS or Amazon Linux 2023, 4 vCPU, 8GB RAM minimum).
   - Docker Engine 26+ and Docker Compose v2.
2. **Database:**
   - MongoDB Atlas M10+ dedicated cluster with Replica Set (`rs0`).
   - Network Peering or AWS PrivateLink / GCP Private Service Connect enabled.
3. **Domain & DNS:**
   - Registered domain name (e.g. `electiondesk.gov`).
   - Cloudflare Enterprise / Pro DNS with DNSSEC enabled.

---

## 3. Production Deployment Step-by-Step

### Step 1: Clone Repository & Configure Production Environment
```bash
git clone https://github.com/organization/electiondesk.git /opt/electiondesk
cd /opt/electiondesk

# Create production environment configuration
cp .env.example .env
chmod 600 .env
```
Populate `.env` with strong random secrets generated via `openssl rand -base64 48`.

### Step 2: Automated TLS Certificate Issuance (Let's Encrypt / Certbot)
```bash
sudo apt update && sudo apt install -y certbot

# Issue certificate using standalone or DNS-01 challenge
sudo certbot certonly --standalone \
  -d electiondesk.gov \
  --email security@electiondesk.gov \
  --agree-tos \
  --non-interactive

# Copy certificates to local certs directory
mkdir -p ./certs
sudo cp /etc/letsencrypt/live/electiondesk.gov/fullchain.pem ./certs/
sudo cp /etc/letsencrypt/live/electiondesk.gov/privkey.pem ./certs/
sudo chown -R 1001:1001 ./certs
```

### Step 3: Automated Renewal Cron Job
Create a weekly cron job (`/etc/cron.weekly/certbot-renew`):
```bash
#!/bin/bash
certbot renew --quiet --deploy-hook "docker compose -f /opt/electiondesk/docker-compose.yml exec proxy nginx -s reload"
```
Ensure execution permissions: `chmod +x /etc/cron.weekly/certbot-renew`.

### Step 4: Build and Launch Containers
```bash
docker compose build --no-cache
docker compose up -d
```

### Step 5: Verify Deployment Health
```bash
# Verify all services are healthy
docker compose ps

# Check API health endpoint
curl -s https://electiondesk.gov/api/v1/health | jq .
```
Expected output:
```json
{
  "status": "ONLINE",
  "system": "ElectionDesk API v1",
  "timestamp": "2026-10-25T..."
}
```
