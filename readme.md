# Hướng dẫn sử dụng hệ thống quản lý sân cầu lông

## 1. Giới thiệu

Hệ thống quản lý sân cầu lông giúp bạn quản lý toàn bộ hoạt động kinh doanh của sân, bao gồm:

- Quản lý cơ sở và sân
- Quản lý lịch đặt sân
- Quản lý khách hàng
- Quản lý bảng giá, dịch vụ và sản phẩm
- Tạo hóa đơn, thanh toán và doanh thu
- Xem báo cáo hoạt động
- Cài đặt hệ thống và bảo mật

Tên hệ thống: SÂN CẦU LÔNG HUE

---

## 2. Tài khoản đăng nhập mặc định

Sau khi cài đặt và khởi động hệ thống, bạn có thể đăng nhập bằng tài khoản demo sau:

- Admin: admin@courtify.vn / admin123
- Manager: manager@courtify.vn / manager123
- Staff: staff@courtify.vn / staff123

Khuyến nghị:
- Admin hoặc Manager dùng để setup ban đầu
- Staff dùng để thao tác giao dịch hàng ngày

---

## 3. Cách chạy dự án

### 3.1 Cài đặt dependency ở gốc dự án

```bash
npm install
```

### 3.2 Chạy backend

```bash
cd apps/backend
npm install
npm run dev
```

Backend chạy ở:

- http://localhost:3000

### 3.3 Chạy frontend

```bash
cd apps/frontend
npm install
npm run dev
```

Frontend chạy ở:

- http://localhost:5173

### 3.4 Chạy bằng Docker (nếu cần)

```bash
docker-compose up --build
```

---

## 4. Cấu hình database

### 4.1 File môi trường

Vào thư mục `apps/backend`, tạo file `.env` từ `.env.example`:

```bash
cd apps/backend
copy .env.example .env
```

Nội dung mẫu:

```env
NODE_ENV=development
DATABASE_URL="file:./prisma/dev.db"
JWT_SECRET="dev-jwt-secret"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_SECRET="dev-refresh-secret"
JWT_REFRESH_EXPIRES_IN="7d"
PORT=3000
CORS_ORIGIN="http://localhost:5173"
FRONTEND_URL="http://localhost:5173"
DEFAULT_PAGE_SIZE=20
MAX_PAGE_SIZE=100
GEMINI_API_KEY="YOUR_GEMINI_API_KEY_HERE"
```

### 4.2 Database mặc định

Dự án dùng SQLite trong môi trường phát triển, file database được tạo ở:

- apps/backend/prisma/dev.db

### 4.3 Khởi tạo database Prisma

```bash
cd apps/backend
npx prisma generate
npx prisma db push
```

Nếu cần dữ liệu mẫu ban đầu:

```bash
npm run db:seed
```

### 4.4 Các lệnh Prisma hữu ích

```bash
npx prisma studio
npx prisma migrate dev
npx prisma db push
npm run db:seed
```

---

## 5. Cách sử dụng hệ thống theo đúng thứ tự

### Bước 1: Đăng nhập

- Vào giao diện web
- Đăng nhập bằng tài khoản Admin hoặc Manager
- Sau khi đăng nhập, hệ thống sẽ vào Dashboard

### Bước 2: Thiết lập cơ sở và sân

Vào phần Cơ sở / Settings → Thông tin cơ sở và phần sân.

Bạn cần:

- Thêm cơ sở mới
- Cập nhật địa chỉ, số điện thoại, email
- Thiết lập giờ mở/đóng cửa
- Thêm sân cho cơ sở

Nếu chưa có sân thì không thể đặt lịch được.

### Bước 3: Thiết lập bảng giá

Vào Settings → Bảng giá.

Bạn có thể:

- Thêm khung giá
- Sửa khung giá
- Xóa khung giá không còn dùng
- Thiết lập giá mặc định, giờ cao điểm, cuối tuần

Ví dụ:

- Giá mặc định: 150.000đ/giờ
- Giờ cao điểm: 200.000đ/giờ
- Cuối tuần: 180.000đ/giờ

### Bước 4: Quản lý khách hàng

Vào menu Khách hàng.

Bạn có thể:

- Thêm khách hàng mới
- Tìm khách cũ
- Xem lịch sử đặt sân
- Xem tổng chi tiêu

### Bước 5: Đặt sân và quản lý lịch

