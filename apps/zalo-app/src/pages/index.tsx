import bannerImg from "../static/nha-thi-dau-hue.jpg";
import logoHue from "../static/logo-hue.jpg";
import React, { useState, useEffect } from "react";
import { Page, Box, Text, Button, Icon, Modal, useSnackbar } from "zmp-ui";
import { useNavigate } from "zmp-ui";
import { API_BASE_URL } from "../config/api";
import { openPaymentLink } from "../utils/payment";

const getLocalDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const translateDays = (daysStr: string) => {
  if (!daysStr) return "Tất cả các ngày";

  if (daysStr.startsWith("[")) {
    try {
      const arr = JSON.parse(daysStr);
      const numMap: any = {
        0: "CN",
        1: "T2",
        2: "T3",
        3: "T4",
        4: "T5",
        5: "T6",
        6: "T7",
      };
      if (arr.length === 7) return "Tất cả các ngày";

      const sorted = arr.sort((a: number, b: number) => {
        if (a === 0) return 1;
        if (b === 0) return -1;
        return a - b;
      });
      return sorted.map((n: number) => numMap[n]).join(", ");
    } catch (e) {}
  }

  const map: any = {
    MONDAY: "T2",
    TUESDAY: "T3",
    WEDNESDAY: "T4",
    THURSDAY: "T5",
    FRIDAY: "T6",
    SATURDAY: "T7",
    SUNDAY: "CN",
  };
  return daysStr
    .split(",")
    .map((d: string) => map[d.trim()] || d)
    .join(", ");
};

const getOperatingStatus = (venue: any, targetDate: Date = new Date()) => {
  const dayOfWeek = targetDate.getDay();
  const dayNames = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];
  const dayName = dayNames[dayOfWeek];

  const parseDays = (d: any): number[] => {
    if (!d) return [];
    if (Array.isArray(d)) return d;
    try {
      return JSON.parse(d);
    } catch {
      return [];
    }
  };

  const allHours = venue?.operatingHours || [];

  if (allHours.length === 0) {
    if (venue?.openTime && venue?.closeTime) {
      const currMins = targetDate.getHours() * 60 + targetDate.getMinutes();
      const [sH, sM] = venue.openTime.split(":").map(Number);
      const [eH, eM] = venue.closeTime.split(":").map(Number);
      const startM = sH * 60 + sM;
      const endM = eH * 60 + eM;
      const isOpen = currMins >= startM && currMins < endM;
      return {
        isOpen,
        text: `${venue.openTime} - ${venue.closeTime}`,
        statusLabel: isOpen
          ? "Đang mở cửa"
          : currMins < startM
          ? `Mở cửa lúc ${venue.openTime}`
          : "Đã đóng cửa",
        dayName,
        badgeType: isOpen ? "open" : currMins < startM ? "upcoming" : "closed",
      };
    }
    return {
      isOpen: false,
      text: "06:00 - 23:00",
      statusLabel: "Chưa cập nhật giờ",
      dayName,
      badgeType: "closed",
    };
  }

  // Lọc khung giờ hoạt động của ngày hôm nay
  const todayHours = allHours
    .filter((oh: any) => {
      if (oh.isActive === false) return false;
      const days = parseDays(oh.daysOfWeek);
      return days.includes(dayOfWeek);
    })
    .sort((a: any, b: any) => a.startTime.localeCompare(b.startTime));

  if (todayHours.length === 0) {
    return {
      isOpen: false,
      text: "Nghỉ hôm nay",
      statusLabel: "Đóng cửa hôm nay",
      dayName,
      badgeType: "closed",
    };
  }

  const currMins = targetDate.getHours() * 60 + targetDate.getMinutes();
  let isOpen = false;
  let nextOpenTime = "";
  let isDuringBreak = false;

  for (let i = 0; i < todayHours.length; i++) {
    const oh = todayHours[i];
    const [sH, sM] = oh.startTime.split(":").map(Number);
    const [eH, eM] = oh.endTime.split(":").map(Number);
    const startM = sH * 60 + sM;
    const endM = eH * 60 + eM;

    if (currMins >= startM && currMins < endM) {
      isOpen = true;
      break;
    }

    if (currMins < startM && !nextOpenTime) {
      nextOpenTime = oh.startTime;
      if (i > 0) isDuringBreak = true;
    }
  }

  const hoursText = todayHours
    .map((oh: any) => `${oh.startTime} - ${oh.endTime}`)
    .join(", ");

  let statusLabel = "Đã đóng cửa";
  let badgeType = "closed";

  if (isOpen) {
    statusLabel = "Đang mở cửa";
    badgeType = "open";
  } else if (isDuringBreak && nextOpenTime) {
    statusLabel = `Nghỉ trưa (mở ${nextOpenTime})`;
    badgeType = "upcoming";
  } else if (nextOpenTime) {
    statusLabel = `Mở cửa lúc ${nextOpenTime}`;
    badgeType = "upcoming";
  }

  return {
    isOpen,
    text: hoursText,
    statusLabel,
    dayName,
    badgeType,
  };
};

