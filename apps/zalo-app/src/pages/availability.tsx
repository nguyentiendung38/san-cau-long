import React, { useEffect, useState } from "react";
import { Page, Header, Box, Text, Icon, useNavigate } from "zmp-ui";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:3005/api";

const AvailabilityPage = () => {
  const navigate = useNavigate();
  const [venues, setVenues] = useState<any[]>([]);
  const [selectedVenue, setSelectedVenue] = useState<string>("");
  const [date, setDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [availability, setAvailability] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/venues`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          const v = data.data.items || data.data;
          setVenues(v);
          if (v.length > 0) setSelectedVenue(v[0].id);
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!selectedVenue || !date) return;
    setLoading(true);
    fetch(`${API_URL}/venues/${selectedVenue}/availability?date=${date}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setAvailability(data.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedVenue, date]);

  const generateTimeSlots = () => {
    const slots: string[] = [];
    for (let h = 5; h <= 23; h++) {
      slots.push(`${h.toString().padStart(2, "0")}:00`);
      slots.push(`${h.toString().padStart(2, "0")}:30`);
    }
    return slots;
  };

  const timeSlots = generateTimeSlots();

  const getNextHalfHourStr = (time: string) => {
    const [h, m] = time.split(":").map(Number);
    if (m === 0) return `${h.toString().padStart(2, "0")}:30`;
    return `${(h + 1).toString().padStart(2, "0")}:00`;
  };

  const isPassed = (time: string) => {
    const today = new Date().toISOString().split("T")[0];
    if (date > today) return false;
    if (date < today) return true;

    const now = new Date();
    const currentNum = now.getHours() + now.getMinutes() / 60;
    const [h, m] = time.split(":").map(Number);
    const timeNum = h + m / 60;

    return timeNum < currentNum;
  };

  const isBooked = (courtId: string, time: string) => {
    if (!availability || !availability.bookings) return false;
    const [h, m] = time.split(":").map(Number);
    const timeNum = h + m / 60;

    for (const b of availability.bookings) {
      if (b.courtId === courtId) {
        const [bh1, bm1] = b.startTime.split(":").map(Number);
        const [bh2, bm2] = b.endTime.split(":").map(Number);
        const startNum = bh1 + bm1 / 60;
        const endNum = bh2 + bm2 / 60;
        if (timeNum >= startNum && timeNum < endNum) return true;
      }
    }
    return false;
  };

  return (
    <Page className="page page-with-header">
      <Header
        title="Lịch & Giờ Trống Sân"
        showBackIcon={true}
        onBackClick={() => navigate(-1)}
      />

      {/* Filter Card */}
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
            🏢 Chọn cơ sở:
          </label>
          <select
            className="modern-select"
            value={selectedVenue}
            onChange={(e) => setSelectedVenue(e.target.value)}
          >
            {venues.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            style={{
              fontSize: "12px",
              fontWeight: "700",
              color: "#334155",
              display: "block",
              marginBottom: "6px",
            }}
          >
            📅 Chọn ngày xem:
          </label>
          <input
            type="date"
            className="modern-input"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        {/* Chú thích màu sắc */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-around",
            alignItems: "center",
            marginTop: "14px",
            paddingTop: "12px",
            borderTop: "1px solid #F1F5F9",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span
              style={{
                width: "12px",
                height: "12px",
                borderRadius: "4px",
                backgroundColor: "#ECFDF5",
                border: "1px solid #34D399",
              }}
            />
            <span style={{ fontSize: "11px", color: "#166534", fontWeight: "600" }}>
              Còn trống
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span
              style={{
                width: "12px",
                height: "12px",
                borderRadius: "4px",
                backgroundColor: "#FEF2F2",
                border: "1px solid #F87171",
              }}
            />
            <span style={{ fontSize: "11px", color: "#991B1B", fontWeight: "600" }}>
              Đã đặt
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span
              style={{
                width: "12px",
                height: "12px",
                borderRadius: "4px",
                backgroundColor: "#F3F4F6",
                border: "1px solid #D1D5DB",
              }}
            />
            <span style={{ fontSize: "11px", color: "#6B7280", fontWeight: "600" }}>
              Đã qua
            </span>
          </div>
        </div>
      </div>

      {/* Kết quả lịch */}
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
          Đang tải trạng thái sân theo thời gian thực...
        </div>
      ) : availability && availability.courts ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {availability.courts.map((court: any) => (
            <div
              key={court.id}
              style={{
                backgroundColor: "#FFFFFF",
                borderRadius: "16px",
                padding: "16px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                border: "1px solid #E2E8F0",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "12px",
                  paddingBottom: "8px",
                  borderBottom: "1.5px solid #F1F5F9",
                }}
              >
                <div
                  style={{
                    fontSize: "14px",
                    fontWeight: "800",
                    color: "#0F172A",
                  }}
                >
                  🏸 {court.name}
                </div>
                <span
                  style={{
                    fontSize: "11px",
                    color: "#059669",
                    backgroundColor: "#ECFDF5",
                    padding: "3px 8px",
                    borderRadius: "6px",
                    fontWeight: "600",
                  }}
                >
                  {court.surfaceType || "Thảm BWF"}
                </span>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: "6px",
                }}
              >
                {timeSlots.map((time) => {
                  const booked = isBooked(court.id, time);
                  const passed = isPassed(time);
                  const nextTime = getNextHalfHourStr(time);

                  let bgColor = "#ECFDF5";
                  let textColor = "#047857";
                  let borderColor = "#A7F3D0";

                  if (passed) {
                    bgColor = "#F3F4F6";
                    textColor = "#9CA3AF";
                    borderColor = "#E5E7EB";
                  } else if (booked) {
                    bgColor = "#FEF2F2";
                    textColor = "#DC2626";
                    borderColor = "#FCA5A5";
                  }

                  return (
                    <div
                      key={time}
                      style={{
                        backgroundColor: bgColor,
                        color: textColor,
                        border: `1px solid ${borderColor}`,
                        borderRadius: "8px",
                        padding: "8px 2px",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        opacity: passed ? 0.6 : 1,
                        cursor: !passed && !booked ? "pointer" : "default",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "2px",
                        }}
                      >
                        {booked && !passed && (
                          <span style={{ fontSize: "11px", fontWeight: "bold" }}>
                            ✕
                          </span>
                        )}
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: "700",
                          }}
                        >
                          {time}-{nextTime}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </Page>
  );
};

export default AvailabilityPage;
