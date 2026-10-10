import React, { useState, useEffect } from "react";
import { Page, Header, Box, Text, Button, Icon, List, Modal, useSnackbar, Select } from "zmp-ui";
import { useNavigate } from "zmp-ui";
import { openWebview } from "zmp-sdk";

// Cấu hình API Backend của bạn
const API_URL = "http://127.0.0.1:3005/api";


const translateDays = (daysStr: string) => {
    if (!daysStr) return "Tất cả các ngày";
    
    if (daysStr.startsWith('[')) {
      try {
        const arr = JSON.parse(daysStr);
        const numMap: any = { 0: 'CN', 1: 'T2', 2: 'T3', 3: 'T4', 4: 'T5', 5: 'T6', 6: 'T7' };
        if (arr.length === 7) return "Tất cả các ngày";
        
        // Sort specifically: T2 -> T7, then CN
        const sorted = arr.sort((a: number, b: number) => {
           if (a === 0) return 1;
           if (b === 0) return -1;
           return a - b;
        });
        return sorted.map((n: number) => numMap[n]).join(', ');
      } catch (e) { }
    }

    const map: any = {
      'MONDAY': 'T2',
      'TUESDAY': 'T3',
      'WEDNESDAY': 'T4',
      'THURSDAY': 'T5',
      'FRIDAY': 'T6',
      'SATURDAY': 'T7',
      'SUNDAY': 'CN'
    };
    return daysStr.split(',').map((d: string) => map[d.trim()] || d).join(', ');
  };

