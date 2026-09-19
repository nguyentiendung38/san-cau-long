# Hướng dẫn sử dụng hệ thống quản lý sân cầu lông

## 1. Giới thiệu

Hệ thống quản lý sân cầu lông giúp bạn quản lý toàn bộ hoạt động kinh doanh của sân, bao gồm:

- Quản lý cơ sở và sân
- Đặt sân và lịch làm việc
- Quản lý khách hàng
- Quản lý giá, dịch vụ và hàng hóa
- Tạo hóa đơn, thanh toán và doanh thu
- Báo cáo hoạt động
- Cài đặt hệ thống và bảo mật

Tên hệ thống: SÂN CẦU LÔNG HUE

---

## 2. Tài khoản đăng nhập mặc định

Sau khi cài đặt và khởi động hệ thống, bạn có thể đăng nhập bằng các tài khoản demo sau:

- Admin: admin@courtify.vn / admin123
- Manager: manager@courtify.vn / manager123
- Staff: staff@courtify.vn / staff123

Khuyến nghị:
- Người quản lý dùng Admin hoặc Manager
- Nhân viên trực tiếp dùng Staff

---

## 3. Cách chạy hệ thống

### 3.1 Cài đặt dependencies

Tại thư mục gốc dự án:

```bash
npm install
```

### 3.2 Chạy backend

```bash
cd apps/backend
npm install
npm run dev
```

### 3.3 Chạy frontend

```bash
cd apps/frontend
npm install
npm run dev
```

### 3.4 Truy cập giao diện

- Frontend: http://localhost:5173
- Backend API: http://localhost:3000

Nếu bạn đang dùng cấu hình local hoặc Docker, hãy kiểm tra file `docker-compose.yml` và file môi trường `.env` để chắc chắn port và cấu hình khớp với máy của bạn.

---

## 4. Luồng vận hành đúng cho người mới

Để vận hành hệ thống hiệu quả, nên làm theo thứ tự sau:

1. Đăng nhập
2. Thiết lập cơ sở
3. Thiết lập sân
4. Thiết lập bảng giá
5. Quản lý khách hàng
6. Đặt sân / lịch
7. Check-in / check-out
8. Tạo hóa đơn
9. Quản lý kho và dịch vụ
10. Xem báo cáo
11. Cài đặt hệ thống

Đây là quy trình chuẩn nhất để không bị rối trong khi vận hành.

---

## 5. Hướng dẫn từng chức năng chính

### 5.1 Dashboard

Trang Dashboard là màn hình tổng quan đầu tiên sau khi đăng nhập.

Nó hiển thị:

- Doanh thu ngày / tuần / tháng
- Số lượng booking
- Số lượng khách hàng
- Tình trạng sân
- Biểu đồ doanh thu
- Thống kê nhanh

Mục đích:
- Theo dõi hoạt động mỗi ngày
- Kiểm tra doanh thu và xu hướng tăng giảm
- Phát hiện vấn đề sớm

Nên xem Dashboard mỗi ngày trước khi bắt đầu ca làm việc.

### 5.2 Quản lý cơ sở

Vào phần Cơ sở hoặc Settings → Thông tin cơ sở.

Ở đây bạn có thể:

- Thêm cơ sở mới
- Sửa thông tin cơ sở
- Cập nhật địa chỉ, số điện thoại, email
- Thiết lập giờ mở cửa / đóng cửa

Nên làm trước khi thêm sân hoặc nhận khách.

### 5.3 Quản lý sân

Vào menu Sân / Courts.

Bạn cần:

- Chọn cơ sở tương ứng
- Thêm sân mới
- Gán tên sân
- Thiết lập mô tả
- Đặt trạng thái hoạt động

Ví dụ:

- Sân A1
- Sân A2
- Sân VIP
- Sân ngoài trời

Nếu chưa có sân, hệ thống sẽ không thể nhận đặt sân được.

### 5.4 Bảng giá

Vào menu Settings → Bảng giá.

Đây là phần quan trọng nhất về giá.

Bạn có thể:

- Thêm khung giá mới
- Sửa khung giá cũ
- Xóa khung giá không còn dùng
- Chọn giá theo ngày trong tuần
- Chọn giá theo khung giờ như 17:00 - 21:00
- Thiết lập ưu tiên nếu có nhiều khung giá chồng nhau

Ví dụ khung giá:

- Giá mặc định: 150.000đ/giờ
- Giờ cao điểm: 200.000đ/giờ
- Cuối tuần: 180.000đ/giờ

Mẹo:
- Luôn thiết lập bảng giá trước khi hoạt động chính thức
- Nếu không thiết lập, hệ thống có thể dùng giá mặc định không phù hợp

### 5.5 Quản lý khách hàng

Vào menu Khách hàng.

Bạn có thể:

- Thêm khách mới
- Tìm kiếm khách cũ
- Xem lịch sử đặt sân
- Xem tổng số tiền đã sử dụng
- Xem thông tin cá nhân

Mục tiêu:
- Quản lý khách quen tốt hơn
- Tạo lịch sử giao dịch thuận tiện
- Theo dõi doanh thu theo khách hàng

### 5.6 Đặt sân

Vào menu Lịch đặt sân / Calendar.

Bạn cần:

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

Nên kiểm tra lịch đặt hàng ngày để tránh xung khung giờ hoặc sai lịch.

### 5.7 Lịch cố định / recurring booking

Nếu sân có khách đặt theo lịch cố định (ví dụ mỗi tuần vào thứ 2, 4, 6), hệ thống hỗ trợ tạo lịch lặp lại.

