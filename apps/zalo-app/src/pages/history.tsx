import React, { useEffect, useState } from "react";
import { Page, Header, Box, Text, Icon, useSnackbar, useNavigate } from "zmp-ui";
import { API_BASE_URL } from "../config/api";
import { openPaymentLink } from "../utils/payment";

const formatVnd = (amount: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount);

const getLocalDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const readOrderSnapshot = (booking: any) => {
  try {
    return booking.orderedItems ? JSON.parse(booking.orderedItems) : {};
  } catch (error) {
    console.error("Không đọc được chi tiết giá đặt sân:", error);
    return {};
  }
};

const HistoryPage = () => {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [phone, setPhone] = useState(
    () => localStorage.getItem("quan-ly-san-cau-long_phone") || ""
  );
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => Boolean(localStorage.getItem("portal_token"))
  );
  const [changeRequest, setChangeRequest] = useState<{ booking: any; type: "CANCELLATION" | "RESCHEDULE" } | null>(null);
  const [changeReason, setChangeReason] = useState("");
  const [requestedDate, setRequestedDate] = useState(getLocalDate(new Date()));
  const [requestedStart, setRequestedStart] = useState("09:00");
  const [requestedEnd, setRequestedEnd] = useState("10:00");
  const [submittingChange, setSubmittingChange] = useState(false);
  const [payingRequestId, setPayingRequestId] = useState<string | null>(null);
  const { openSnackbar } = useSnackbar();

  const fetchHistory = (searchPhone?: string) => {
    const token = localStorage.getItem("portal_token");
    const targetPhone = (searchPhone !== undefined ? searchPhone : phone).trim();

    // Nếu không có token và cũng không có số điện thoại
    if (!token && !targetPhone) {
      setBookings([]);
      setLoading(false);
      setHasSearched(true);
      return;
    }

    setLoading(true);
    setHasSearched(true);

    // Ưu tiên: nếu có token đăng nhập và không truyền searchPhone cụ thể
    let url = `${API_BASE_URL}/booking-requests/public/my-requests`;
    const headers: any = {};

    if (token && !searchPhone) {
      headers["Authorization"] = `Bearer ${token}`;
    } else if (targetPhone) {
      url += `?phone=${encodeURIComponent(targetPhone)}`;
      localStorage.setItem("quan-ly-san-cau-long_phone", targetPhone);
    }

    fetch(url, { headers })
      .then((res) => {
        if (res.status === 401 && token && !searchPhone) {
          localStorage.removeItem("portal_token");
          localStorage.removeItem("portal_customer");
          setIsAuthenticated(false);
          // Thử tìm theo SĐT nếu token hết hạn
          if (targetPhone) {
            return fetch(`${API_BASE_URL}/booking-requests/public/my-requests?phone=${encodeURIComponent(targetPhone)}`).then(r => r.json());
          }
          throw new Error("Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.");
        }
        return res.json();
      })
      .then((data) => {
        if (data.success) {
          setBookings(data.data || []);
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
          text: err instanceof Error ? err.message : "Không thể kết nối đến máy chủ",
        });
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    const token = localStorage.getItem("portal_token");
    const savedPhone = localStorage.getItem("quan-ly-san-cau-long_phone");
    if (token) {
      fetchHistory();
    } else if (savedPhone) {
      setPhone(savedPhone);
      fetchHistory(savedPhone);
    }
  }, []);

  const getAmounts = (booking: any) => {
    const order = readOrderSnapshot(booking);
    const total = Number(order.totalAmount ?? booking.paymentAmount ?? 0);
    const received = Number(order.paidAmount ?? (booking.paymentStatus === "PAID" ? booking.paymentAmount : 0));
    return {
      total,
      received,
      due: Math.max(0, total - received),
      refundDue: Math.max(0, Number(order.refundDueAmount || 0)),
    };
  };

  const openChangeRequest = (booking: any, type: "CANCELLATION" | "RESCHEDULE") => {
    setChangeRequest({ booking, type });
    setChangeReason("");
    setRequestedDate(getLocalDate(new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)));
    setRequestedStart(booking.startTime || "09:00");
    setRequestedEnd(booking.endTime || "10:00");
  };

  const submitChangeRequest = async () => {
    if (!changeRequest || !changeReason.trim()) {
      openSnackbar({ type: "warning", text: "Vui lòng nhập lý do." });
      return;
    }
    const token = localStorage.getItem("portal_token");
    const targetPhone = phone || changeRequest.booking.phone || localStorage.getItem("quan-ly-san-cau-long_phone") || "";

    setSubmittingChange(true);
    try {
      const isReschedule = changeRequest.type === "RESCHEDULE";
      const headers: any = { "Content-Type": "application/json" };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(
        `${API_BASE_URL}/booking-requests/public/${changeRequest.booking.id}/${isReschedule ? "reschedule-request" : "cancel-request"}`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            reason: changeReason.trim(),
            phone: targetPhone,
            ...(isReschedule ? {
              date: requestedDate,
              startTime: requestedStart,
              endTime: requestedEnd,
            } : {}),
          }),
        }
      );
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Không gửi được yêu cầu.");
      }
      setChangeRequest(null);
      const proposedTotal = Number(readOrderSnapshot(data.data).requestedTotalAmount);
      openSnackbar({
        type: "success",
        text: isReschedule && Number.isFinite(proposedTotal)
          ? `Đã gửi yêu cầu đổi lịch. Tổng dự kiến theo giá giờ mới: ${formatVnd(proposedTotal)}. Chờ cơ sở duyệt.`
          : isReschedule ? "Đã gửi yêu cầu đổi lịch; lịch cũ giữ nguyên đến khi Admin duyệt." : "Đã gửi yêu cầu hủy; lịch chỉ hủy sau khi Admin duyệt.",
      });
      fetchHistory(targetPhone);
    } catch (error) {
      openSnackbar({
        type: "warning",
        text: error instanceof Error ? error.message : "Không gửi được yêu cầu.",
      });
    } finally {
      setSubmittingChange(false);
    }
  };

  const payRemaining = async (booking: any) => {
    setPayingRequestId(booking.id);
    try {
      openSnackbar({
        type: "success",
        text: "Đang tạo liên kết thanh toán VNPAY Sandbox...",
      });
      const response = await fetch(`${API_BASE_URL}/vnpay/create-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: booking.id, source: "zalo" }),
      });
      const data = await response.json();
      if (!response.ok || !data.success || !data.payUrl) {
        throw new Error(data.message || "Không tạo được liên kết thanh toán VNPay Sandbox.");
      }
      openSnackbar({
        type: "success",
        text: "Đang mở cổng thanh toán VNPAY Sandbox...",
      });
      await openPaymentLink(data.payUrl);
    } catch (error) {
      openSnackbar({
        type: "warning",
        text: error instanceof Error ? error.message : "Không thể kết nối đến cổng thanh toán.",
      });
    } finally {
      setPayingRequestId(null);
    }
  };

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
          text: "Đã duyệt / Xác nhận",
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

      {/* KHUNG TRA CỨU SỐ ĐIỆN THOẠI (DÀNH CHO KHÁCH VÃNG LAI & TÀI KHOẢN) */}
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
          <label
            style={{
              fontSize: "13px",
              fontWeight: "700",
              color: "#1E293B",
            }}
          >
            🔍 Tra cứu theo Số điện thoại
          </label>
          {isAuthenticated && (
            <span
              style={{
                fontSize: "11px",
                color: "#059669",
                backgroundColor: "#ECFDF5",
                padding: "2px 8px",
                borderRadius: "6px",
                fontWeight: "600",
              }}
            >
              👤 Đã đăng nhập
            </span>
          )}
        </div>

        <div style={{ display: "flex", gap: "8px" }}>
          <input
            type="tel"
            placeholder="Nhập số điện thoại đã đặt sân..."
            className="modern-input"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") fetchHistory(phone);
            }}
            style={{ flex: 1 }}
          />
          <button
            type="button"
            onClick={() => fetchHistory(phone)}
            disabled={loading}
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
            {loading ? "Đang tìm..." : "Tìm vé"}
          </button>
        </div>

        <div
          style={{
            fontSize: "11px",
            color: "#64748B",
            marginTop: "8px",
            display: "flex",
            alignItems: "center",
            gap: "4px",
          }}
        >
          <span>💡 Khách vãng lai chỉ cần nhập SĐT lúc đặt sân là xem được toàn bộ vé & trạng thái.</span>
        </div>
      </div>

      {/* Trạng thái đang tải */}
      {loading ? (
        <div
          style={{
            padding: "40px 20px",
            textAlign: "center",
            backgroundColor: "#FFFFFF",
            borderRadius: "16px",
            color: "#64748B",
            fontSize: "13px",
            border: "1px solid #E2E8F0",
          }}
        >
          <div style={{ fontSize: "24px", marginBottom: "8px" }}>⏳</div>
          Đang tra cứu lịch đặt sân của bạn...
        </div>
      ) : hasSearched && bookings.length === 0 ? (
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
            Không tìm thấy lịch đặt sân
          </div>
          <div style={{ fontSize: "12px", color: "#64748B", marginBottom: "16px" }}>
            {phone ? `Chưa có đơn đặt sân nào với số điện thoại ${phone}.` : "Vui lòng nhập số điện thoại để tra cứu vé."}
          </div>
          <button
            type="button"
            onClick={() => navigate("/")}
            style={{
              padding: "10px 20px",
              borderRadius: "10px",
              background: "#059669",
              color: "#FFFFFF",
              fontSize: "13px",
              fontWeight: "700",
              border: "none",
              cursor: "pointer",
            }}
          >
            Đặt sân mới ngay
          </button>
        </div>
      ) : bookings.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ fontSize: "12px", fontWeight: "700", color: "#475569", paddingLeft: "4px" }}>
            📋 Tìm thấy {bookings.length} lượt đặt sân ({phone || "Tài khoản của bạn"}):
          </div>

          {bookings.map((b, idx) => {
            const st = getStatusBadge(b.status);
            const amounts = getAmounts(b);
            const requestedTotal = Number(readOrderSnapshot(b).requestedTotalAmount);
            const hasRequestedTotal = Number.isFinite(requestedTotal) && requestedTotal >= 0;
            const changeStatusText = b.cancellationRequestStatus === "PENDING"
              ? `Đang chờ Admin duyệt ${b.cancellationRequestType === "RESCHEDULE" ? "đổi lịch" : "hủy lịch"}`
              : b.cancellationRequestStatus === "REJECTED"
                ? `Admin đã từ chối yêu cầu ${b.cancellationRequestType === "RESCHEDULE" ? "đổi lịch" : "hủy lịch"}`
                : "";
            const canChange = ["PENDING", "APPROVED"].includes(b.status) &&
              b.cancellationRequestStatus !== "PENDING" &&
              new Date(`${String(b.date).slice(0, 10)}T${b.startTime}:00`).getTime() - Date.now() >= 24 * 60 * 60_000;

            const isPaid = b.paymentStatus === "PAID";

            return (
              <div
                key={b.id || idx}
                style={{
                  backgroundColor: "#FFFFFF",
                  borderRadius: "16px",
                  padding: "16px",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                  border: isPaid ? "1px solid #BBF7D0" : "1px solid #E2E8F0",
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

                {changeStatusText && (
                  <div style={{ marginBottom: "8px", padding: "8px 10px", borderRadius: "8px", background: b.cancellationRequestStatus === "PENDING" ? "#FFFBEB" : "#EFF6FF", color: b.cancellationRequestStatus === "PENDING" ? "#92400E" : "#1D4ED8", fontSize: "11px", fontWeight: 700 }}>
                    {changeStatusText}
                  </div>
                )}

                {/* Thông tin chi tiết */}
                <div
                  style={{
                    backgroundColor: "#F8FAFC",
                    borderRadius: "10px",
                    padding: "10px 12px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
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
                    <span style={{ color: "#64748B" }}>Người đặt:</span>
                    <span style={{ fontWeight: "700", color: "#1E293B" }}>
                      {b.name} ({b.phone})
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "12px",
                    }}
                  >
                    <span style={{ color: "#64748B" }}>Ngày chơi:</span>
                    <span style={{ fontWeight: "700", color: "#1E293B" }}>
                      📅 {new Date(b.date).toLocaleDateString("vi-VN")}
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
                    <span style={{ color: "#64748B" }}>Thanh toán:</span>
                    <span
                      style={{
                        fontWeight: "700",
                        color: isPaid ? "#059669" : "#D97706",
                      }}
                    >
                      {isPaid ? "🟢 Đã thanh toán" : "🟡 Chưa thanh toán"} ({b.paymentMethod === "VNPAY" ? "VNPAY" : "Chuyển khoản VietQR"})
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "12px",
                      paddingTop: "4px",
                      borderTop: "1px dashed #E2E8F0",
                    }}
                  >
                    <span style={{ color: "#64748B" }}>Tổng tiền sân:</span>
                    <span style={{ fontWeight: "800", color: "#0F172A", fontSize: "13px" }}>
                      {formatVnd(amounts.total)}
                    </span>
                  </div>
                  {amounts.due > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
                      <span style={{ color: "#B45309", fontWeight: "600" }}>Còn phải trả:</span>
                      <span style={{ fontWeight: "800", color: "#B45309" }}>{formatVnd(amounts.due)}</span>
                    </div>
                  )}
                  {amounts.refundDue > 0 && (
                    <div style={{ fontSize: "11px", color: "#92400E", marginTop: "4px" }}>
                      Cần Admin xử lý hoàn chênh lệch: {formatVnd(amounts.refundDue)}.
                    </div>
                  )}
                  {b.cancellationRequestStatus === "PENDING" && b.cancellationRequestType === "RESCHEDULE" && (
                    <div style={{ fontSize: "11px", color: "#92400E", marginTop: "4px" }}>
                      Đang chờ duyệt đổi lịch{hasRequestedTotal
                        ? ` · Tổng dự kiến ${formatVnd(requestedTotal)}`
                        : ""}
                    </div>
                  )}
                </div>

                {/* Hướng dẫn chuyển khoản VietQR nếu chưa thanh toán */}
                {b.paymentMethod === "DEPOSIT_TRANSFER" && b.transferReference && amounts.due > 0 && (
                  <div style={{ background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: "10px", padding: "10px 12px", marginBottom: "10px", fontSize: "12px" }}>
                    <div>👉 Chuyển khoản giữ sân: <strong>{formatVnd(amounts.due)}</strong></div>
                    <div style={{ marginTop: "2px" }}>Nội dung CK: <strong style={{ color: "#047857" }}>{b.transferReference}</strong></div>
                  </div>
                )}

                {/* Nút thanh toán VNPAY nếu chưa trả */}
                {b.paymentMethod === "VNPAY" && ["PENDING", "APPROVED"].includes(b.status) && b.paymentStatus !== "PAID" && amounts.due > 0 && (
                  <button
                    type="button"
                    onClick={() => payRemaining(b)}
                    disabled={payingRequestId === b.id}
                    style={{ width: "100%", marginBottom: "10px", padding: "11px", border: "none", borderRadius: "10px", background: "linear-gradient(135deg, #059669 0%, #047857 100%)", color: "#fff", fontWeight: 700, fontSize: "13px", cursor: "pointer", boxShadow: "0 2px 6px rgba(5,150,105,0.25)" }}
                  >
                    {payingRequestId === b.id ? "Đang mở VNPAY Sandbox..." : `Thanh toán ${formatVnd(amounts.due)} qua VNPAY ↗`}
                  </button>
                )}

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

                {canChange && (
                  <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                    <button type="button" onClick={() => openChangeRequest(b, "CANCELLATION")} style={{ flex: 1, padding: "10px", border: "1px solid #FECACA", borderRadius: "10px", background: "#FFF1F2", color: "#BE123C", fontWeight: 700, fontSize: "12px" }}>
                      Yêu cầu hủy
                    </button>
                    <button type="button" onClick={() => openChangeRequest(b, "RESCHEDULE")} style={{ flex: 1, padding: "10px", border: "1px solid #BFDBFE", borderRadius: "10px", background: "#EFF6FF", color: "#1D4ED8", fontWeight: 700, fontSize: "12px" }}>
                      Yêu cầu đổi lịch
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : null}

      {/* MODAL HỦY / ĐỔI LỊCH */}
      {changeRequest && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(15,23,42,.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
          <div style={{ width: "100%", maxWidth: "420px", maxHeight: "90vh", overflowY: "auto", borderRadius: "16px", background: "#fff", padding: "18px" }}>
            <h2 style={{ margin: "0 0 8px", fontSize: "17px", fontWeight: 800, color: "#0f172a" }}>
              {changeRequest.type === "RESCHEDULE" ? "Yêu cầu đổi lịch" : "Yêu cầu hủy lịch"}
            </h2>
            <p style={{ fontSize: "12px", color: "#64748b" }}>Lịch hiện tại: {new Date(changeRequest.booking.date).toLocaleDateString("vi-VN")} · {changeRequest.booking.startTime}–{changeRequest.booking.endTime}</p>
            <p style={{ fontSize: "11px", color: "#92400e", background: "#fffbeb", borderRadius: "8px", padding: "10px" }}>
              Gửi yêu cầu trước giờ bắt đầu ít nhất 24 giờ. Lịch hiện tại giữ nguyên đến khi Admin duyệt. Đổi lịch được tính lại theo bảng giá khung giờ mới; nếu giảm tiền, Admin sẽ xử lý hoàn chênh lệch riêng.
            </p>
            {changeRequest.type === "RESCHEDULE" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", margin: "12px 0" }}>
                <label style={{ fontSize: "12px", fontWeight: 700 }}>Ngày mới
                  <input type="date" value={requestedDate} min={getLocalDate(new Date())} onChange={(event) => setRequestedDate(event.target.value)} style={{ display: "block", width: "100%", marginTop: "4px", padding: "8px", border: "1px solid #cbd5e1", borderRadius: "8px" }} />
                </label>
                <span />
                <label style={{ fontSize: "12px", fontWeight: 700 }}>Bắt đầu
                  <input type="time" step={1800} value={requestedStart} onChange={(event) => setRequestedStart(event.target.value)} style={{ display: "block", width: "100%", marginTop: "4px", padding: "8px", border: "1px solid #cbd5e1", borderRadius: "8px" }} />
                </label>
                <label style={{ fontSize: "12px", fontWeight: 700 }}>Kết thúc
                  <input type="time" step={1800} value={requestedEnd} onChange={(event) => setRequestedEnd(event.target.value)} style={{ display: "block", width: "100%", marginTop: "4px", padding: "8px", border: "1px solid #cbd5e1", borderRadius: "8px" }} />
                </label>
              </div>
            )}
            <label style={{ display: "block", fontSize: "12px", fontWeight: 700 }}>Lý do
              <textarea value={changeReason} onChange={(event) => setChangeReason(event.target.value)} maxLength={500} rows={3} placeholder="Nhập lý do..." style={{ display: "block", width: "100%", marginTop: "4px", padding: "8px", border: "1px solid #cbd5e1", borderRadius: "8px", resize: "vertical" }} />
            </label>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "14px" }}>
              <button type="button" onClick={() => setChangeRequest(null)} disabled={submittingChange} style={{ padding: "9px 14px", border: "1px solid #cbd5e1", borderRadius: "8px", background: "#fff" }}>Đóng</button>
              <button type="button" onClick={submitChangeRequest} disabled={submittingChange || !changeReason.trim() || (changeRequest.type === "RESCHEDULE" && (!requestedDate || !requestedStart || !requestedEnd || requestedEnd <= requestedStart))} style={{ padding: "9px 14px", border: "none", borderRadius: "8px", background: "#047857", color: "#fff", fontWeight: 700 }}>
                {submittingChange ? "Đang gửi..." : "Gửi yêu cầu"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Page>
  );
};

export default HistoryPage;
