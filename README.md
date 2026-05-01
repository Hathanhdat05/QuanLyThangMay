# Hệ thống Quản lý Thang máy

Website quản lý lắp đặt, bảo trì thang máy với React + Node.js + MongoDB.

## Đóng gói chạy nhanh bằng Docker (khuyên dùng)

Yêu cầu: cài [Docker Desktop](https://www.docker.com/products/docker-desktop/).

```bash
# 1) Build + chạy toàn bộ hệ thống
docker compose up -d --build

# 2) Xem log (nếu cần)
docker compose logs -f
```

Truy cập:

- Frontend: `http://localhost`
- Backend health check: `http://localhost:3001/api/health`

Tạo admin mặc định (chạy một lần):

```bash
docker compose exec backend node scripts/seed-admin.js
# Đăng nhập: admin@example.com / admin123
```

Dừng hệ thống:

```bash
docker compose down
```

Xóa cả dữ liệu database + uploads (reset sạch):

```bash
docker compose down -v
```

## Chức năng

- **Khách hàng**: Thêm, sửa, xóa, tìm kiếm khách hàng
- **Hợp đồng**: Quản lý hợp đồng, gán khách hàng, chọn sản phẩm
- **Sản phẩm**: Quản lý danh mục sản phẩm
- **Thang máy**: Quản lý các loại thang máy
- **Báo lỗi**: Tạo báo lỗi bảo trì/bảo hành, liên kết thang máy & khách hàng
- **Lịch bảo trì**: Hiển thị lịch trực quan từ báo lỗi
- **Quản lý User**: Thêm user, phân quyền Admin/User

## Phân quyền

| Chức năng   | Admin | User      |
|------------|-------|-----------|
| Khách hàng | CRUD  | Xem       |
| Hợp đồng   | CRUD  | Xem       |
| Sản phẩm   | CRUD  | Xem       |
| Thang máy  | CRUD  | Xem       |
| Báo lỗi    | CRUD  | Xem + Tạo |
| Lịch bảo trì | Xem | Xem       |
| Quản lý User | CRUD | Không     |

## Cài đặt

### 1. MongoDB

Cài và chạy MongoDB (local hoặc Atlas). Ví dụ local:

```bash
# macOS (Homebrew)
brew install mongodb-community
brew services start mongodb-community
```

### 2. Backend (Node.js)

```bash
cd backend
npm install
cp .env.example .env
# Chỉnh .env: MONGODB_URI, JWT_SECRET, CORS_ORIGIN (mặc định http://localhost:5173)
npm run dev
```

Tạo user admin mặc định (chỉ chạy một lần):

```bash
cd backend
node scripts/seed-admin.js
# Đăng nhập: email = admin@example.com, password = admin123
```

### 3. Frontend

Ở thư mục gốc dự án:

```bash
npm install
```

Tạo file `.env` (hoặc đã có) với:

```
VITE_API_URL=http://localhost:3001/api
```

Chạy:

```bash
npm run dev
```

Mở trình duyệt tại `http://localhost:5173`, đăng nhập bằng `admin@example.com` / `admin123`.

## Cấu trúc

- **Frontend** (thư mục gốc): React (Vite) + Ant Design, gọi REST API qua `src/lib/api.js`.
- **Backend** (`backend/`): Express, MongoDB (Mongoose), JWT auth. API base: `http://localhost:3001/api`.

## Deploy / Môi trường production

### Biến môi trường khi deploy

**Backend** (trên server hoặc trong panel hosting):

- `MONGODB_URI` – Chuỗi kết nối MongoDB (Atlas hoặc MongoDB trên VPS). Ví dụ: `mongodb+srv://user:pass@cluster.mongodb.net/thangmay3`
- `JWT_SECRET` – Chuỗi bí mật để ký JWT (nên dùng giá trị mạnh, khác với dev)
- `CORS_ORIGIN` – URL frontend production. Ví dụ: `https://your-app.vercel.app` hoặc `https://yourdomain.com`
- `PORT` – Port cho backend (nhiều host tự gán, ví dụ `3001` hoặc `process.env.PORT`)

**Frontend** (build-time):

- `VITE_API_URL` – URL API backend production. Ví dụ: `https://api.yourdomain.com/api` hoặc `https://your-backend.railway.app/api`

Build frontend với API production:

```bash
VITE_API_URL=https://api.yourdomain.com/api npm run build
```

### Chạy seed trên môi trường deploy

Seed chạy **một lần** trên server (hoặc máy có kết nối tới MongoDB production), dùng đúng **cùng bộ biến môi trường** (đặc biệt `MONGODB_URI`) với backend đang chạy.

**Trên VPS / SSH vào server:**

```bash
cd backend
# Đảm bảo .env đã có MONGODB_URI (và JWT_SECRET, CORS_ORIGIN nếu cần)
export $(cat .env | xargs)   # Linux/macOS: load .env vào shell (nếu có)
npm run seed:error-reports   # Thêm 15 báo lỗi mock
# Hoặc:
npm run seed:customers -- --count 50
npm run seed:elevators
npm run seed:contracts -- --count 30
node scripts/seed-admin.js   # Tạo admin (nếu chưa có)
```

**Trên Railway / Render / Heroku (one-off command):**

- Trong dashboard: mở **Shell** hoặc **Run command** (one-off).
- Hoặc dùng CLI của từng nền tảng chạy một lần:

```bash
# Ví dụ Railway
railway run npm run seed:error-reports

# Ví dụ Render: trong Dashboard → Shell, hoặc thêm "Background Worker" chạy script xong rồi tắt
cd backend && node src/scripts/seedErrorReports.js --count 15
```

**Lưu ý:**

- Chỉ chạy seed khi **đã có** ít nhất 1 khách hàng và 1 thang máy (cho báo lỗi). Nếu database mới trống, chạy lần lượt: `seed:customers` → `seed:elevators` → `seed:error-reports`.
- Không cần chạy seed mỗi lần deploy; chỉ khi muốn tạo dữ liệu mẫu lần đầu hoặc làm mới dữ liệu test.

### Gợi ý hosting

- **Frontend**: Vercel, Netlify, Cloudflare Pages (build từ `npm run build`, set `VITE_API_URL` trong env).
- **Backend**: Railway, Render, Fly.io, VPS (Node `npm start` hoặc `node src/index.js`).
- **Database**: MongoDB Atlas (free tier), hoặc MongoDB cài trên VPS.

## Tech Stack

- **Frontend**: React (Vite) + Ant Design + react-big-calendar
- **Backend**: Node.js, Express, Mongoose, JWT, bcryptjs
- **Database**: MongoDB