export default function HomePage() {

  const navigate = useNavigate();
  const { openSnackbar } = useSnackbar();
  const [venues, setVenues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Trạng thái khi đặt sân
  const [selectedVenue, setSelectedVenue] = useState<any>(null);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookingDate, setBookingDate] = useState("");

  const generateTimeOptions = () => {
    const times: string[] = [];
    for (let h = 5; h <= 23; h++) {
      const hourStr = h.toString().padStart(2, '0');
      times.push(`${hourStr}:00`);
      times.push(`${hourStr}:30`);
    }
    return times;
  };

  const [bookingTime, setBookingTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [courts, setCourts] = useState<any[]>([]);
  const [selectedCourt, setSelectedCourt] = useState("");
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [venueDetail, setVenueDetail] = useState<any>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("DEPOSIT_TRANSFER");

  // Gọi API lấy danh sách sân từ Backend
  useEffect(() => {
    fetch(`${API_URL}/venues`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) { openSnackbar({ type: "success", text: "Fetched " + (data.data.items || data.data).length + " venues" });
          setVenues(data.data.items || data.data);
        }
      })
      .catch((err) => {
        console.error("Lỗi lấy dữ liệu sân:", err); openSnackbar({ type: "warning", text: "Fetch Error: " + err.message });
        // Dữ liệu mẫu (mock data) nếu server chưa bật hoặc lỗi mạng
        setVenues([
          { id: "1", name: "Courtify Phú Nhuận", address: "123 Phan Đăng Lưu, Phú Nhuận" },
          { id: "2", name: "Courtify Gò Vấp", address: "456 Quang Trung, Gò Vấp" },
          { id: "3", name: "Courtify Quận 10", address: "789 Sư Vạn Hạnh, Q10" }
        ]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  
  const handleViewDetail = (venue: any) => {
    setSelectedVenue(venue);
    setShowDetailModal(true);
    setVenueDetail(null);
    fetch(`${API_URL}/venues/${venue.id}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setVenueDetail(data.data);
        }
      })
      .catch(console.error);
  };

  const handleBookClick = (venue: any) => {

    setSelectedVenue(venue);
    setShowBookingModal(true);
    setCourts([]);
    setSelectedCourt('');
    fetch(`${API_URL}/venues/${venue.id}/availability?date=${new Date().toISOString()}`)
      .then(res => res.json())
      .then(data => {
         if (data.success && data.data && data.data.courts) {
            setCourts(data.data.courts);
            if (data.data.courts.length > 0) setSelectedCourt(data.data.courts[0].id);
         }
      })
      .catch(err => {
         console.error('Lỗi tải sân:', err);
      });
  };

    const submitBooking = () => {
    if (!selectedCourt || !bookingDate || !bookingTime || !customerName || !customerPhone) {
      openSnackbar({ type: "warning", text: "Vui lòng nhập đầy đủ thông tin!" });
      return;
    }
    
    
    if (!bookingTime || !endTime) {
      openSnackbar({ type: "warning", text: "Vui lòng chọn đầy đủ giờ bắt đầu và kết thúc!" });
      return;
    }
    if (endTime <= bookingTime) {
      openSnackbar({ type: "warning", text: "Giờ kết thúc phải lớn hơn giờ bắt đầu!" });
      return;
    }
    
    const [startH, startM] = bookingTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    if (startM % 30 !== 0 || endM % 30 !== 0) {
      openSnackbar({ type: "warning", text: "Phút phải là số chẵn (00 hoặc 30). Ví dụ: 14:00, 14:30" });
      return;
    }


    localStorage.setItem('courtify_phone', customerPhone);
    fetch(`${API_URL}/booking-requests/public`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        venueId: selectedVenue.id,
        courtId: selectedCourt,
        name: customerName,
        phone: customerPhone,
        date: bookingDate,
        startTime: bookingTime,
        endTime: endTime,
        notes: 'Đặt từ Zalo Mini App',
        paymentMethod: paymentMethod
      })
    })
    .then(res => res.json())
    .then(data => {
      if(data.success) {
        if (paymentMethod === 'VNPAY' && data.data && data.data.id) {
           openSnackbar({ type: "success", text: "Đang chuyển hướng đến VNPAY..." });
           fetch(`${API_URL}/vnpay/create-payment`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                 orderId: data.data.id,
                 amount: data.data.paymentAmount || 100000,
                  source: 'zalo'
              })
           })
           .then(r => r.json())
           .then(payData => {
              
              if (payData.success && payData.payUrl) {
                 openSnackbar({ type: "success", text: "Chuyển hướng VNPAY..." });
                 const paymentWindow = window.open(payData.payUrl, "_blank");
                 if (paymentWindow) {
                     const checkWindowClosed = setInterval(() => {
                         if (paymentWindow.closed) {
                             clearInterval(checkWindowClosed);
                             openSnackbar({ type: "success", text: "Thanh toán hoàn tất. Lịch đã được tự động đặt!" });
                             setShowBookingModal(false);
                         }
                     }, 1000);
                 }
              } else {

                 openSnackbar({ type: "warning", text: "Lỗi tạo link VNPAY" });
              }
           })
           .catch(e => openSnackbar({ type: "warning", text: "Lỗi kết nối VNPAY" }));
        } else {
           openSnackbar({ type: "success", text: "Đã gửi yêu cầu về hệ thống Courtify!" });
           setShowBookingModal(false);
        }
      } else {
        openSnackbar({ type: "warning", text: data.message || "Lỗi đặt sân" });
      }
    })
    .catch(err => {
      openSnackbar({ type: "warning", text: "Lỗi kết nối!" });
    });
  };

  return (
    <Page className="page">
      <Header title="Courtify - Đặt Sân Cầu Lông" showBackIcon={false} />
      
      {/* Banner */}
      <Box className="relative">
        <img 
          src="https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?q=80&w=2070" 
          alt="Banner" 
          style={{ width: "100%", height: "200px", objectFit: "cover" }}
        />
        <Box 
          className="absolute bottom-0 left-0 right-0 p-4" 
          style={{ background: "linear-gradient(transparent, rgba(0,0,0,0.8))" }}
        >
          <Text.Title style={{ color: "white" }}>Sân cầu lông đạt chuẩn BWF</Text.Title>
          <Text size="small" style={{ color: "#E2E8F0" }}>Trải nghiệm thể thao đỉnh cao</Text>
        </Box>
      </Box>

      {/* Chức năng nổi bật */}
      <Box p={4} flex flexDirection="row" justifyContent="space-between" style={{ backgroundColor: "white", marginBottom: "8px" }}>
        <Box flex flexDirection="column" alignItems="center">
          <Box p={3} style={{ backgroundColor: "#EFF6FF", borderRadius: "12px", marginBottom: "4px" }}>
            <Icon icon="zi-calendar" style={{ color: "#3B82F6" }} />
          </Box>
          <Text size="xSmall" bold>Đặt sân</Text>
        </Box>
        <Box 
          flex flexDirection="column" alignItems="center" 
          onClick={() => navigate("/chat-ai")}
          style={{ cursor: "pointer" }}
        >
          <Box p={3} style={{ backgroundColor: "#ECFDF5", borderRadius: "12px", marginBottom: "4px" }}>
            <Icon icon="zi-chat" style={{ color: "#10B981" }} />
          </Box>
          <Text size="xSmall" bold>Chat AI</Text>
        </Box>
        <Box 
          flex flexDirection="column" alignItems="center" 
          onClick={() => navigate("/history")}
          style={{ cursor: "pointer" }}
        >
          <Box p={3} style={{ backgroundColor: "#FEF2F2", borderRadius: "12px", marginBottom: "4px" }}>
            <Icon icon="zi-list-1" style={{ color: "#EF4444" }} />
          </Box>
          <Text size="xSmall" bold>Lịch sử</Text>
        </Box>
        <Box 
          flex flexDirection="column" alignItems="center" 
          onClick={() => navigate("/availability")}
          style={{ cursor: "pointer" }}
        >
          <Box p={3} style={{ backgroundColor: "#F5F3FF", borderRadius: "12px", marginBottom: "4px" }}>
            <Icon icon="zi-clock-1" style={{ color: "#8B5CF6" }} />
          </Box>
          <Text size="xSmall" bold>Giờ trống</Text>
        </Box>
      </Box>

      {/* Danh sách cơ sở */}
      <Box p={4} style={{ backgroundColor: "white", minHeight: "300px" }}>
        <Text.Title size="normal" style={{ marginBottom: "16px" }}>
          Hệ thống cơ sở ({venues.length})
        </Text.Title>
        
        {loading ? (
          <Text className="text-center text-gray-500 mt-4">Đang tải dữ liệu...</Text>
        ) : (
          <List>
            {venues.map((venue) => (
              <Box 
                key={venue.id} 
                p={3} 
                style={{ border: "1px solid #E2E8F0", borderRadius: "12px", marginBottom: "12px" }}
              >
                <Text.Title size="small">{venue.name}</Text.Title>
                <Text size="xSmall" style={{ color: "#64748B", marginTop: "4px", marginBottom: "12px" }}>
                  <Icon icon="zi-location" size={12} /> {venue.address}
                </Text>
                <Button size="small" fullWidth onClick={() => handleViewDetail(venue)}>Xem chi tiết & Đặt sân</Button>
              </Box>
            ))}
          </List>
        )}
      </Box>

      {/* Đáy trang */}
      <Box p={4} textAlign="center">
        <Text size="xSmall" style={{ color: "#94A3B8" }}>Powered by Courtify Team & Zalo Mini App</Text>
      </Box>

      
      {/* Modal Chi Tiet Co So */}
      
      {/* Modal Chi Tiet Co So */}
      <Modal
        visible={showDetailModal}
        title="Thông tin cơ sở"
        onClose={() => setShowDetailModal(false)}
      >
        <Box p={4} style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          {venueDetail ? (
            <Box>
              <Text.Title size="small">{venueDetail.name}</Text.Title>
              <Text size="xSmall" style={{ color: '#64748B', marginBottom: '16px' }}>{venueDetail.address}</Text>
              
              {venueDetail.pricingRules && venueDetail.pricingRules.length > 0 && (
                <Box mb={4}>
                  <Text size="small" bold>Bảng giá tham khảo:</Text>
                  {venueDetail.pricingRules.map((pr) => (
                    <Box key={pr.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <Text size="xSmall">• {pr.name} ({pr.startTime}-{pr.endTime}) [{translateDays(pr.dayOfWeek)}]:</Text>
                      <Text size="xSmall" bold>{new Intl.NumberFormat('vi-VN').format(pr.pricePerHour)}đ/h</Text>
                    </Box>
                  ))}
                </Box>
              )}
              
              <Button 
                variant="primary" 
                fullWidth 
                onClick={() => {
                  setShowDetailModal(false);
                  handleBookClick(venueDetail);
                }}
              >
                Tiếp tục Đặt sân ngay
              </Button>
            </Box>
          ) : (
            <Text className="text-center text-gray-500">Đang tải thông tin chi tiết...</Text>
          )}
        </Box>
      </Modal>
<Modal
        visible={showDetailModal}
        title="Thông tin cơ sở"
        onClose={() => setShowDetailModal(false)}
      >
        <Box p={4} style={{ maxHeight: "60vh", overflowY: "auto" }}>
          {venueDetail ? (
            <Box>
              <Text.Title size="small">{venueDetail.name}</Text.Title>
              <Text size="xSmall" style={{ color: "#64748B", marginBottom: "16px" }}>{venueDetail.address}</Text>
              
              {venueDetail.pricingRules && venueDetail.pricingRules.length > 0 && (
                <Box mb={4}>
                  <Text size="small" bold>Bảng giá tham khảo:</Text>
                  {venueDetail.pricingRules.map((pr: any) => (
                    <Box key={pr.id} style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                      <Text size="xSmall">• {pr.name} ({pr.startTime}-{pr.endTime}) [{translateDays(pr.dayOfWeek)}]:</Text>
                      <Text size="xSmall" bold>{new Intl.NumberFormat('vi-VN').format(pr.pricePerHour)}đ/h</Text>
                    </Box>
                  ))}
                </Box>
              )}
              
              <Button 
                variant="primary" 
                fullWidth 
                onClick={() => {
                  setShowDetailModal(false);
                  handleBookClick(venueDetail);
                }}
              >
                Tiếp tục Đặt sân ngay
              </Button>
            </Box>
          ) : (
            <Text className="text-center text-gray-500">Đang tải thông tin chi tiết...</Text>
          )}
        </Box>
      </Modal>

      {/* Modal Dat San */}

      <Modal
        visible={showBookingModal}
        title="Chọn thời gian"
        onClose={() => setShowBookingModal(false)}
      >
        <Box p={4}>
          <Text.Title size="small" style={{ marginBottom: "12px" }}>
            {selectedVenue?.name}
          </Text.Title>
          
          <Text size="small" bold style={{ marginTop: "16px", marginBottom: "8px" }}>Tên của bạn:</Text>
          <input 
            type="text" 
            placeholder="Nhập tên..."
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #CBD5E1", marginBottom: "16px" }}
          />
          <Text size="small" bold style={{ marginBottom: "8px" }}>Số điện thoại Zalo:</Text>
          <input 
            type="tel" 
            placeholder="Nhập SĐT..."
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #CBD5E1", marginBottom: "16px" }}
          />
                    <Box mt={4} mb={4}>
            <Text size="small" bold style={{ marginBottom: "8px" }}>Hình thức thanh toán:</Text>
            <select 
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #CBD5E1", backgroundColor: "white" }}
            >
              <option value="DEPOSIT_TRANSFER">Thanh toán tại sân (Chờ kiểm tra)</option>
              <option value="VNPAY">Thanh toán online (VNPAY)</option>
            </select>
          </Box>
                    <Box mt={2} mb={4}>
            <Text size="small" bold style={{ marginBottom: "8px" }}>Chọn sân:</Text>
            {courts.length === 0 ? (
              <Text size="xSmall" style={{ color: "#64748B" }}>Đang tải danh sách sân...</Text>
            ) : (
              <select 
                value={selectedCourt}
                onChange={(e) => setSelectedCourt(e.target.value)}
                style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #CBD5E1", backgroundColor: "white" }}
              >
                {courts.map(c => (
                  <option key={c.id} value={c.id}>{c.name + " - " + (c.surfaceType || "Tiêu chuẩn")}</option>
                ))}
              </select>
            )}
          </Box>
          
          <Text size="small" bold style={{ marginTop: "16px", marginBottom: "8px" }}>Ngày chơi:</Text>
          <input 
            type="date" 
            value={bookingDate}
            onChange={(e) => setBookingDate(e.target.value)}
            style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #CBD5E1" }}
          />

                              <Box mt={4} mb={2}>
            <Text size="small" bold style={{ marginBottom: "8px" }}>Giờ bắt đầu:</Text>
            <input 
              type="time" 
              value={bookingTime} 
              onChange={(e) => setBookingTime(e.target.value)} 
              step="1800"
              style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #CBD5E1", backgroundColor: "white" }} 
            />
          </Box>
                    <Box mt={2} mb={4}>
            <Text size="small" bold style={{ marginBottom: "8px" }}>Giờ kết thúc:</Text>
            <input 
              type="time" 
              value={endTime} 
              onChange={(e) => setEndTime(e.target.value)} 
              step="1800"
              style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #CBD5E1", backgroundColor: "white" }} 
            />
          </Box>

          <Box mt={6} flex flexDirection="row" justifyContent="space-between">
            <Button variant="secondary" onClick={() => setShowBookingModal(false)} style={{ width: "48%" }}>
              Hủy
            </Button>
            <Button variant="primary" onClick={submitBooking} style={{ width: "48%" }}>
              Xác nhận
            </Button>
          </Box>
        </Box>
      </Modal>
    </Page>
  );
}
