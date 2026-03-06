# Hệ thống Quản lý Thang máy

Website quản lý lắp đặt, bảo trì thang máy với React + Node.js + MongoDB.

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

## Tech Stack

- **Frontend**: React (Vite) + Ant Design + react-big-calendar
- **Backend**: Node.js, Express, Mongoose, JWT, bcryptjs
- **Database**: MongoDB
