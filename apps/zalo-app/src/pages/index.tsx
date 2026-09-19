import React, { useState, useEffect } from "react";
import { Page, Header, Box, Text, Button, Icon, List, Modal, useSnackbar } from "zmp-ui";
import { useNavigate } from "zmp-ui";

// Cấu hình API Backend của bạn
const API_URL = "http://192.168.1.17:3005/api";

export default function HomePage() {
  const navigate = useNavigate();
  const { openSnackbar } = useSnackbar();
  const [venues, setVenues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Trạng thái khi đặt sân
  const [selectedVenue, setSelectedVenue] = useState<any>(null);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookingDate, setBookingDate] = useState("");
  const [bookingTime, setBookingTime] = useState("");

  // Gọi API lấy danh sách sân từ Backend
  useEffect(() => {
    fetch(`${API_URL}/venues`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setVenues(data.data.items || data.data);
        }
      })
      .catch((err) => {
        console.error("Lỗi lấy dữ liệu sân:", err);
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

  const handleBookClick = (venue: any) => {
    setSelectedVenue(venue);
    setShowBookingModal(true);
  };

  const submitBooking = () => {
    if (!bookingDate || !bookingTime) {
      openSnackbar({ type: "warning", text: "Vui lòng chọn ngày và giờ!" });
      return;
    }
    
    // Ở đây bạn sẽ gọi API POST lên backend để tạo booking thực tế
    openSnackbar({ type: "success", text: "Đặt sân thành công! Chúng tôi sẽ liên hệ Zalo bạn." });
    setShowBookingModal(false);
    setBookingDate("");
    setBookingTime("");
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
        <Box flex flexDirection="column" alignItems="center">
          <Box p={3} style={{ backgroundColor: "#FEF2F2", borderRadius: "12px", marginBottom: "4px" }}>
            <Icon icon="zi-list-1" style={{ color: "#EF4444" }} />
          </Box>
          <Text size="xSmall" bold>Lịch sử</Text>
        </Box>
        <Box flex flexDirection="column" alignItems="center">
          <Box p={3} style={{ backgroundColor: "#F5F3FF", borderRadius: "12px", marginBottom: "4px" }}>
            <Icon icon="zi-user" style={{ color: "#8B5CF6" }} />
          </Box>
          <Text size="xSmall" bold>Thành viên</Text>
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
                <Button size="small" fullWidth onClick={() => handleBookClick(venue)}>
                  Chọn cơ sở này
                </Button>
              </Box>
            ))}
          </List>
        )}
      </Box>

      {/* Đáy trang */}
      <Box p={4} textAlign="center">
        <Text size="xSmall" style={{ color: "#94A3B8" }}>Powered by Courtify Team & Zalo Mini App</Text>
      </Box>

      {/* Modal Đặt Sân */}
      <Modal
        visible={showBookingModal}
        title="Chọn thời gian"
        onClose={() => setShowBookingModal(false)}
      >
        <Box p={4}>
          <Text.Title size="small" style={{ marginBottom: "12px" }}>
            {selectedVenue?.name}
          </Text.Title>
          
          <Text size="small" bold style={{ marginTop: "16px", marginBottom: "8px" }}>Ngày chơi:</Text>
          <input 
            type="date" 
            value={bookingDate}
            onChange={(e) => setBookingDate(e.target.value)}
            style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #CBD5E1" }}
          />

          <Text size="small" bold style={{ marginTop: "16px", marginBottom: "8px" }}>Khung giờ:</Text>
          <input 
            type="time" 
            value={bookingTime}
            onChange={(e) => setBookingTime(e.target.value)}
            style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #CBD5E1" }}
          />

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
