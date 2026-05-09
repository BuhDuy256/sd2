# System Architecture Diagram

## Diagram

```
                        ┌─────────────────────────────────────────┐
                        │           CLIENT (curl / Postman)        │
                        └────────────────────┬────────────────────┘
                                             │  HTTP :80
                                             ▼
                        ┌────────────────────────────────────────┐
                        │         NGINX Load Balancer            │
                        │       Round Robin  |  :80              │
                        │   proxy_next_upstream (fault-tolerant) │
                        └────────────┬───────────────┬───────────┘
                                     │               │
                          ┌──────────▼──┐       ┌───▼──────────┐
                          │  api-node-1 │       │  api-node-2  │
                          │  Node.js    │       │  Node.js     │
                          │  :3000      │       │  :3000       │
                          └──────┬──────┘       └──────┬───────┘
                                 │                     │
                    ┌────────────┴─────────────────────┴───────────┐
                    │              READ / WRITE Splitting            │
                    └──────────────────────────────────────────────┘
                                 │                     │
                       WRITE (POST)                 READ (GET)
                                 │                     │
                    ┌────────────▼──┐       ┌──────────▼────────┐
                    │  MySQL MASTER │◄──────│  MySQL SLAVE      │
                    │  :3306        │ Binlog│  :3307            │
                    │  Read + Write │  Repl │  Read Only        │
                    └───────────────┘       └───────────────────┘
```

**Traffic flow:**

| Operation | Path |
|-----------|------|
| `POST /products` | Client → Nginx → api-node-{1\|2} → **MySQL Master** (write) |
| `GET /products`  | Client → Nginx → api-node-{1\|2} → **MySQL Slave** (read) |

---

## Technology Stack

| Component | Technology | Version |
|-----------|------------|---------|
| Load Balancer | Nginx | alpine (latest) |
| API Runtime | Node.js + Express | 18 LTS / 4.x |
| Database | MySQL | 8.0 |
| Containerisation | Docker + Docker Compose | 24+ / 2.x |