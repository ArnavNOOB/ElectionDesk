# Cloudflare WAF, DDoS Mitigation, and Network Security Guide

This document details the production deployment configuration for protecting **ElectionDesk** behind Cloudflare Web Application Firewall (WAF) and reverse proxy layers.

---

## 1. Cloudflare Edge Architecture

```mermaid
flowchart LR
    User["Public Internet"] --> CF["Cloudflare Edge (WAF + DDoS + TLS 1.3)"]
    CF -->|Authenticated Origin Pull (Mutual TLS)| Nginx["Nginx Ingress Proxy"]
    Nginx --> Node["Node.js Application Tier"]
    Node --> Mongo["MongoDB Atlas (Private IP / VPC Peering)"]
```

---

## 2. Web Application Firewall (WAF) Configuration

### 2.1 Managed Rulesets
Enable the following managed rulesets in Cloudflare:
1. **Cloudflare Managed Ruleset:**
   - Action: `Block`
   - Paranoia Level: Level 2
2. **Cloudflare OWASP Core Rule Set (CRS):**
   - Minimum Anomaly Score: `25` (High Sensitivity)
   - Enable inspection for:
     - SQL & NoSQL Injection patterns (`$where`, `$regex`, `sleep`, operator keys)
     - Cross-Site Scripting (XSS)
     - Remote Code Execution (RCE) & Polyglot attacks
     - Protocol violations and invalid HTTP headers

### 2.2 Custom WAF Firewall Rules

| Rule Name | Expression | Action |
| :--- | :--- | :--- |
| **Block NoSQL Injection In Query** | `http.request.uri.query contains "$" or http.request.uri.query contains "%24"` | `Block` |
| **Strict Administrative Geo-Lock** | `(http.request.uri.path contains "/api/v1/users" or http.request.uri.path contains "/api/v1/security") and not ip.geoip.country in {"IN"}` | `Block` |
| **Block Malicious User Agents** | `http.user_agent contains "sqlmap" or http.user_agent contains "nikto" or http.user_agent contains "nmap"` | `Block` |
| **Enforce Request Body Limit** | `http.request.uri.path contains "/api/v1/voters" and http.request.content_length > 15728640` | `Block` |

---

## 3. Cloudflare Rate Limiting Rules

Configure Cloudflare Edge Rate Limiting rules to protect sensitive endpoints before traffic reaches origin infrastructure:

| Endpoint Target | Condition | Threshold | Action |
| :--- | :--- | :--- | :--- |
| **Authentication Protection** | `http.request.uri.path eq "/api/v1/auth/login"` | > 5 requests / 1 minute / IP | `Block for 15 minutes` |
| **Step-Up Verification** | `http.request.uri.path eq "/api/v1/auth/step-up"` | > 5 requests / 5 minutes / IP | `Block for 10 minutes` |
| **Bulk Dataset Export** | `http.request.uri.path contains "/import-export/voters"` | > 3 requests / 10 minutes / IP | `Block for 30 minutes` |
| **Global API Abuse** | `http.request.uri.path starts_with "/api/"` | > 120 requests / 1 minute / IP | `Managed Challenge` |

---

## 4. Origin Server Protection (Bypass Prevention)

To prevent attackers from discovering the origin server's public IP address and bypassing Cloudflare WAF:

1. **Authenticated Origin Pulls (mTLS):**
   - Generate an origin CA certificate in Cloudflare.
   - Configure Nginx on the origin server to verify that incoming client certificates are signed by Cloudflare's Root CA (`ssl_client_certificate /etc/nginx/certs/cloudflare_origin.crt; ssl_verify_client on;`).
2. **Origin Firewall (UFW / AWS Security Group):**
   - Whitelist **only** Cloudflare IP ranges on TCP ports 80 and 443:
     - `173.245.48.0/20`
     - `103.21.244.0/22`
     - `103.22.200.0/22`
     - `103.31.4.0/22`
     - `141.101.64.0/18`
     - `108.162.192.0/18`
     - `190.93.240.0/20`
     - `188.114.96.0/20`
     - `197.234.240.0/22`
     - `198.41.128.0/17`
     - `162.158.0.0/15`
     - `104.16.0.0/13`
     - `104.24.0.0/14`
     - `172.64.0.0/13`
     - `131.0.72.0/22`
   - Drop all direct public inbound traffic from any other IP.

---

## 5. DDoS Mitigation & Bot Protection

1. **Under Attack Mode:** Kept on standby. In the event of a coordinated Layer 7 flood during electoral roll publication, toggle "Under Attack Mode" via Cloudflare dashboard or API to present a managed JavaScript challenge to all visitors.
2. **Bot Fight Mode:** Enable "Bot Fight Mode" or Super Bot Fight Mode to block known automated scanners, scrapers, and headless browser credential-stuffing bots.
3. **HTTP/3 & 0-RTT Configuration:**
   - Enable HTTP/3 (QUIC) for performance.
   - **Disable 0-RTT (Early Data)** on state-changing API endpoints to protect against replay attacks.
