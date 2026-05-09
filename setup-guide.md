# Setup Guide — Scalable System with Load Balancer & DB Replication

## Yêu cầu

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) đã cài và đang chạy
- Git Bash (hoặc terminal hỗ trợ bash)
- `python` có trong PATH (để format JSON output)

---

## Cấu trúc hệ thống

```
Internet
    │
    ▼
┌─────────────┐
│  Nginx :80  │  ← Load Balancer (Round Robin)
└──────┬──────┘
       │
  ┌────┴────┐
  ▼         ▼
api-node-1  api-node-2   ← 2 API nodes (Node.js)
  │         │
  └────┬────┘
       │ Write → mysql-master :3306
       │ Read  → mysql-slave  :3307
```

**Luồng dữ liệu:**
- `POST /products` → Nginx → api-node-N → **MySQL Master** (ghi)
- `GET /products`  → Nginx → api-node-N → **MySQL Slave** (đọc)
- MySQL Slave tự động đồng bộ dữ liệu từ Master qua Binary Log Replication

---

## Phase 1 — Khởi động hệ thống

### Bước 1: Vào thư mục project và start toàn bộ stack

```bash
docker-compose up -d --build
```

Lệnh này sẽ tự động:
1. Build image cho `api-node-1` và `api-node-2`
2. Khởi động MySQL Master và Slave
3. Chạy script `setup-replication.sh` để cấu hình replication
4. Khởi động 2 API nodes
5. Khởi động Nginx load balancer

### Bước 3: Chờ hệ thống sẵn sàng (~60 giây)

```bash
docker-compose ps
```

Tất cả containers phải ở trạng thái `healthy`:

```
NAME              STATUS
api-node-1        Up (healthy)
api-node-2        Up (healthy)
mysql-master      Up (healthy)
mysql-slave       Up (healthy)
nginx-lb          Up
```

---

## Phase 2 — Xác minh Database Replication

### Test 1: Kiểm tra container database đang chạy

```bash
docker ps --filter "name=mysql-master" --filter "name=mysql-slave" \
  --format "table {{.Names}}\t{{.Status}}"
```

### Test 2: Xem log replication setup

```bash
docker inspect replication-setup --format='ExitCode: {{.State.ExitCode}} | Status: {{.State.Status}}'
```

Mong đợi: `ExitCode: 0 | Status: exited`

### Test 3: Kiểm tra trạng thái replication trong Slave

```bash
docker exec mysql-slave mysql -uroot -prootpass -e "SHOW SLAVE STATUS\G" 2>/dev/null \
  | grep -E "Slave_IO_Running|Slave_SQL_Running|Seconds_Behind_Master|Last_IO_Error|Last_SQL_Error"
```

Mong đợi:
```
Slave_IO_Running: Yes
Slave_SQL_Running: Yes
Seconds_Behind_Master: 0
```

### Test 4: Insert vào Master, kiểm tra Slave có dữ liệu

```bash
# Ghi vào Master
docker exec mysql-master mysql -uroot -prootpass productsdb \
  -e "INSERT INTO products (name, price) VALUES ('Test Item', 1.00);" 2>/dev/null

# Đọc từ Master
docker exec mysql-master mysql -uroot -prootpass productsdb \
  -e "SELECT * FROM products;" 2>/dev/null

# Đọc từ Slave — phải có cùng dữ liệu
docker exec mysql-slave mysql -uroot -prootpass productsdb \
  -e "SELECT * FROM products;" 2>/dev/null
```

### Test 5: Chứng minh Slave không cho ghi (read-only)

```bash
docker exec mysql-slave mysql -uroot -prootpass productsdb \
  -e "INSERT INTO products (name, price) VALUES ('Should Fail', 0.00);" 2>&1 \
  | grep -E "ERROR|error"
```

Mong đợi: `ERROR 1290 (HY000): The MySQL server is running with the --super-read-only option`

---

## Phase 3 — Xác minh API & Read/Write Splitting

### POST — Ghi vào Master

```bash
curl -s -X POST http://localhost:80/products \
  -H "Content-Type: application/json" \
  -d '{"name": "iPhone 16 Pro", "price": 999}' | python -m json.tool
```

Mong đợi:
```json
{
    "message": "Product created successfully",
    "processed_by": "api-node-1",
    "written_to": "mysql-master",
    "product": {
        "id": 1,
        "name": "iPhone 16 Pro",
        "price": 999.0
    }
}
```

- `"written_to": "mysql-master"` — xác nhận ghi vào đúng Master
- `"processed_by"` — cho biết API node nào xử lý request
- Có thể run lệnh Read danh sách Product ở trên để check xem insert đúng hay chưa

---

## Phase 4 — Xác minh Load Balancer (Round Robin)

```bash
for i in $(seq 1 6); do
  curl -s http://localhost:80/products | grep -o '"processed_by":"[^"]*"'
done
```

Mong đợi:
```
"processed_by":"api-node-1"
"processed_by":"api-node-2"
"processed_by":"api-node-1"
"processed_by":"api-node-2"
"processed_by":"api-node-1"
"processed_by":"api-node-2"
```

`processed_by` toggle giữa `api-node-1` và `api-node-2` — chứng minh Nginx đang phân phối traffic theo Round Robin.

Lưu ý: `read_from: "mysql-slave"` trong GET response xác nhận read/write splitting đang hoạt động.

---

## Phase 5 — Chaos Test (Fault Tolerance)

Tắt `api-node-1` và chứng minh hệ thống vẫn hoạt động qua `api-node-2`.

### Bước 1: Tắt node-1

```bash
docker stop api-node-1
```

### Bước 2: Kiểm tra GET vẫn hoạt động

```bash
curl -s http://localhost:80/products | python -m json.tool | grep -E "processed_by|read_from"
```

### Bước 3: Kiểm tra POST vẫn hoạt động

```bash
curl -s -X POST http://localhost:80/products \
  -H "Content-Type: application/json" \
  -d '{"name": "Chaos Test Product", "price": 50.00}' | python -m json.tool
```

### Bước 4: Xác nhận data mới xuất hiện

```bash
curl -s http://localhost:80/products | python -m json.tool | grep -E "processed_by|count"
```

Mong đợi ở cả 3 bước: `"processed_by": "api-node-2"` — hệ thống không bị gián đoạn.

### Bước 5: Khôi phục node-1

```bash
docker start api-node-1
```

---

## Dọn dẹp

```bash
# Dừng toàn bộ hệ thống
docker-compose down

# Dừng và xóa cả volume (reset database)
docker-compose down -v
```
