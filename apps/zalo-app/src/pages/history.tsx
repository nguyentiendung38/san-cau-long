import React, { useEffect, useState } from "react";
import { Page, Header, Box, Text, List, Icon, useSnackbar, Input, Button } from "zmp-ui";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:3005/api";

const HistoryPage = () => {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [phone, setPhone] = useState<string>(localStorage.getItem("courtify_phone") || "");
  const { openSnackbar } = useSnackbar();

  const fetchHistory = (phoneNumber: string) => {
    if (!phoneNumber) return;
    setLoading(true);
    fetch(`${API_URL}/booking-requests/public/my-requests?phone=${phoneNumber}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setBookings(data.data || []);
          if (data.data && data.data.length > 0) {
            localStorage.setItem("courtify_phone", phoneNumber);
          }
        } else {
          openSnackbar({ type: "warning", text: data.message || "Lỗi tải lịch sử" });
        }
      })
      .catch((err) => {
        console.error("Lỗi tải lịch sử:", err);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    if (phone) {
      fetchHistory(phone);
    }
  }, []);

  const getStatusText = (status: string) => {
    switch (status) {
      case "PENDING":
        return { text: "Chờ duyệt", color: "text-amber-500" };
      case "APPROVED":
      case "CONFIRMED":
        return { text: "Đã chốt", color: "text-green-500" };
      case "COMPLETED":
        return { text: "Đã hoàn thành", color: "text-blue-500" };
      case "REJECTED":
      case "CANCELLED":
        return { text: "Đã hủy", color: "text-red-500" };
      default:
        return { text: status, color: "text-gray-500" };
    }
  };

  return (
    <Page className="page">
      <Header title="Lịch sử đặt sân" />
      
      <Box p={4} style={{ backgroundColor: "#f4f5f6", minHeight: "100vh" }}>
        
        <Box className="bg-white p-4 rounded-xl shadow-sm mb-4">
          <Text bold className="mb-2">Tra cứu lịch sử</Text>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input 
              type="tel"
              placeholder="Nhập số điện thoại..."
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "1px solid #CBD5E1" }}
            />
            <Button onClick={() => fetchHistory(phone)}>Tra cứu</Button>
          </div>
        </Box>

        {loading ? (
          <Text className="text-center text-gray-500 mt-4">Đang tải dữ liệu...</Text>
        ) : bookings.length === 0 ? (
          <Box className="bg-white p-6 rounded-xl text-center shadow-sm">
            <Icon icon="zi-info-circle" style={{ color: "#8B5CF6", fontSize: 48, marginBottom: 16 }} />
            <Text className="text-gray-500">
              Chưa có lịch sử đặt sân cho số điện thoại này.
            </Text>
          </Box>
        ) : (
          <List>
            {bookings.map((b, idx) => {
              const st = getStatusText(b.status);
              return (
                <Box key={idx} p={4} mb={4} className="bg-white rounded-xl shadow-sm relative">
                  <Text className={`absolute top-4 right-4 text-xs font-bold ${st.color}`}>
                    {st.text}
                  </Text>
                  <Text bold size="normal" className="mb-2 pr-16">
                    {b.venue?.name || "Cơ sở cầu lông"} - {b.court?.name || "Sân"}
                  </Text>
                  <Text size="small" className="text-gray-600 mb-1">
                    <span className="font-medium">Ngày:</span> {new Date(b.date).toLocaleDateString("vi-VN")}
                  </Text>
                  <Text size="small" className="text-gray-600 mb-1">
                    <span className="font-medium">Giờ:</span> {b.startTime} - {b.endTime}
                  </Text>
                  <Text size="small" className="text-gray-600 mb-2">
                    <span className="font-medium">Tiền sân:</span> {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(b.paymentAmount || b.totalAmount || 0)}
                  </Text>
                  <Box className="border-t border-gray-100 pt-2 mt-2">
                    <Text size="xSmall" className="text-gray-400">
                      Mã đơn: {b.id.substring(0, 8).toUpperCase()} • Đặt lúc {new Date(b.createdAt).toLocaleDateString("vi-VN")}
                    </Text>
                  </Box>
                </Box>
              );
            })}
          </List>
        )}
      </Box>
    </Page>
  );
};

export default HistoryPage;
