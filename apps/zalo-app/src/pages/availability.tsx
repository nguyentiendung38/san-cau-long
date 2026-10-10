import React, { useEffect, useState } from "react";
import { Page, Header, Box, Text, Select, Icon } from "zmp-ui";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:3005/api";

const AvailabilityPage = () => {
  const [venues, setVenues] = useState<any[]>([]);
  const [selectedVenue, setSelectedVenue] = useState<string>("");
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
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
      .then(res => res.json())
      .then(data => {
        if (data.success) setAvailability(data.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedVenue, date]);

  const generateTimeSlots = () => {
    const slots: string[] = [];
    for (let h = 5; h <= 23; h++) {
      slots.push(`${h.toString().padStart(2, '0')}:00`);
      slots.push(`${h.toString().padStart(2, '0')}:30`);
    }
    return slots;
  };

  const timeSlots = generateTimeSlots();

  
  const getNextHalfHourStr = (time: string) => {
    const [h, m] = time.split(':').map(Number);
    if (m === 0) return `${h.toString().padStart(2, '0')}:30`;
    return `${(h + 1).toString().padStart(2, '0')}:00`;
  };

  const isPassed = (time: string) => {
    const today = new Date().toISOString().split('T')[0];
    if (date > today) return false;
    if (date < today) return true;
    
    const now = new Date();
    const currentNum = now.getHours() + now.getMinutes() / 60;
    const [h, m] = time.split(':').map(Number);
    const timeNum = h + m / 60;
    
    // If the slot's start time is already in the past
    return timeNum < currentNum;
  };

  const isBooked = (courtId: string, time: string) => {
    if (!availability || !availability.bookings) return false;
    const [h, m] = time.split(':').map(Number);
    const timeNum = h + m / 60;
    
    for (const b of availability.bookings) {
      if (b.courtId === courtId) {
        const [bh1, bm1] = b.startTime.split(':').map(Number);
        const [bh2, bm2] = b.endTime.split(':').map(Number);
        const startNum = bh1 + bm1 / 60;
        const endNum = bh2 + bm2 / 60;
        if (timeNum >= startNum && timeNum < endNum) return true;
      }
    }
    return false;
  };

  return (
    <Page className="page">
      <Header title="Kiểm tra giờ trống" />
      
      <Box p={4} style={{ backgroundColor: "#f4f5f6", minHeight: "100vh" }}>
        <Box className="bg-white p-4 rounded-xl shadow-sm mb-4">
          <Text bold className="mb-2">Chọn cơ sở</Text>
          <select 
            value={selectedVenue}
            onChange={(e) => setSelectedVenue(e.target.value)}
            style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #CBD5E1", backgroundColor: "white" }}
          >
            {venues.map(v => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>

          <Text bold className="mt-4 mb-2">Chọn ngày</Text>
          <input 
            type="date" 
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #CBD5E1" }}
          />
        </Box>

        {loading ? (
          <Text className="text-center text-gray-500 mt-8">Đang kiểm tra lịch...</Text>
        ) : availability && availability.courts ? (
          <Box className="bg-white p-4 rounded-xl shadow-sm">
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              {availability.courts.map((court: any) => (
                <div key={court.id}>
                  <Text bold style={{ marginBottom: "12px", fontSize: "15px", color: "#1E293B", borderBottom: "2px solid #F1F5F9", paddingBottom: "8px" }}>
                    {court.name}
                  </Text>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
                    {timeSlots.map(time => {
                      const booked = isBooked(court.id, time);
                      const passed = isPassed(time);
                      const nextTime = getNextHalfHourStr(time);
                      
                      let bgColor = "#ECFDF5";
                      let textColor = "#059669";
                      let borderColor = "#34D399";
                      
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
                            padding: "8px 4px",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            opacity: passed ? 0.6 : 1
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                            {(booked && !passed) && <Icon icon="zi-close" style={{ color: "#DC2626", fontSize: "14px", fontWeight: "bold" }} />}
                            <span style={{ fontSize: "11px", fontWeight: "bold" }}>{time}-{nextTime}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

             <Box mt={6} flex flexDirection="row" justifyContent="center">
                <Box flex alignItems="center" mr={4}>
                  <Box style={{ width: 12, height: 12, backgroundColor: "#ECFDF5", marginRight: 4, borderRadius: 2, border: "1px solid #34D399" }}></Box>
                  <Text size="xSmall">Trống</Text>
                </Box>
                <Box flex alignItems="center" mr={4}>
                  <Box style={{ width: 12, height: 12, backgroundColor: "#FEF2F2", marginRight: 4, borderRadius: 2, border: "1px solid #FCA5A5" }}></Box>
                  <Text size="xSmall">Đã đặt</Text>
                </Box>
                <Box flex alignItems="center">
                  <Box style={{ width: 12, height: 12, backgroundColor: "#F3F4F6", marginRight: 4, borderRadius: 2, border: "1px solid #E5E7EB" }}></Box>
                  <Text size="xSmall">Đã qua</Text>
                </Box>
             </Box>
          </Box>
        ) : null}
      </Box>
    </Page>
  );
};

export default AvailabilityPage;