export default function HomePage() {
  const navigate = useNavigate();
  const { openSnackbar } = useSnackbar();
  const [venues, setVenues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Trạng thái khi đặt sân
  const [selectedVenue, setSelectedVenue] = useState<any>(null);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookingDate, setBookingDate] = useState(() => {
    return getLocalDate(new Date());
  });

  const [bookingTime, setBookingTime] = useState("17:00");
  const [endTime, setEndTime] = useState("18:30");
  const [courts, setCourts] = useState<any[]>([]);
  const [selectedCourt, setSelectedCourt] = useState("");
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [venueDetail, setVenueDetail] = useState<any>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState(
    () => localStorage.getItem("quan-ly-san-cau-long_phone") || ""
  );
  const [paymentMethod, setPaymentMethod] = useState("DEPOSIT_TRANSFER");

  // Quản lý chuyển khoản VietQR
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferDetails, setTransferDetails] = useState<any>(null);

  const handleCopy = (text: string, label: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      openSnackbar({ type: "success", text: `Đã sao chép ${label}!` });
    } else {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      openSnackbar({ type: "success", text: `Đã sao chép ${label}!` });
    }
  };

  // Quản lý tài khoản khách hàng
  const [currentUser, setCurrentUser] = useState<any>(() => {
    try {
      const stored = localStorage.getItem("portal_customer");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authPhone, setAuthPhone] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  const handleLogin = async () => {
    if (!authPhone.trim() || !authPassword.trim()) {
      openSnackbar({ type: "warning", text: "Vui lòng nhập SĐT và mật khẩu!" });
      return;
    }
    setAuthLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/portal-auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: authPhone.trim(),
          password: authPassword.trim(),
        }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        localStorage.setItem("portal_token", data.data.token);
        localStorage.setItem(
          "portal_customer",
          JSON.stringify(data.data.customer)
        );
        localStorage.setItem(
          "quan-ly-san-cau-long_phone",
          data.data.customer.phone
        );
        setCurrentUser(data.data.customer);
        setCustomerPhone(data.data.customer.phone);
        setCustomerName(data.data.customer.name);
        setShowAuthModal(false);
        openSnackbar({
          type: "success",
          text: `Đăng nhập thành công! Chào ${data.data.customer.name}`,
        });
      } else {
        openSnackbar({
          type: "warning",
          text: data.message || "Số điện thoại hoặc mật khẩu không chính xác",
        });
      }
    } catch {
      openSnackbar({ type: "error", text: "Không thể kết nối đến máy chủ" });
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("portal_token");
    localStorage.removeItem("portal_customer");
    setCurrentUser(null);
    openSnackbar({ type: "success", text: "Đã đăng xuất tài khoản" });
  };

  // Dữ liệu sản phẩm & dịch vụ tại sân
  const [products, setProducts] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [selectedItems, setSelectedItems] = useState<{ [key: string]: number }>({});
  const [activeCatalogTab, setActiveCatalogTab] = useState<"all" | "products" | "services">("all");

  // Gọi API lấy danh sách sân, sản phẩm & dịch vụ từ Backend
  useEffect(() => {
    // 1. Lấy danh sách sân
    fetch(`${API_BASE_URL}/venues`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setVenues(data.data.items || data.data);
        }
      })
      .catch((err) => {
        console.error("Lỗi lấy dữ liệu sân:", err);
        setVenues([]);
        openSnackbar({
          type: "warning",
          text: "Không thể tải danh sách cơ sở. Vui lòng kiểm tra kết nối rồi thử tải lại.",
        });
      })
      .finally(() => {
        setLoading(false);
      });

    // 2. Lấy danh sách sản phẩm
    fetch(`${API_BASE_URL}/products?isActive=true`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setProducts(data.data.items || data.data || []);
        }
      })
      .catch((err) => console.error("Lỗi lấy sản phẩm:", err));

    // 3. Lấy danh sách dịch vụ
    fetch(`${API_BASE_URL}/services?isActive=true`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setServices(data.data.items || data.data || []);
        }
      })
      .catch((err) => console.error("Lỗi lấy dịch vụ:", err));
  }, []);

  const handleViewDetail = (venue: any) => {
    setSelectedVenue(venue);
    setShowDetailModal(true);
    setVenueDetail(null);
    fetch(`${API_BASE_URL}/venues/${venue.id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setVenueDetail(data.data);
        }
      })
      .catch(console.error);
  };

  const handleBookClick = (venue: any) => {
    setSelectedVenue(venue);
    setShowBookingModal(true);
    setSelectedItems({});
    setCourts([]);
    setSelectedCourt("");
    fetch(
      `${API_BASE_URL}/venues/${venue.id}/availability?date=${bookingDate}`
    )
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data && data.data.courts) {
          setCourts(data.data.courts);
          if (data.data.courts.length > 0) setSelectedCourt(data.data.courts[0].id);
        }
      })
      .catch((err) => {
        console.error("Lỗi tải sân:", err);
      });
  };

  const handleItemQtyChange = (
    type: "product" | "service",
    id: string,
    delta: number,
    maxStock?: number
  ) => {
    const key = `${type}:${id}`;
    setSelectedItems((prev) => {
      const current = prev[key] || 0;
      const next = current + delta;
      if (next <= 0) {
        const copy = { ...prev };
        delete copy[key];
        return copy;
      }
      if (maxStock !== undefined && next > maxStock) {
        openSnackbar({
          type: "warning",
          text: `Chỉ còn ${maxStock} sản phẩm trong kho!`,
        });
        return prev;
      }
      return { ...prev, [key]: next };
    });
  };

  const calculateItemsTotal = () => {
    let total = 0;
    for (const [key, qty] of Object.entries(selectedItems)) {
      if (qty <= 0) continue;
      const [type, id] = key.split(":");
      if (type === "product") {
        const p = products.find((prod) => prod.id === id);
        if (p) total += p.price * qty;
      } else if (type === "service") {
        const s = services.find((serv) => serv.id === id);
        if (s) total += s.price * qty;
      }
    }
    return total;
  };

  const handleQuickDuration = (minutes: number) => {
    if (!bookingTime) return;
    const [h, m] = bookingTime.split(":").map(Number);
    const totalMin = h * 60 + m + minutes;
    const nextH = Math.floor(totalMin / 60);
    const nextM = totalMin % 60;
    if (nextH <= 23) {
      setEndTime(
        `${String(nextH).padStart(2, "0")}:${String(nextM).padStart(2, "0")}`
      );
    }
  };

  const submitBooking = () => {
    if (
      !selectedCourt ||
      !bookingDate ||
      !bookingTime ||
      !customerName ||
      !customerPhone
    ) {
      openSnackbar({
        type: "warning",
        text: "Vui lòng nhập đầy đủ thông tin đặt sân!",
      });
      return;
    }

    if (!bookingTime || !endTime) {
      openSnackbar({
        type: "warning",
        text: "Vui lòng chọn đầy đủ giờ bắt đầu và kết thúc!",
      });
      return;
    }
    if (endTime <= bookingTime) {
      openSnackbar({
        type: "warning",
        text: "Giờ kết thúc phải lớn hơn giờ bắt đầu!",
      });
      return;
    }

    const [startH, startM] = bookingTime.split(":").map(Number);
    const [endH, endM] = endTime.split(":").map(Number);
    if (startM % 30 !== 0 || endM % 30 !== 0) {
      openSnackbar({
        type: "warning",
        text: "Khung giờ phải là bội số của 30 phút (Ví dụ: 17:00, 17:30)",
      });
      return;
    }

    const orderedItems = Object.entries(selectedItems)
      .filter(([_, qty]) => qty > 0)
      .map(([key, qty]) => {
        const [type, id] = key.split(":");
        return { id, quantity: qty, type };
      });

    localStorage.setItem("quan-ly-san-cau-long_phone", customerPhone);
    const token = localStorage.getItem("portal_token");
    const headers: any = { "Content-Type": "application/json" };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    fetch(`${API_BASE_URL}/booking-requests/public`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        venueId: selectedVenue.id,
        courtId: selectedCourt,
        name: customerName,
        phone: customerPhone,
        date: bookingDate,
        startTime: bookingTime,
        endTime: endTime,
        notes: "Đặt từ Zalo Mini App",
        paymentMethod: paymentMethod,
        orderedItems: orderedItems.length > 0 ? orderedItems : undefined,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          if (paymentMethod === "VNPAY" && data.data && data.data.id && data.data.paymentAmount > 0) {
            openSnackbar({
              type: "success",
              text: "Đang tạo liên kết thanh toán VNPAY Sandbox...",
            });
            fetch(`${API_BASE_URL}/vnpay/create-payment`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                orderId: data.data.id,
                amount: data.data.paymentAmount || 100000,
                source: "zalo",
              }),
            })
              .then((r) => r.json())
              .then(async (payData) => {
                if (payData.success && payData.payUrl) {
                  setShowBookingModal(false);
                  openSnackbar({
                    type: "success",
                    text: "Đang mở cổng thanh toán VNPAY Sandbox...",
                  });
                  await openPaymentLink(payData.payUrl);
                } else {
                  openSnackbar({
                    type: "warning",
                    text: payData.message || "Không tạo được liên kết thanh toán VNPay Sandbox.",
                  });
                }
              })
              .catch((error) => {
                console.error("Không thể tạo liên kết thanh toán VNPay:", error);
                openSnackbar({
                  type: "warning",
                  text: error instanceof Error ? error.message : "Không thể kết nối đến VNPay.",
                });
              });
          } else {
            setShowBookingModal(false);
            if (data.data && data.data.transferReference && data.data.paymentAmount > 0) {
              setTransferDetails({
                requestId: data.data.id,
                amount: data.data.paymentAmount || 0,
                reference: data.data.transferReference,
                expiresAt:
                  data.data.expiresAt ||
                  new Date(Date.now() + 30 * 60 * 1000).toISOString(),
                courtName:
                  courts.find((c) => c.id === selectedCourt)?.name ||
                  "Sân thi đấu",
                date: bookingDate,
                startTime: bookingTime,
                endTime: endTime,
              });
              setShowTransferModal(true);
            } else {
              openSnackbar({
                type: "success",
                text: data.data?.paymentAmount === 0
                  ? "Yêu cầu không phát sinh thanh toán; đang chờ cơ sở xác nhận."
                  : "Yêu cầu đặt sân đã được gửi thành công!",
              });
            }
          }
        } else {
          openSnackbar({
            type: "warning",
            text: data.message || "Lỗi gửi yêu cầu đặt sân",
          });
        }
      })
      .catch(() => {
        openSnackbar({
          type: "warning",
          text: "Không thể kết nối đến máy chủ!",
        });
      });
  };

  return (
    <Page className="page">
      {/* 1. Header Thương hiệu Đẳng Cấp Hiện Đại */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: "#FFFFFF",
          padding: "12px 14px",
          borderRadius: "16px",
          marginBottom: "12px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <img
            src={logoHue}
            alt="Logo ĐH Huế"
            style={{
              width: "38px",
              height: "38px",
              borderRadius: "50%",
              objectFit: "contain",
              border: "1.5px solid #E2E8F0",
              boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
            }}
          />
          <div>
            <div
              style={{
                fontSize: "14px",
                fontWeight: "800",
                color: "#0F172A",
                lineHeight: "1.2",
              }}
            >
              SÂN CẦU LÔNG ĐH HUẾ
            </div>
            <div
              style={{
                fontSize: "11px",
                color: "#64748B",
                fontWeight: "500",
                marginTop: "2px",
              }}
            >
              Nhà Thi Đấu Đa Năng
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              backgroundColor: "#F8FAFC",
              border: "1px solid #CBD5E1",
              padding: "4px 8px",
              borderRadius: "14px",
            }}
          >
            <span
              style={{
                fontSize: "10px",
                fontWeight: "700",
                color: "#475569",
              }}
            >
              Giờ theo cơ sở
            </span>
          </div>

          <button
            type="button"
            onClick={() => setShowAuthModal(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              backgroundColor: currentUser ? "#ECFDF5" : "#F8FAFC",
              border: `1px solid ${currentUser ? "#86EFAC" : "#CBD5E1"}`,
              padding: "4px 9px",
              borderRadius: "14px",
              fontSize: "11px",
              fontWeight: "700",
              color: currentUser ? "#047857" : "#1E293B",
              cursor: "pointer",
            }}
          >
            <span>{currentUser ? "👤" : "🔑"}</span>
            <span
              style={{
                maxWidth: "65px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {currentUser
                ? currentUser.name.split(" ").slice(-1)[0]
                : "Đăng nhập"}
            </span>
          </button>
        </div>
      </div>

      {/* 2. Banner Hero Showcase Trưng Bày Đầy Đủ Ảnh & Thông Tin Nổi Bật */}
      <div
        style={{
          position: "relative",
          overflow: "hidden",
          borderRadius: "20px",
          background:
            "linear-gradient(135deg, #064E3B 0%, #065F46 50%, #047857 100%)",
          color: "white",
          padding: "16px",
          boxShadow: "0 8px 24px -4px rgba(6, 78, 59, 0.25)",
          marginBottom: "14px",
        }}
      >
        {/* Glow hiệu ứng mờ nền */}
        <div
          style={{
            position: "absolute",
            top: "-25px",
            right: "-25px",
            width: "120px",
            height: "120px",
            borderRadius: "50%",
            backgroundColor: "rgba(134, 239, 172, 0.2)",
            filter: "blur(22px)",
            pointerEvents: "none",
          }}
        />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "14px",
            position: "relative",
            zIndex: 1,
          }}
        >
          {/* Cột Trái: Thông tin giới thiệu */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                backgroundColor: "rgba(255, 255, 255, 0.16)",
                backdropFilter: "blur(8px)",
                padding: "3px 10px",
                borderRadius: "20px",
                marginBottom: "6px",
                border: "1px solid rgba(255, 255, 255, 0.25)",
              }}
            >
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: "800",
                  color: "#86EFAC",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                ★ Tiêu chuẩn BWF
              </span>
            </div>

            <div
              style={{
                fontSize: "16px",
                fontWeight: "900",
                lineHeight: "1.25",
                color: "#FFFFFF",
                marginBottom: "4px",
              }}
            >
              Nhà Thi Đấu <span style={{ color: "#FDE047" }}>Đa Năng HUE</span>
            </div>

            <div
              style={{
                fontSize: "11px",
                color: "#D1FAE5",
                lineHeight: "1.35",
                marginBottom: "10px",
              }}
            >
              Thảm thi đấu quốc tế · Đèn LED chống lóa · Hệ thống điều hòa
            </div>

            <button
              type="button"
              onClick={() => {
                const target = document.querySelector(".venue-section");
                target?.scrollIntoView({ behavior: "smooth" });
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                backgroundColor: "#FDE047",
                color: "#064E3B",
                fontSize: "11px",
                fontWeight: "800",
                padding: "6px 14px",
                borderRadius: "10px",
                border: "none",
                boxShadow: "0 3px 8px rgba(0,0,0,0.15)",
                cursor: "pointer",
              }}
            >
              <span>Đặt sân ngay</span>
              <span style={{ fontSize: "13px" }}>›</span>
            </button>
          </div>

          {/* Cột Phải: Poster nguyên vẹn 100% */}
          <div style={{ flexShrink: 0, width: "120px", maxWidth: "38%" }}>
            <div
              style={{
                borderRadius: "14px",
                overflow: "hidden",
                border: "2px solid rgba(255, 255, 255, 0.4)",
                boxShadow: "0 6px 18px rgba(0, 0, 0, 0.25)",
                backgroundColor: "#064E3B",
              }}
            >
              <img
                src={bannerImg}
                alt="Nhà Thi Đấu Đa Năng HUE"
                style={{
                  width: "100%",
                  height: "auto",
                  display: "block",
                  aspectRatio: "1/1",
                  objectFit: "contain",
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3. Lưới Chức Năng Nổi Bật (4 Quick Action Cards Hiện Đại) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "8px",
          marginBottom: "14px",
        }}
      >
        {/* Nút 1: Đặt Sân */}
        <div
          onClick={() => {
            const target = document.querySelector(".venue-section");
            target?.scrollIntoView({ behavior: "smooth" });
          }}
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: "14px",
            padding: "12px 6px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            cursor: "pointer",
            border: "1px solid #F1F5F9",
          }}
        >
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "12px",
              backgroundColor: "#ECFDF5",
              color: "#059669",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "6px",
            }}
          >
            <Icon icon="zi-calendar" style={{ fontSize: "20px" }} />
          </div>
          <div
            style={{
              fontSize: "11px",
              fontWeight: "700",
              color: "#1E293B",
              lineHeight: "1.2",
            }}
          >
            Đặt sân
          </div>
          <div
            style={{
              fontSize: "9px",
              color: "#64748B",
              marginTop: "2px",
            }}
          >
            Nhanh chóng
          </div>
        </div>

        {/* Nút 2: Giờ Trống */}
        <div
          onClick={() => navigate("/availability")}
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: "14px",
            padding: "12px 6px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            cursor: "pointer",
            border: "1px solid #F1F5F9",
          }}
        >
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "12px",
              backgroundColor: "#F5F3FF",
              color: "#7C3AED",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "6px",
            }}
          >
            <Icon icon="zi-clock-1" style={{ fontSize: "20px" }} />
          </div>
          <div
            style={{
              fontSize: "11px",
              fontWeight: "700",
              color: "#1E293B",
              lineHeight: "1.2",
            }}
          >
            Giờ trống
          </div>
          <div
            style={{
              fontSize: "9px",
              color: "#64748B",
              marginTop: "2px",
            }}
          >
            Xem lịch sân
          </div>
        </div>

        {/* Nút 3: Chat AI */}
        <div
          onClick={() => navigate("/chat-ai")}
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: "14px",
            padding: "12px 6px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            cursor: "pointer",
            border: "1px solid #F1F5F9",
          }}
        >
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "12px",
              backgroundColor: "#EFF6FF",
              color: "#2563EB",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "6px",
            }}
          >
            <Icon icon="zi-chat" style={{ fontSize: "20px" }} />
          </div>
          <div
            style={{
              fontSize: "11px",
              fontWeight: "700",
              color: "#1E293B",
              lineHeight: "1.2",
            }}
          >
            Chat AI
          </div>
          <div
            style={{
              fontSize: "9px",
              color: "#2563EB",
              fontWeight: "600",
              marginTop: "2px",
            }}
          >
            Tư vấn 24/7
          </div>
        </div>

        {/* Nút 4: Lịch Sử */}
        <div
          onClick={() => navigate("/history")}
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: "14px",
            padding: "12px 6px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            cursor: "pointer",
            border: "1px solid #F1F5F9",
          }}
        >
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "12px",
              backgroundColor: "#FEF3C7",
              color: "#D97706",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "6px",
            }}
          >
            <Icon icon="zi-list-1" style={{ fontSize: "20px" }} />
          </div>
          <div
            style={{
              fontSize: "11px",
              fontWeight: "700",
              color: "#1E293B",
              lineHeight: "1.2",
            }}
          >
            Lịch sử
          </div>
          <div
            style={{
              fontSize: "9px",
              color: "#64748B",
              marginTop: "2px",
            }}
          >
            Tra cứu vé
          </div>
        </div>
      </div>

      {/* 4. Banner Ưu Đãi Sinh Viên ĐH Huế (Giảm 20%) */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          backgroundColor: "#FFFBEB",
          border: "1px solid #FDE68A",
          borderRadius: "14px",
          padding: "12px 14px",
          marginBottom: "14px",
        }}
      >
        <div
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "10px",
            backgroundColor: "#F59E0B",
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "18px",
            flexShrink: 0,
          }}
        >
          🎓
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: "12px",
              fontWeight: "800",
              color: "#92400E",
              marginBottom: "2px",
            }}
          >
            Ưu đãi 20% tiền thuê sân
          </div>
          <div
            style={{
              fontSize: "10px",
              color: "#B45309",
              lineHeight: "1.3",
            }}
          >
            Áp dụng cho tài khoản đăng nhập đã xác thực sinh viên/cán bộ Huế; không áp dụng sản phẩm, dịch vụ.
          </div>
        </div>
      </div>

      {/* 5. Danh Sách Cơ Sở & Sân Thi Đấu */}
      <div className="venue-section" style={{ marginBottom: "20px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "10px",
          }}
        >
          <div
            style={{
              fontSize: "15px",
              fontWeight: "800",
              color: "#0F172A",
            }}
          >
            Cơ sở thi đấu ({venues.length})
          </div>
          <span
            style={{
              fontSize: "11px",
              color: "#059669",
              fontWeight: "600",
            }}
          >
            Sân đạt chuẩn
          </span>
        </div>

        {loading ? (
          <div
            style={{
              padding: "30px",
              textAlign: "center",
              color: "#94A3B8",
              backgroundColor: "white",
              borderRadius: "16px",
            }}
          >
            Đang đồng bộ dữ liệu sân từ máy chủ...
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {venues.map((venue) => {
              const opStatus = getOperatingStatus(venue);
              return (
              <div
                key={venue.id}
                style={{
                  backgroundColor: "#FFFFFF",
                  borderRadius: "16px",
                  padding: "16px",
                  boxShadow:
                    "0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.03)",
                  border: "1px solid #E2E8F0",
                }}
              >
                {/* Header cơ sở */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: "8px",
                  }}
                >
                  <div style={{ flex: 1, paddingRight: "8px" }}>
                    <div
                      style={{
                        fontSize: "14px",
                        fontWeight: "800",
                        color: "#0F172A",
                        lineHeight: "1.3",
                      }}
                    >
                      {venue.name}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                        fontSize: "11px",
                        color: "#64748B",
                        marginTop: "4px",
                      }}
                    >
                      <Icon icon="zi-location" size={13} style={{ color: "#059669" }} />
                      <span>{venue.address}</span>
                    </div>
                  </div>

                  {/* Huy hiệu Báo Đang mở cửa / Đã đóng cửa theo thời gian thực */}
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      backgroundColor:
                        opStatus.badgeType === "open"
                          ? "#ECFDF5"
                          : opStatus.badgeType === "upcoming"
                          ? "#FFFBEB"
                          : "#FEF2F2",
                      border: `1px solid ${
                        opStatus.badgeType === "open"
                          ? "#A7F3D0"
                          : opStatus.badgeType === "upcoming"
                          ? "#FDE68A"
                          : "#FECACA"
                      }`,
                      padding: "4px 8px",
                      borderRadius: "14px",
                      flexShrink: 0,
                    }}
                  >
                    {opStatus.badgeType === "open" && <span className="live-dot" />}
                    {opStatus.badgeType === "upcoming" && (
                      <span
                        style={{
                          width: "6px",
                          height: "6px",
                          borderRadius: "50%",
                          backgroundColor: "#D97706",
                        }}
                      />
                    )}
                    {opStatus.badgeType === "closed" && (
                      <span
                        style={{
                          width: "6px",
                          height: "6px",
                          borderRadius: "50%",
                          backgroundColor: "#EF4444",
                        }}
                      />
                    )}
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: "700",
                        color:
                          opStatus.badgeType === "open"
                            ? "#047857"
                            : opStatus.badgeType === "upcoming"
                            ? "#B45309"
                            : "#DC2626",
                      }}
                    >
                      {opStatus.statusLabel}
                    </span>
                  </div>
                </div>

                {/* Dòng giờ hoạt động chi tiết */}
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    backgroundColor: "#F8FAFC",
                    border: "1px solid #E2E8F0",
                    padding: "4px 10px",
                    borderRadius: "8px",
                    fontSize: "11px",
                    color: "#334155",
                    margin: "4px 0 10px 0",
                  }}
                >
                  <span style={{ fontSize: "12px" }}>⏰</span>
                  <span>
                    <strong>Giờ hoạt động ({opStatus.dayName}):</strong> {opStatus.text}
                  </span>
                </div>

                {/* Tiện ích sân */}
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "6px",
                    margin: "10px 0 14px 0",
                  }}
                >
                  <span
                    style={{
                      fontSize: "10px",
                      padding: "3px 8px",
                      borderRadius: "6px",
                      backgroundColor: "#F1F5F9",
                      color: "#475569",
                      fontWeight: "600",
                    }}
                  >
                    🏸 Thảm BWF
                  </span>
                  <span
                    style={{
                      fontSize: "10px",
                      padding: "3px 8px",
                      borderRadius: "6px",
                      backgroundColor: "#F1F5F9",
                      color: "#475569",
                      fontWeight: "600",
                    }}
                  >
                    💡 Đèn chống lóa
                  </span>
                  <span
                    style={{
                      fontSize: "10px",
                      padding: "3px 8px",
                      borderRadius: "6px",
                      backgroundColor: "#F1F5F9",
                      color: "#475569",
                      fontWeight: "600",
                    }}
                  >
                    🚗 Bãi xe miễn phí
                  </span>
                  <span
                    style={{
                      fontSize: "10px",
                      padding: "3px 8px",
                      borderRadius: "6px",
                      backgroundColor: "#F1F5F9",
                      color: "#475569",
                      fontWeight: "600",
                    }}
                  >
                    🥤 Căng tin nước
                  </span>
                </div>

                {/* 2 Nút hành động trực quan */}
                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    type="button"
                    onClick={() => handleViewDetail(venue)}
                    style={{
                      flex: 1,
                      padding: "10px 0",
                      borderRadius: "10px",
                      backgroundColor: "#F8FAFC",
                      border: "1px solid #CBD5E1",
                      color: "#334155",
                      fontSize: "12px",
                      fontWeight: "700",
                      cursor: "pointer",
                    }}
                  >
                    Bảng giá & Chi tiết
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBookClick(venue)}
                    style={{
                      flex: 1.2,
                      padding: "10px 0",
                      borderRadius: "10px",
                      background:
                        "linear-gradient(135deg, #059669 0%, #047857 100%)",
                      border: "none",
                      color: "#FFFFFF",
                      fontSize: "12px",
                      fontWeight: "800",
                      boxShadow: "0 2px 6px rgba(5, 150, 105, 0.3)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "4px",
                    }}
                  >
                    <span>🏸 Đặt sân ngay</span>
                  </button>
                </div>
              </div>
            );
            })}
          </div>
        )}
      </div>

      {/* 6. Dịch vụ & Phụ kiện tại sân */}
      {(products.length > 0 || services.length > 0) && (
        <div style={{ marginBottom: "20px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "10px",
            }}
          >
            <div
              style={{
                fontSize: "15px",
                fontWeight: "800",
                color: "#0F172A",
              }}
            >
              🛍️ Dịch vụ & Phụ kiện tại sân
            </div>
            <span
              style={{
                fontSize: "11px",
                color: "#059669",
                fontWeight: "600",
              }}
            >
              Tiện ích đi kèm
            </span>
          </div>

          {/* Catalog Filter Tabs */}
          <div style={{ display: "flex", gap: "6px", marginBottom: "12px" }}>
            <button
              type="button"
              onClick={() => setActiveCatalogTab("all")}
              style={{
                padding: "5px 12px",
                borderRadius: "20px",
                fontSize: "11px",
                fontWeight: activeCatalogTab === "all" ? "700" : "500",
                backgroundColor:
                  activeCatalogTab === "all" ? "#047857" : "#FFFFFF",
                color: activeCatalogTab === "all" ? "#FFFFFF" : "#64748B",
                border:
                  activeCatalogTab === "all" ? "none" : "1px solid #E2E8F0",
                cursor: "pointer",
              }}
            >
              Tất cả ({products.length + services.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveCatalogTab("products")}
              style={{
                padding: "5px 12px",
                borderRadius: "20px",
                fontSize: "11px",
                fontWeight: activeCatalogTab === "products" ? "700" : "500",
                backgroundColor:
                  activeCatalogTab === "products" ? "#047857" : "#FFFFFF",
                color: activeCatalogTab === "products" ? "#FFFFFF" : "#64748B",
                border:
                  activeCatalogTab === "products" ? "none" : "1px solid #E2E8F0",
                cursor: "pointer",
              }}
            >
              Sản phẩm ({products.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveCatalogTab("services")}
              style={{
                padding: "5px 12px",
                borderRadius: "20px",
                fontSize: "11px",
                fontWeight: activeCatalogTab === "services" ? "700" : "500",
                backgroundColor:
                  activeCatalogTab === "services" ? "#047857" : "#FFFFFF",
                color: activeCatalogTab === "services" ? "#FFFFFF" : "#64748B",
                border:
                  activeCatalogTab === "services" ? "none" : "1px solid #E2E8F0",
                cursor: "pointer",
              }}
            >
              Dịch vụ ({services.length})
            </button>
          </div>

          {/* Catalog Cards Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: "10px",
            }}
          >
            {(activeCatalogTab === "all" || activeCatalogTab === "products") &&
              products.map((p) => (
                <div
                  key={`p-${p.id}`}
                  style={{
                    backgroundColor: "#FFFFFF",
                    borderRadius: "14px",
                    padding: "12px",
                    border: "1px solid #E2E8F0",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "6px",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "9px",
                          fontWeight: "700",
                          backgroundColor: "#EFF6FF",
                          color: "#2563EB",
                          padding: "2px 6px",
                          borderRadius: "4px",
                        }}
                      >
                        SẢN PHẨM
                      </span>
                      <span
                        style={{
                          fontSize: "9px",
                          color: p.stock > 0 ? "#059669" : "#DC2626",
                          fontWeight: "600",
                        }}
                      >
                        {p.stock > 0 ? `Còn ${p.stock}` : "Hết hàng"}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: "12px",
                        fontWeight: "800",
                        color: "#0F172A",
                        lineHeight: "1.3",
                        marginBottom: "4px",
                      }}
                    >
                      {p.name}
                    </div>
                    {p.description && (
                      <div
                        style={{
                          fontSize: "10px",
                          color: "#64748B",
                          lineHeight: "1.3",
                          marginBottom: "8px",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {p.description.trim()}
                      </div>
                    )}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginTop: "6px",
                      paddingTop: "6px",
                      borderTop: "1px dashed #F1F5F9",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "13px",
                        fontWeight: "800",
                        color: "#059669",
                      }}
                    >
                      {new Intl.NumberFormat("vi-VN").format(p.price)}đ
                    </span>
                    <span style={{ fontSize: "10px", color: "#94A3B8" }}>
                      /{p.unit || "món"}
                    </span>
                  </div>
                </div>
              ))}

            {(activeCatalogTab === "all" || activeCatalogTab === "services") &&
              services.map((s) => (
                <div
                  key={`s-${s.id}`}
                  style={{
                    backgroundColor: "#FFFFFF",
                    borderRadius: "14px",
                    padding: "12px",
                    border: "1px solid #E2E8F0",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "6px",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "9px",
                          fontWeight: "700",
                          backgroundColor: "#F5F3FF",
                          color: "#7C3AED",
                          padding: "2px 6px",
                          borderRadius: "4px",
                        }}
                      >
                        DỊCH VỤ
                      </span>
                      <span
                        style={{
                          fontSize: "9px",
                          color: "#059669",
                          fontWeight: "600",
                        }}
                      >
                        Sẵn sàng
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: "12px",
                        fontWeight: "800",
                        color: "#0F172A",
                        lineHeight: "1.3",
                        marginBottom: "4px",
                      }}
                    >
                      {s.name}
                    </div>
                    {s.description && (
                      <div
                        style={{
                          fontSize: "10px",
                          color: "#64748B",
                          lineHeight: "1.3",
                          marginBottom: "8px",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {s.description.trim()}
                      </div>
                    )}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginTop: "6px",
                      paddingTop: "6px",
                      borderTop: "1px dashed #F1F5F9",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "13px",
                        fontWeight: "800",
                        color: "#059669",
                      }}
                    >
                      {new Intl.NumberFormat("vi-VN").format(s.price)}đ
                    </span>
                    <span style={{ fontSize: "10px", color: "#94A3B8" }}>
                      /{s.unit || "lượt"}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Footer bản quyền */}
      <div
        style={{
          textAlign: "center",
          padding: "10px 0 20px 0",
          color: "#94A3B8",
          fontSize: "11px",
        }}
      >
        <div>Nhà Thi Đấu Đa Năng - Đại học Huế</div>
        <div style={{ fontSize: "10px", marginTop: "2px" }}>
          Đồng bộ thời gian thực từ cơ sở dữ liệu hệ thống
        </div>
      </div>

      {/* MODAL 1: CHI TIẾT CƠ SỞ & BẢNG GIÁ THAM KHẢO */}
      <Modal
        visible={showDetailModal}
        title="Thông tin cơ sở & Bảng giá"
        onClose={() => setShowDetailModal(false)}
      >
        <Box p={0} style={{ overflow: "visible" }}>
          {venueDetail ? (
            <div>
              <div
                style={{
                  fontSize: "15px",
                  fontWeight: "800",
                  color: "#0F172A",
                  marginBottom: "4px",
                }}
              >
                {venueDetail.name}
              </div>
              <div
                style={{
                  fontSize: "12px",
                  color: "#64748B",
                  marginBottom: "12px",
                }}
              >
                📍 {venueDetail.address}
              </div>

              {/* Trạng thái mở/đóng cửa và giờ hoạt động cơ sở */}
              {(() => {
                const op = getOperatingStatus(venueDetail);
                return (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      backgroundColor:
                        op.badgeType === "open"
                          ? "#ECFDF5"
                          : op.badgeType === "upcoming"
                          ? "#FFFBEB"
                          : "#FEF2F2",
                      border: `1px solid ${
                        op.badgeType === "open"
                          ? "#A7F3D0"
                          : op.badgeType === "upcoming"
                          ? "#FDE68A"
                          : "#FECACA"
                      }`,
                      borderRadius: "10px",
                      padding: "8px 12px",
                      marginBottom: "14px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      {op.badgeType === "open" && <span className="live-dot" />}
                      <span
                        style={{
                          fontSize: "12px",
                          fontWeight: "700",
                          color:
                            op.badgeType === "open"
                              ? "#047857"
                              : op.badgeType === "upcoming"
                              ? "#B45309"
                              : "#DC2626",
                        }}
                      >
                        {op.statusLabel}
                      </span>
                    </div>
                    <span style={{ fontSize: "11px", color: "#475569", fontWeight: "600" }}>
                      ⏰ {op.text}
                    </span>
                  </div>
                );
              })()}

              {venueDetail.pricingRules && venueDetail.pricingRules.length > 0 ? (
                <div style={{ marginBottom: "16px" }}>
                  <div
                    style={{
                      fontSize: "13px",
                      fontWeight: "700",
                      color: "#1E293B",
                      marginBottom: "8px",
                    }}
                  >
                    📋 Bảng giá niêm yết:
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    }}
                  >
                    {venueDetail.pricingRules.map((pr: any) => (
                      <div
                        key={pr.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          backgroundColor: "#F8FAFC",
                          padding: "10px 12px",
                          borderRadius: "10px",
                          border: "1px solid #E2E8F0",
                        }}
                      >
                        <div>
                          <div
                            style={{
                              fontSize: "12px",
                              fontWeight: "700",
                              color: "#0F172A",
                            }}
                          >
                            {pr.name}
                          </div>
                          <div
                            style={{
                              fontSize: "11px",
                              color: "#64748B",
                              marginTop: "2px",
                            }}
                          >
                            ⏰ {pr.startTime} - {pr.endTime} ({translateDays(pr.dayOfWeek)})
                          </div>
                        </div>
                        <div
                          style={{
                            fontSize: "13px",
                            fontWeight: "800",
                            color: "#059669",
                          }}
                        >
                          {new Intl.NumberFormat("vi-VN").format(
                            pr.pricePerHour
                          )}
                          đ/h
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    fontSize: "12px",
                    color: "#64748B",
                    marginBottom: "16px",
                  }}
                >
                  Giá tiêu chuẩn theo khung giờ quy định tại sân.
                </div>
              )}

              {/* Dịch vụ & Phụ kiện tại cơ sở */}
              {(products.length > 0 || services.length > 0) && (
                <div style={{ marginBottom: "16px" }}>
                  <div
                    style={{
                      fontSize: "13px",
                      fontWeight: "700",
                      color: "#1E293B",
                      marginBottom: "8px",
                    }}
                  >
                    🛍️ Dịch vụ & Phụ kiện có tại sân:
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                    }}
                  >
                    {products.map((p) => (
                      <div
                        key={`vp-${p.id}`}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          backgroundColor: "#F8FAFC",
                          padding: "8px 10px",
                          borderRadius: "8px",
                          border: "1px solid #E2E8F0",
                        }}
                      >
                        <div>
                          <span
                            style={{
                              fontSize: "12px",
                              fontWeight: "700",
                              color: "#0F172A",
                            }}
                          >
                            {p.name}
                          </span>
                          <span
                            style={{
                              fontSize: "10px",
                              color: "#64748B",
                              marginLeft: "6px",
                            }}
                          >
                            (Còn {p.stock} {p.unit || ""})
                          </span>
                        </div>
                        <span
                          style={{
                            fontSize: "12px",
                            fontWeight: "800",
                            color: "#059669",
                          }}
                        >
                          {new Intl.NumberFormat("vi-VN").format(p.price)}đ
                        </span>
                      </div>
                    ))}
                    {services.map((s) => (
                      <div
                        key={`vs-${s.id}`}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          backgroundColor: "#F8FAFC",
                          padding: "8px 10px",
                          borderRadius: "8px",
                          border: "1px solid #E2E8F0",
                        }}
                      >
                        <div>
                          <span
                            style={{
                              fontSize: "12px",
                              fontWeight: "700",
                              color: "#0F172A",
                            }}
                          >
                            {s.name}
                          </span>
                          <span
                            style={{
                              fontSize: "10px",
                              color: "#64748B",
                              marginLeft: "6px",
                            }}
                          >
                            ({s.unit || "tiện ích"})
                          </span>
                        </div>
                        <span
                          style={{
                            fontSize: "12px",
                            fontWeight: "800",
                            color: "#059669",
                          }}
                        >
                          {new Intl.NumberFormat("vi-VN").format(s.price)}đ
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quy định sân */}
              <div
                style={{
                  backgroundColor: "#F0FDF4",
                  border: "1px solid #BBF7D0",
                  borderRadius: "10px",
                  padding: "10px 12px",
                  marginBottom: "16px",
                }}
              >
                <div
                  style={{
                    fontSize: "11px",
                    fontWeight: "700",
                    color: "#166534",
                    marginBottom: "4px",
                  }}
                >
                  📌 Quy định khi nhận sân:
                </div>
                <div
                  style={{
                    fontSize: "11px",
                    color: "#166534",
                    lineHeight: "1.4",
                  }}
                >
                  • Vui lòng có mặt trước giờ chơi 10 phút để nhận sân.
                  <br />
                  • Mang giày thể thao chuyên dụng không để lại vệt thảm.
                  <br />• Xuất trình thẻ sinh viên HUE nếu áp dụng giảm giá 20%.
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowDetailModal(false);
                  handleBookClick(venueDetail);
                }}
                style={{
                  width: "100%",
                  padding: "12px 0",
                  borderRadius: "12px",
                  background:
                    "linear-gradient(135deg, #059669 0%, #047857 100%)",
                  color: "#FFFFFF",
                  fontSize: "14px",
                  fontWeight: "800",
                  border: "none",
                  cursor: "pointer",
                  boxShadow: "0 2px 8px rgba(5,150,105,0.3)",
                }}
              >
                Tiến hành Đặt Sân Ngay
              </button>
            </div>
          ) : (
            <div
              style={{
                textAlign: "center",
                padding: "20px",
                color: "#64748B",
              }}
            >
              Đang tải thông tin chi tiết...
            </div>
          )}
        </Box>
      </Modal>

      {/* MODAL 2: SHEET ĐẶT SÂN HIỆN ĐẠI (BOOKING MODAL) */}
      <Modal
        visible={showBookingModal}
        title="Đặt lịch thi đấu"
        onClose={() => setShowBookingModal(false)}
      >
        <Box p={0} style={{ overflow: "visible" }}>
          <div
            style={{
              backgroundColor: "#ECFDF5",
              border: "1px solid #A7F3D0",
              borderRadius: "12px",
              padding: "10px 12px",
              marginBottom: "14px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: "11px",
                    color: "#065F46",
                    fontWeight: "600",
                  }}
                >
                  Cơ sở đã chọn:
                </div>
                <div
                  style={{
                    fontSize: "13px",
                    fontWeight: "800",
                    color: "#064E3B",
                    marginTop: "2px",
                  }}
                >
                  {selectedVenue?.name}
                </div>
              </div>
              {selectedVenue && (() => {
                const op = getOperatingStatus(selectedVenue);
                return (
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: "700",
                      color: op.badgeType === "open" ? "#047857" : "#B45309",
                      backgroundColor:
                        op.badgeType === "open" ? "#D1FAE5" : "#FEF3C7",
                      padding: "3px 8px",
                      borderRadius: "10px",
                      flexShrink: 0,
                    }}
                  >
                    ⏰ {op.text}
                  </span>
                );
              })()}
            </div>
          </div>

          {/* Bước 1: Chọn sân */}
          <div style={{ marginBottom: "14px" }}>
            <div
              style={{
                fontSize: "12px",
                fontWeight: "700",
                color: "#1E293B",
                marginBottom: "6px",
              }}
            >
              1. Chọn sân cầu lông:
            </div>
            {courts.length === 0 ? (
              <div
                style={{
                  fontSize: "12px",
                  color: "#64748B",
                  padding: "10px",
                  backgroundColor: "#F8FAFC",
                  borderRadius: "10px",
                }}
              >
                Đang tải danh sách sân...
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                  gap: "8px",
                }}
              >
                {courts.map((c) => {
                  const isSelected = selectedCourt === c.id;
                  return (
                    <div
                      key={c.id}
                      onClick={() => setSelectedCourt(c.id)}
                      style={{
                        padding: "10px",
                        borderRadius: "10px",
                        border: isSelected
                          ? "2px solid #059669"
                          : "1px solid #E2E8F0",
                        backgroundColor: isSelected ? "#F0FDF4" : "#FFFFFF",
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "12px",
                          fontWeight: isSelected ? "800" : "600",
                          color: isSelected ? "#047857" : "#1E293B",
                        }}
                      >
                        {c.name}
                      </div>
                      <div
                        style={{
                          fontSize: "10px",
                          color: "#64748B",
                          marginTop: "2px",
                        }}
                      >
                        {c.surfaceType || "Thảm tiêu chuẩn"}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Bước 2: Ngày & Giờ */}
          <div style={{ marginBottom: "14px" }}>
            <div
              style={{
                fontSize: "12px",
                fontWeight: "700",
                color: "#1E293B",
                marginBottom: "6px",
              }}
            >
              2. Ngày & Thời gian chơi:
            </div>

            <div style={{ marginBottom: "8px" }}>
              <input
                type="date"
                className="modern-input"
                value={bookingDate}
                onChange={(e) => setBookingDate(e.target.value)}
              />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "8px",
                marginBottom: "8px",
              }}
            >
              <div>
                <span
                  style={{
                    fontSize: "11px",
                    color: "#64748B",
                    fontWeight: "600",
                    display: "block",
                    marginBottom: "4px",
                  }}
                >
                  Giờ bắt đầu:
                </span>
                <input
                  type="time"
                  className="modern-input"
                  value={bookingTime}
                  step="1800"
                  onChange={(e) => setBookingTime(e.target.value)}
                />
              </div>

              <div>
                <span
                  style={{
                    fontSize: "11px",
                    color: "#64748B",
                    fontWeight: "600",
                    display: "block",
                    marginBottom: "4px",
                  }}
                >
                  Giờ kết thúc:
                </span>
                <input
                  type="time"
                  className="modern-input"
                  value={endTime}
                  step="1800"
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            </div>

            {/* Chọn nhanh thời lượng */}
            <div style={{ display: "flex", gap: "6px" }}>
              <button
                type="button"
                onClick={() => handleQuickDuration(60)}
                style={{
                  flex: 1,
                  padding: "5px 0",
                  fontSize: "11px",
                  fontWeight: "600",
                  borderRadius: "8px",
                  backgroundColor: "#F1F5F9",
                  border: "1px solid #E2E8F0",
                  color: "#334155",
                  cursor: "pointer",
                }}
              >
                +1 giờ
              </button>
              <button
                type="button"
                onClick={() => handleQuickDuration(90)}
                style={{
                  flex: 1,
                  padding: "5px 0",
                  fontSize: "11px",
                  fontWeight: "600",
                  borderRadius: "8px",
                  backgroundColor: "#F1F5F9",
                  border: "1px solid #E2E8F0",
                  color: "#334155",
                  cursor: "pointer",
                }}
              >
                +1.5 giờ
              </button>
              <button
                type="button"
                onClick={() => handleQuickDuration(120)}
                style={{
                  flex: 1,
                  padding: "5px 0",
                  fontSize: "11px",
                  fontWeight: "600",
                  borderRadius: "8px",
                  backgroundColor: "#F1F5F9",
                  border: "1px solid #E2E8F0",
                  color: "#334155",
                  cursor: "pointer",
                }}
              >
                +2 giờ
              </button>
            </div>
          </div>

          {/* Bước 3: Thông tin người đặt */}
          <div style={{ marginBottom: "14px" }}>
            <div
              style={{
                fontSize: "12px",
                fontWeight: "700",
                color: "#1E293B",
                marginBottom: "6px",
              }}
            >
              3. Thông tin người đặt:
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <input
                type="text"
                className="modern-input"
                placeholder="Họ và tên của bạn..."
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
              <input
                type="tel"
                className="modern-input"
                placeholder="Số điện thoại liên hệ (Zalo)..."
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
              />
            </div>
          </div>

          {/* Bước 4: Phương thức thanh toán */}
          <div style={{ marginBottom: "16px" }}>
            <div
              style={{
                fontSize: "12px",
                fontWeight: "700",
                color: "#1E293B",
                marginBottom: "6px",
              }}
            >
              4. Hình thức thanh toán:
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "8px",
                marginBottom: "8px",
              }}
            >
              <div
                onClick={() => setPaymentMethod("DEPOSIT_TRANSFER")}
                style={{
                  padding: "10px",
                  borderRadius: "10px",
                  border:
                    paymentMethod === "DEPOSIT_TRANSFER"
                      ? "2px solid #059669"
                      : "1px solid #E2E8F0",
                  backgroundColor:
                    paymentMethod === "DEPOSIT_TRANSFER" ? "#F0FDF4" : "#FFFFFF",
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    fontSize: "12px",
                    fontWeight: "700",
                    color:
                      paymentMethod === "DEPOSIT_TRANSFER"
                        ? "#047857"
                        : "#1E293B",
                  }}
                >
                  🏦 Chuyển khoản VietQR
                </div>
                <div
                  style={{
                    fontSize: "10px",
                    color: "#64748B",
                    marginTop: "2px",
                  }}
                >
                  Tạo mã QR tự động
                </div>
              </div>

              <div
                onClick={() => setPaymentMethod("VNPAY")}
                style={{
                  padding: "10px",
                  borderRadius: "10px",
                  border:
                    paymentMethod === "VNPAY"
                      ? "2px solid #059669"
                      : "1px solid #E2E8F0",
                  backgroundColor:
                    paymentMethod === "VNPAY" ? "#F0FDF4" : "#FFFFFF",
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    fontSize: "12px",
                    fontWeight: "700",
                    color:
                      paymentMethod === "VNPAY" ? "#047857" : "#1E293B",
                  }}
                >
                  💳 VNPAY Online
                </div>
                <div
                  style={{
                    fontSize: "10px",
                    color: "#64748B",
                    marginTop: "2px",
                  }}
                >
                  App ngân hàng / Ví VNPAY
                </div>
              </div>
            </div>

            {/* Hướng dẫn chuyển khoản VietQR nếu chọn DEPOSIT_TRANSFER */}
            {paymentMethod === "DEPOSIT_TRANSFER" && selectedVenue && (
              <div
                style={{
                  backgroundColor: "#F0FDF4",
                  border: "1px solid #BBF7D0",
                  borderRadius: "10px",
                  padding: "10px 12px",
                  fontSize: "11px",
                  color: "#166534",
                  lineHeight: "1.4",
                }}
              >
                <div style={{ fontWeight: "800", marginBottom: "2px" }}>
                  📌 Chuyển khoản VietQR để giữ sân:
                </div>
                <div>
                  Hệ thống sẽ tạo <strong>Mã QR VietQR</strong> chứa đúng số tiền và mã đơn riêng. Bạn chỉ cần quét mã bằng App ngân hàng để giữ sân (hạn 30 phút).
                </div>
                <div style={{ marginTop: "4px", fontSize: "10px", color: "#15803D", fontWeight: "600" }}>
                  🏦 {selectedVenue.bankCode} • STK: {selectedVenue.bankAccountNumber} • {selectedVenue.bankAccountName}
                </div>
              </div>
            )}
          </div>

          {/* Bước 5: Thêm nước uống & dịch vụ đi kèm */}
          {(products.length > 0 || services.length > 0) && (
            <div style={{ marginBottom: "16px" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "8px",
                }}
              >
                <div
                  style={{
                    fontSize: "12px",
                    fontWeight: "700",
                    color: "#1E293B",
                  }}
                >
                  5. Nước uống & Tiện ích đi kèm (Tùy chọn):
                </div>
                {calculateItemsTotal() > 0 && (
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: "800",
                      color: "#059669",
                      backgroundColor: "#ECFDF5",
                      padding: "2px 8px",
                      borderRadius: "6px",
                    }}
                  >
                    +{new Intl.NumberFormat("vi-VN").format(calculateItemsTotal())}đ
                  </span>
                )}
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                  maxHeight: "150px",
                  overflowY: "auto",
                  padding: "2px",
                }}
              >
                {products.map((p) => {
                  const qty = selectedItems[`product:${p.id}`] || 0;
                  return (
                    <div
                      key={`bp-${p.id}`}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "8px 10px",
                        borderRadius: "10px",
                        border:
                          qty > 0 ? "1.5px solid #059669" : "1px solid #E2E8F0",
                        backgroundColor: qty > 0 ? "#F0FDF4" : "#FFFFFF",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: "12px",
                            fontWeight: "700",
                            color: "#0F172A",
                          }}
                        >
                          {p.name}
                        </div>
                        <div
                          style={{
                            fontSize: "10px",
                            color: "#059669",
                            fontWeight: "700",
                          }}
                        >
                          {new Intl.NumberFormat("vi-VN").format(p.price)}đ /{" "}
                          {p.unit || "món"}
                        </div>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            handleItemQtyChange("product", p.id, -1)
                          }
                          disabled={qty === 0}
                          style={{
                            width: "26px",
                            height: "26px",
                            borderRadius: "6px",
                            border: "1px solid #CBD5E1",
                            backgroundColor: qty === 0 ? "#F1F5F9" : "#FFFFFF",
                            color: qty === 0 ? "#94A3B8" : "#0F172A",
                            fontWeight: "bold",
                            cursor: qty === 0 ? "not-allowed" : "pointer",
                          }}
                        >
                          -
                        </button>
                        <span
                          style={{
                            fontSize: "12px",
                            fontWeight: "700",
                            minWidth: "16px",
                            textAlign: "center",
                          }}
                        >
                          {qty}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            handleItemQtyChange(
                              "product",
                              p.id,
                              1,
                              p.stock
                            )
                          }
                          style={{
                            width: "26px",
                            height: "26px",
                            borderRadius: "6px",
                            border: "none",
                            backgroundColor: "#059669",
                            color: "#FFFFFF",
                            fontWeight: "bold",
                            cursor: "pointer",
                          }}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}

                {services.map((s) => {
                  const qty = selectedItems[`service:${s.id}`] || 0;
                  return (
                    <div
                      key={`bs-${s.id}`}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "8px 10px",
                        borderRadius: "10px",
                        border:
                          qty > 0 ? "1.5px solid #059669" : "1px solid #E2E8F0",
                        backgroundColor: qty > 0 ? "#F0FDF4" : "#FFFFFF",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: "12px",
                            fontWeight: "700",
                            color: "#0F172A",
                          }}
                        >
                          {s.name}
                        </div>
                        <div
                          style={{
                            fontSize: "10px",
                            color: "#059669",
                            fontWeight: "700",
                          }}
                        >
                          {new Intl.NumberFormat("vi-VN").format(s.price)}đ /{" "}
                          {s.unit || "lượt"}
                        </div>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            handleItemQtyChange("service", s.id, -1)
                          }
                          disabled={qty === 0}
                          style={{
                            width: "26px",
                            height: "26px",
                            borderRadius: "6px",
                            border: "1px solid #CBD5E1",
                            backgroundColor: qty === 0 ? "#F1F5F9" : "#FFFFFF",
                            color: qty === 0 ? "#94A3B8" : "#0F172A",
                            fontWeight: "bold",
                            cursor: qty === 0 ? "not-allowed" : "pointer",
                          }}
                        >
                          -
                        </button>
                        <span
                          style={{
                            fontSize: "12px",
                            fontWeight: "700",
                            minWidth: "16px",
                            textAlign: "center",
                          }}
                        >
                          {qty}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            handleItemQtyChange("service", s.id, 1)
                          }
                          style={{
                            width: "26px",
                            height: "26px",
                            borderRadius: "6px",
                            border: "none",
                            backgroundColor: "#059669",
                            color: "#FFFFFF",
                            fontWeight: "bold",
                            cursor: "pointer",
                          }}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Nút hành động */}
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              type="button"
              onClick={() => setShowBookingModal(false)}
              style={{
                flex: 1,
                padding: "12px 0",
                borderRadius: "12px",
                backgroundColor: "#F1F5F9",
                border: "1px solid #CBD5E1",
                color: "#475569",
                fontSize: "13px",
                fontWeight: "700",
                cursor: "pointer",
              }}
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={submitBooking}
              style={{
                flex: 1.5,
                padding: "12px 0",
                borderRadius: "12px",
                background:
                  "linear-gradient(135deg, #059669 0%, #047857 100%)",
                border: "none",
                color: "#FFFFFF",
                fontSize: "13px",
                fontWeight: "800",
                cursor: "pointer",
                boxShadow: "0 2px 8px rgba(5,150,105,0.3)",
              }}
            >
              Xác nhận Đặt sân
            </button>
          </div>
        </Box>
      </Modal>

      {/* MODAL 3: THANH TOÁN CHUYỂN KHOẢN VIETQR (GIỐNG NHƯ WEB) */}
      <Modal
        visible={showTransferModal}
        title="Chuyển khoản để giữ sân"
        onClose={() => setShowTransferModal(false)}
      >
        <Box p={0} style={{ overflow: "visible" }}>
          {transferDetails && selectedVenue && (
            <div>
              <div style={{ textAlign: "center", marginBottom: "12px" }}>
                <div
                  style={{
                    fontSize: "14px",
                    fontWeight: "800",
                    color: "#0F172A",
                  }}
                >
                  {selectedVenue.name} · {transferDetails.courtName}
                </div>
                <div
                  style={{
                    fontSize: "11px",
                    color: "#64748B",
                    marginTop: "2px",
                  }}
                >
                  📅 {new Date(transferDetails.date).toLocaleDateString("vi-VN")}{" "}
                  · ⏰ {transferDetails.startTime} - {transferDetails.endTime}
                </div>
              </div>

              {/* Ảnh mã QR VietQR tự động điền số tiền và nội dung */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  padding: "10px",
                  backgroundColor: "#FFFFFF",
                  borderRadius: "16px",
                  border: "1px solid #E2E8F0",
                  marginBottom: "12px",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                }}
              >
                <img
                  src={`https://img.vietqr.io/image/${encodeURIComponent(
                    selectedVenue.bankCode || "VIETCOMBANK"
                  )}-${encodeURIComponent(
                    selectedVenue.bankAccountNumber || ""
                  )}-compact2.png?amount=${Math.round(
                    transferDetails.amount
                  )}&addInfo=${encodeURIComponent(
                    transferDetails.reference
                  )}&accountName=${encodeURIComponent(
                    selectedVenue.bankAccountName || ""
                  )}`}
                  alt="Mã QR chuyển khoản VietQR"
                  style={{
                    width: "200px",
                    height: "200px",
                    objectFit: "contain",
                    display: "block",
                  }}
                />
              </div>

              {/* Thông tin tài khoản chi tiết */}
              <div
                style={{
                  backgroundColor: "#F0FDF4",
                  border: "1px solid #BBF7D0",
                  borderRadius: "14px",
                  padding: "12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                  marginBottom: "12px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: "12px",
                  }}
                >
                  <span style={{ color: "#166534", fontWeight: "600" }}>
                    Ngân hàng:
                  </span>
                  <span style={{ fontWeight: "800", color: "#0F172A" }}>
                    {selectedVenue.bankCode}
                  </span>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: "12px",
                  }}
                >
                  <span style={{ color: "#166534", fontWeight: "600" }}>
                    Số tài khoản:
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span
                      style={{
                        fontWeight: "800",
                        color: "#0F172A",
                        letterSpacing: "0.5px",
                      }}
                    >
                      {selectedVenue.bankAccountNumber}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        handleCopy(
                          selectedVenue.bankAccountNumber,
                          "số tài khoản"
                        )
                      }
                      style={{
                        padding: "2px 6px",
                        fontSize: "10px",
                        fontWeight: "700",
                        backgroundColor: "#DCFCE7",
                        color: "#15803D",
                        border: "1px solid #86EFAC",
                        borderRadius: "6px",
                        cursor: "pointer",
                      }}
                    >
                      Copy
                    </button>
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: "12px",
                  }}
                >
                  <span style={{ color: "#166534", fontWeight: "600" }}>
                    Chủ tài khoản:
                  </span>
                  <span style={{ fontWeight: "800", color: "#0F172A" }}>
                    {selectedVenue.bankAccountName}
                  </span>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: "12px",
                  }}
                >
                  <span style={{ color: "#166534", fontWeight: "600" }}>
                    Số tiền:
                  </span>
                  <span
                    style={{
                      fontWeight: "900",
                      color: "#059669",
                      fontSize: "14px",
                    }}
                  >
                    {new Intl.NumberFormat("vi-VN", {
                      style: "currency",
                      currency: "VND",
                    }).format(transferDetails.amount)}
                  </span>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: "12px",
                    backgroundColor: "#DCFCE7",
                    padding: "6px 8px",
                    borderRadius: "8px",
                    marginTop: "2px",
                  }}
                >
                  <span style={{ color: "#166534", fontWeight: "700" }}>
                    Nội dung CK:
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ fontWeight: "900", color: "#0F172A" }}>
                      {transferDetails.reference}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        handleCopy(
                          transferDetails.reference,
                          "nội dung chuyển khoản"
                        )
                      }
                      style={{
                        padding: "2px 6px",
                        fontSize: "10px",
                        fontWeight: "700",
                        backgroundColor: "#059669",
                        color: "#FFFFFF",
                        border: "none",
                        borderRadius: "6px",
                        cursor: "pointer",
                      }}
                    >
                      Copy
                    </button>
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: "11px",
                    marginTop: "2px",
                  }}
                >
                  <span style={{ color: "#64748B" }}>Hạn thanh toán:</span>
                  <span style={{ color: "#DC2626", fontWeight: "700" }}>
                    30 phút (Hết hạn lúc{" "}
                    {new Date(transferDetails.expiresAt).toLocaleTimeString(
                      "vi-VN",
                      { hour: "2-digit", minute: "2-digit" }
                    )}
                    )
                  </span>
                </div>
              </div>

              <div
                style={{
                  fontSize: "11px",
                  color: "#64748B",
                  lineHeight: "1.4",
                  marginBottom: "12px",
                  textAlign: "center",
                }}
              >
                💡 Quét mã QR bằng App ngân hàng bất kỳ. Mã đã tự động điền sẵn số tiền và nội dung. Sân sẽ được giữ và xác nhận sau khi nhận được chuyển khoản.
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowTransferModal(false);
                  navigate("/history");
                }}
                style={{
                  width: "100%",
                  padding: "12px 0",
                  borderRadius: "12px",
                  background:
                    "linear-gradient(135deg, #059669 0%, #047857 100%)",
                  color: "#FFFFFF",
                  fontSize: "13px",
                  fontWeight: "800",
                  border: "none",
                  cursor: "pointer",
                  boxShadow: "0 2px 8px rgba(5,150,105,0.3)",
                }}
              >
                Tôi đã chuyển khoản xong · Xem lịch sử
              </button>
            </div>
          )}
        </Box>
      </Modal>

      {/* MODAL 4: TÀI KHOẢN & ĐĂNG NHẬP */}
      <Modal
        visible={showAuthModal}
        title={currentUser ? "Tài khoản của bạn" : "Đăng nhập tài khoản"}
        onClose={() => setShowAuthModal(false)}
      >
        <Box p={0} style={{ overflow: "visible" }}>
          {currentUser ? (
            <div>
              <div
                style={{
                  backgroundColor: "#F8FAFC",
                  borderRadius: "14px",
                  padding: "16px",
                  border: "1px solid #E2E8F0",
                  marginBottom: "14px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                  <div
                    style={{
                      width: "44px",
                      height: "44px",
                      borderRadius: "50%",
                      backgroundColor: "#ECFDF5",
                      border: "2px solid #A7F3D0",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "20px",
                    }}
                  >
                    👤
                  </div>
                  <div>
                    <div style={{ fontSize: "15px", fontWeight: "800", color: "#0F172A" }}>
                      {currentUser.name}
                    </div>
                    <div style={{ fontSize: "12px", color: "#64748B", marginTop: "2px" }}>
                      📱 {currentUser.phone}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    backgroundColor: "#FFFFFF",
                    padding: "10px 12px",
                    borderRadius: "10px",
                    border: "1px solid #E2E8F0",
                    marginBottom: "8px",
                  }}
                >
                  <span style={{ fontSize: "12px", color: "#64748B" }}>Ưu đãi Sinh viên:</span>
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: "700",
                      color: currentUser.isVerifiedHue ? "#047857" : "#D97706",
                      backgroundColor: currentUser.isVerifiedHue ? "#DCFCE7" : "#FEF3C7",
                      padding: "2px 8px",
                      borderRadius: "6px",
                    }}
                  >
                    {currentUser.isVerifiedHue ? "🎓 Đã xác thực (-20%)" : "Chưa xác thực"}
                  </span>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    backgroundColor: "#FFFFFF",
                    padding: "10px 12px",
                    borderRadius: "10px",
                    border: "1px solid #E2E8F0",
                  }}
                >
                  <span style={{ fontSize: "12px", color: "#64748B" }}>Điểm tích lũy:</span>
                  <span style={{ fontSize: "13px", fontWeight: "800", color: "#059669" }}>
                    {currentUser.points || 0} điểm
                  </span>
                </div>
              </div>

              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowAuthModal(false);
                    navigate("/history");
                  }}
                  style={{
                    flex: 1,
                    padding: "12px 0",
                    borderRadius: "12px",
                    backgroundColor: "#F1F5F9",
                    border: "1px solid #CBD5E1",
                    color: "#334155",
                    fontSize: "13px",
                    fontWeight: "700",
                    cursor: "pointer",
                  }}
                >
                  Lịch sử đặt sân
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleLogout();
                    setShowAuthModal(false);
                  }}
                  style={{
                    flex: 1,
                    padding: "12px 0",
                    borderRadius: "12px",
                    backgroundColor: "#FEF2F2",
                    border: "1px solid #FECACA",
                    color: "#DC2626",
                    fontSize: "13px",
                    fontWeight: "700",
                    cursor: "pointer",
                  }}
                >
                  Đăng xuất
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div
                style={{
                  backgroundColor: "#F0FDF4",
                  border: "1px solid #BBF7D0",
                  borderRadius: "12px",
                  padding: "10px 12px",
                  marginBottom: "14px",
                  fontSize: "12px",
                  color: "#166534",
                  lineHeight: "1.4",
                }}
              >
                💡 Đăng nhập bằng tài khoản Web Portal để nhận điểm thưởng và ưu đãi sinh viên HUE (-20%).
              </div>

              <div style={{ marginBottom: "12px" }}>
                <label
                  style={{
                    fontSize: "12px",
                    fontWeight: "700",
                    color: "#334155",
                    display: "block",
                    marginBottom: "6px",
                  }}
                >
                  Số điện thoại:
                </label>
                <input
                  type="tel"
                  placeholder="Ví dụ: 0912345678"
                  className="modern-input"
                  value={authPhone}
                  onChange={(e) => setAuthPhone(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: "16px" }}>
                <label
                  style={{
                    fontSize: "12px",
                    fontWeight: "700",
                    color: "#334155",
                    display: "block",
                    marginBottom: "6px",
                  }}
                >
                  Mật khẩu:
                </label>
                <input
                  type="password"
                  placeholder="Nhập mật khẩu..."
                  className="modern-input"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                />
              </div>

              <button
                type="button"
                onClick={handleLogin}
                disabled={authLoading}
                style={{
                  width: "100%",
                  padding: "12px 0",
                  borderRadius: "12px",
                  background:
                    "linear-gradient(135deg, #059669 0%, #047857 100%)",
                  color: "#FFFFFF",
                  fontSize: "14px",
                  fontWeight: "800",
                  border: "none",
                  cursor: authLoading ? "not-allowed" : "pointer",
                  boxShadow: "0 2px 8px rgba(5,150,105,0.3)",
                  marginBottom: "10px",
                }}
              >
                {authLoading ? "Đang xác thực..." : "Đăng nhập ngay"}
              </button>

              <div
                style={{
                  textAlign: "center",
                  fontSize: "11px",
                  color: "#64748B",
                  marginTop: "8px",
                }}
              >
                Bạn chưa có tài khoản? Bạn vẫn có thể đặt sân trực tiếp bằng cách điền Tên & SĐT khi đặt!
              </div>
            </div>
          )}
        </Box>
      </Modal>
    </Page>
  );
}
