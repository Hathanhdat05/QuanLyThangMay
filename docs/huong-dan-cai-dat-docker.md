# Huong dan cai dat va su dung bang Docker

Tai lieu nay dung de gui cho nguoi khac, giup cai dat he thong nhanh bang 1 lenh.

## 1) Yeu cau

- Cai Docker Desktop
- Bat Docker Desktop truoc khi chay lenh

## 2) Chay he thong

Mo Terminal tai thu muc du an (chua file `docker-compose.yml`) va chay:

```bash
docker compose up -d --build
```

Sau khi chay xong:

- Frontend: `http://localhost`
- Backend health check: `http://localhost:3001/api/health`

## 3) Tao tai khoan admin mac dinh

Chi can chay 1 lan:

```bash
docker compose exec backend node scripts/seed-admin.js
```

Thong tin dang nhap mac dinh:

- Email: `admin@example.com`
- Mat khau: `admin123`

## 4) Cac lenh quan trong

Xem log:

```bash
docker compose logs -f
```

Khoi dong lai:

```bash
docker compose restart
```

Dung he thong:

```bash
docker compose down
```

Reset sach du lieu (database + uploads):

```bash
docker compose down -v
```

## 5) Luu y khi ban giao

- Neu dung production, doi `JWT_SECRET` trong `docker-compose.yml`
- Neu doi domain/port frontend, cap nhat `CORS_ORIGIN` trong `docker-compose.yml`
- Du lieu MongoDB duoc luu persistent trong volume Docker (`mongo_data`)