Vào mục Lịch đặt sân / Calendar.

Bạn làm:

- Chọn cơ sở
- Chọn ngày
- Chọn sân
- Chọn khung giờ
- Nhập thông tin khách
- Xác nhận đặt sân

Các trạng thái booking thường gặp:

- Chờ xác nhận
- Đã xác nhận
- Đang chơi
- Hoàn thành
- Đã hủy

### Bước 6: Check-in và Check-out

Khi khách đến sân:

- Chọn booking
- Click Check-in

Khi khách chơi xong:

- Click Check-out
- Chuẩn bị thanh toán

### Bước 7: Quản lý kho và dịch vụ

Vào mục Kho & Dịch vụ.

Có 2 phần chính:

- Sản phẩm: vợt, giày, đồ uống, phụ kiện
- Dịch vụ: thuê vợt, thuê giày, huấn luyện viên, dịch vụ đi kèm

Mục đích:
- Bán thêm cho khách
- Quản lý tồn kho
- Tăng doanh thu

### Bước 8: Tạo hóa đơn

Sau khi check-out, bạn thực hiện:

- Xem thông tin booking
- Thêm sản phẩm / dịch vụ nếu có
- Chọn phương thức thanh toán
- Xác nhận thanh toán
- In hóa đơn

### Bước 9: Xem báo cáo doanh thu

Vào mục Báo cáo.

Theo dõi:

- Doanh thu ngày/tuần/tháng
- Chi phí
- Lợi nhuận
- Số lượng booking
- Xu hướng tăng trưởng

### Bước 10: Cài đặt hệ thống

Vào Settings.

Dùng để:

- Cập nhật thông tin cơ sở
- Bảng giá
- Giờ hoạt động
- Thông báo
- Bảo mật

---

## 6. Quy trình làm việc chuẩn cho người mới

### Mỗi ngày

1. Đăng nhập
2. Vào Dashboard kiểm tra tổng quan
3. Kiểm tra lịch đặt hôm nay
4. Xác nhận booking
5. Check-in khi khách đến
6. Check-out khi khách ra về
7. Tạo hóa đơn
8. Xem báo cáo cuối ca

### Mỗi tuần

- Kiểm tra bảng giá
- Kiểm tra tồn kho
- Kiểm tra doanh thu tuần
- Cập nhật cơ sở / sân nếu cần

### Mỗi tháng

- Review báo cáo doanh thu
- Cập nhật cấu hình hệ thống
- Kiểm tra dữ liệu khách hàng và san

---

## 7. Cách sử dụng database trong dự án

### 7.1 Các bảng chính

- `users`: tài khoản người dùng
- `venues`: cơ sở sân
- `courts`: sân chơi
- `customers`: khách hàng
- `bookings`: lịch đặt sân
- `pricing_rules`: bảng giá
- `services`: dịch vụ đi kèm
- `products`: sản phẩm / vật dụng
- `invoices`: hóa đơn
- `invoice_items`: chi tiết hóa đơn

### 7.2 Xem database trực tiếp

```bash
cd apps/backend
npx prisma studio
```

### 7.3 Reset dữ liệu mẫu

Nếu cần tạo lại dữ liệu demo:

```bash
cd apps/backend
npm run db:seed
```

> Lưu ý: reset dữ liệu sẽ xóa dữ liệu hiện tại và tạo lại dữ liệu mẫu.

### 7.4 Khi thay đổi schema

```bash
cd apps/backend
npx prisma generate
npx prisma db push
```

---

## 8. Lưu ý quan trọng

- Database dev mặc định là SQLite, không phải PostgreSQL
- Khi chạy local, dữ liệu được lưu trong `apps/backend/prisma/dev.db`
- Nếu cần backup, sao chép file `dev.db`
- Không nên xóa dữ liệu hệ thống khi chưa chắc chắn
- Khi sửa bảng giá hoặc lịch đặt, cần kiểm tra kỹ để tránh sai thông tin

---

## 9. Tóm tắt nhanh

```bash
cd apps/backend
npm install
npx prisma generate
npx prisma db push
npm run db:seed
npm run dev
```

```bash
cd apps/frontend
npm install
npm run dev
```

Sau đó truy cập:

- Frontend: http://localhost:5173
- Backend: http://localhost:3000

Đăng nhập bằng tài khoản demo và bắt đầu vận hành hệ thống.