Bạn có thể:

- Tạo lịch lặp đều theo tuần
- Thiết lập thời gian cố định
- Sử dụng cho các nhóm chơi định kỳ

Dùng cho trường hợp: câu lạc bộ, nhóm bạn, học sinh, sinh viên hay khách quen có lịch cố định.

### 5.8 Check-in và Check-out

Khi khách đến sân:

- Vào lịch đặt sân
- Chọn booking cần xử lý
- Click Check-in

Khi khách kết thúc:

- Click Check-out
- Hệ thống sẽ cập nhật trạng thái và chuẩn bị thanh toán

Mục đích:
- Đảm bảo tính chính xác về thời gian chơi
- Dễ theo dõi công việc trong ca

### 5.9 Quản lý kho và dịch vụ

Vào menu Kho & Dịch vụ.

Phần này gồm:

- Sản phẩm: vợt, giày, đồ uống, phụ kiện
- Dịch vụ: thuê vợt, thuê giày, huấn luyện viên, phụ phí thêm

Bạn có thể:

- Thêm sản phẩm / dịch vụ mới
- Chỉnh sửa giá
- Xóa nếu không còn dùng
- Theo dõi hàng tồn kho

Nếu có sale phụ trợ, phần này rất quan trọng để tăng doanh thu.

### 5.10 Hóa đơn

Sau khi check-out, bạn sẽ tạo hóa đơn cho khách.

Trong hóa đơn, bạn có thể:

- Xem từng booking
- Thêm dịch vụ
- Thêm sản phẩm
- Chọn phương thức thanh toán
- Xác nhận thanh toán
- In hóa đơn

Nên làm ngay sau khi khách hoàn tất giờ chơi, tránh quên hoặc sai số tiền.

### 5.11 Báo cáo doanh thu

Vào menu Báo cáo.

Ở đây bạn xem:

- Doanh thu theo ngày, tuần, tháng
- Lợi nhuận
- Chi phí
- Số lượng đơn
- Xu hướng tăng trưởng

Mục đích:
- Review hiệu quả hoạt động
- Kiểm tra doanh thu thực tế
- Dùng cho quản lý và quyết định kinh doanh

### 5.12 Cài đặt hệ thống

Vào Settings.

Dùng để:

- Quản lý cơ sở
- Cài đặt giờ hoạt động
- Sửa bảng giá
- Tùy chọn thông báo
- Quản lý bảo mật

Đây là nơi bạn cấu hình hệ thống lâu dài.

---

## 6. Quy trình làm việc chuẩn của nhân viên

### Mỗi ngày

1. Đăng nhập vào hệ thống
2. Vào Dashboard kiểm tra tổng quan
3. Kiểm tra lịch đặt hôm nay
4. Xem sân nào còn trống
5. Xác nhận lịch đặt
6. Check-in khi khách đến
7. Check-out khi khách ra về
8. Tạo hóa đơn
9. Kiểm tra kho nếu có bán thêm đồ/dịch vụ
10. Xem báo cáo cuối ngày

### Mỗi tuần

- Kiểm tra bảng giá
- Cập nhật sản phẩm / dịch vụ
- Xem doanh thu tuần
- Xác nhận cơ sở và sân còn hoạt động bình thường

### Mỗi tháng

- Review báo cáo doanh thu
- Kiểm tra sản phẩm gần hết hàng
- Cập nhật cấu hình hệ thống nếu cần

---

## 7. Mẹo vận hành hiệu quả

- Chạy hệ thống theo đúng thứ tự: cơ sở → sân → bảng giá → lịch → thanh toán
- Luôn cập nhật sân và giá trước khi mở cửa
- Kiểm tra booking tránh trùng giờ
- Đảm bảo hóa đơn được tạo đúng sau khi check-out
- Nên kiểm tra báo cáo hàng ngày để phát hiện vấn đề sớm
- Nếu có khách quen, lưu thông tin khách hàng để quản lý dễ hơn

---

## 8. Tài khoản và quyền hạn

Hệ thống phân quyền theo role:

- SUPER_ADMIN: quyền tối cao
- ADMIN: quản trị cơ bản
- MANAGER: quản lý vận hành
- STAFF: nhân viên trực tiếp

Nếu bạn là người mới, nên ưu tiên tài khoản Admin hoặc Manager để thao tác setup ban đầu.

---

## 9. Lưu ý quan trọng

- Không nên xóa dữ liệu hệ thống bừa bãi khi chưa chắc chắn
- Khi sửa bảng giá, phải kiểm tra ảnh hưởng đến các booking đã có
- Hãy backup dữ liệu nếu hệ thống đang chạy thực tế
- Thường xuyên kiểm tra trạng thái sân và lịch đặt để tránh trùng lịch

---

## 10. Kết luận

Hệ thống quản lý sân cầu lông này được thiết kế để quản lý từ đầu đến cuối quy trình kinh doanh:

- Khách hàng
- Lịch đặt sân
- Giá và khung giờ
- Dịch vụ và sản phẩm
- Hóa đơn và doanh thu
- Báo cáo quản trị

Nếu bạn làm đúng thứ tự trên, hệ thống sẽ chạy rất trơn tru và dễ quản lý.

---

## 11. Tóm tắt nhanh

Nếu bạn chỉ cần nhớ 5 bước quan trọng nhất:

1. Đăng nhập
2. Thiết lập cơ sở và sân
3. Thiết lập bảng giá
4. Quản lý booking và check-in
5. Tạo hóa đơn và xem báo cáo

Đây là quy trình tối thiểu để vận hành hệ thống một cách hiệu quả.
