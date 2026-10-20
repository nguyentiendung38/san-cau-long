import React, { useEffect, useState } from "react";
import { Page, Header, Box, Text, Icon, useSnackbar, useNavigate } from "zmp-ui";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:3005/api";

const HistoryPage = () => {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [phone, setPhone] = useState<string>(
    localStorage.getItem("quan-ly-san-cau-long_phone") || ""
  );
  const { openSnackbar } = useSnackbar();

  const fetchHistory = (phoneNumber: string) => {
    if (!phoneNumber.trim()) {
      openSnackbar({
        type: "warning",
        text: "Vui lòng nhập số điện thoại để tra cứu!",
      });
      return;
    }
    setLoading(true);
    fetch(`${API_URL}/booking-requests/public/my-requests?phone=${phoneNumber.trim()}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          const zaloBookings = (data.data || []).filter(
            (b: any) => b.notes && b.notes.includes("Zalo")
          );
          setBookings(zaloBookings.length > 0 ? zaloBookings : data.data || []);
          if (data.data && data.data.length > 0) {
            localStorage.setItem("quan-ly-san-cau-long_phone", phoneNumber.trim());
          }
        } else {
          openSnackbar({
            type: "warning",
            text: data.message || "Lỗi tải lịch sử đặt sân",
          });
        }
      })
      .catch((err) => {
        console.error("Lỗi tải lịch sử:", err);
        openSnackbar({
          type: "warning",
          text: "Không thể kết nối đến máy chủ",
        });
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return {
          text: "Chờ duyệt",
          bg: "#FEF3C7",
          color: "#D97706",
          border: "#FDE68A",
        };
      case "APPROVED":
      case "CONFIRMED":
        return {
          text: "Đã xác nhận",
          bg: "#ECFDF5",
          color: "#059669",
          border: "#A7F3D0",
        };
      case "COMPLETED":
        return {
          text: "Hoàn thành",
          bg: "#EFF6FF",
          color: "#2563EB",
          border: "#BFDBFE",
        };
      case "REJECTED":
      case "CANCELLED":
        return {
          text: "Đã hủy",
          bg: "#FEF2F2",
          color: "#DC2626",
          border: "#FECACA",
        };
      default:
        return {
          text: status,
          bg: "#F1F5F9",
          color: "#64748B",
          border: "#CBD5E1",
        };
    }
  };

  return (
    <Page className="page page-with-header">
      <Header
        title="Lịch Sử & Vé Đặt Sân"
        showBackIcon={true}
        onBackClick={() => navigate(-1)}
      />

      {/* Tra cứu qua số điện thoại */}
      <div
        style={{
          backgroundColor: "#FFFFFF",
          borderRadius: "16px",
          padding: "16px",
          marginBottom: "14px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          border: "1px solid #E2E8F0",
        }}
      >
        <label
          style={{
            fontSize: "12px",
            fontWeight: "700",
            color: "#1E293B",
            display: "block",
            marginBottom: "8px",
          }}
        >
          🔍 Nhập số điện thoại Zalo của bạn:
        </label>
        <div style={{ display: "flex", gap: "8px" }}>
          <input
            type="tel"
            placeholder="Ví dụ: 0912345678"
            className="modern-input"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <button
            type="button"
            onClick={() => fetchHistory(phone)}
            style={{
              padding: "0 18px",
              borderRadius: "12px",
              background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
              color: "#FFFFFF",
              fontSize: "13px",
              fontWeight: "700",
              border: "none",
              cursor: "pointer",
              boxShadow: "0 2px 6px rgba(5,150,105,0.25)",
              flexShrink: 0,
            }}
          >
            Tra cứu
          </button>
        </div>
      </div>

      {/* Danh sách kết quả */}
      {loading ? (
        <div
          style={{
            padding: "40px 20px",
            textAlign: "center",
            backgroundColor: "#FFFFFF",
            borderRadius: "16px",
            color: "#64748B",
            fontSize: "13px",
          }}
        >
          Đang kiểm tra lịch sử đặt sân...
        </div>
      ) : bookings.length === 0 ? (
        <div
          style={{
            padding: "40px 20px",
            textAlign: "center",
            backgroundColor: "#FFFFFF",
            borderRadius: "16px",
            border: "1px dashed #CBD5E1",
          }}
        >
          <div style={{ fontSize: "36px", marginBottom: "8px" }}>🎟️</div>
          <div
            style={{
              fontSize: "14px",
              fontWeight: "700",
              color: "#334155",
              marginBottom: "4px",
            }}
          >
            Chưa có lịch đặt sân
          </div>
          <div style={{ fontSize: "12px", color: "#64748B" }}>
            Vui lòng nhập số điện thoại bạn đã dùng khi đặt sân trên hệ thống.
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {bookings.map((b, idx) => {
            const st = getStatusBadge(b.status);
            return (
              <div
                key={b.id || idx}
                style={{
                  backgroundColor: "#FFFFFF",
                  borderRadius: "16px",
                  padding: "16px",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                  border: "1px solid #E2E8F0",
                  position: "relative",
                }}
              >
                {/* Header vé */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: "10px",
                  }}
                >
                  <div style={{ paddingRight: "70px" }}>
                    <div
                      style={{
                        fontSize: "14px",
                        fontWeight: "800",
                        color: "#0F172A",
                        lineHeight: "1.3",
                      }}
                    >
                      {b.venue?.name || "Nhà Thi Đấu Đa Năng HUE"}
                    </div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#059669",
                        fontWeight: "700",
                        marginTop: "2px",
                      }}
                    >
                      🏸 {b.court?.name || "Sân thi đấu"}
                    </div>
                  </div>

                  <span
                    style={{
                      position: "absolute",
                      top: "16px",
                      right: "16px",
                      fontSize: "11px",
                      fontWeight: "700",
                      backgroundColor: st.bg,
                      color: st.color,
                      border: `1px solid ${st.border}`,
                      padding: "3px 8px",
                      borderRadius: "6px",
                    }}
                  >
                    {st.text}
                  </span>
                </div>

                {/* Thông tin chi tiết */}
                <div
                  style={{
                    backgroundColor: "#F8FAFC",
                    borderRadius: "10px",
                    padding: "10px 12px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                    marginBottom: "10px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "12px",
                    }}
                  >
                    <span style={{ color: "#64748B" }}>Ngày chơi:</span>
                    <span style={{ fontWeight: "700", color: "#1E293B" }}>
                      {new Date(b.date).toLocaleDateString("vi-VN")}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "12px",
                    }}
                  >
                    <span style={{ color: "#64748B" }}>Khung giờ:</span>
                    <span style={{ fontWeight: "700", color: "#059669" }}>
                      ⏰ {b.startTime} - {b.endTime}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "12px",
                    }}
                  >
                    <span style={{ color: "#64748B" }}>Tiền sân:</span>
                    <span style={{ fontWeight: "800", color: "#0F172A" }}>
                      {new Intl.NumberFormat("vi-VN", {
                        style: "currency",
                        currency: "VND",
                      }).format(b.paymentAmount || b.totalAmount || 0)}
                    </span>
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: "10px",
                    color: "#94A3B8",
                  }}
                >
                  <span>MÃ: {String(b.id || "").substring(0, 8).toUpperCase()}</span>
                  <span>
                    Đặt lúc: {new Date(b.createdAt || Date.now()).toLocaleDateString("vi-VN")}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Page>
  );
};

export default HistoryPage;
