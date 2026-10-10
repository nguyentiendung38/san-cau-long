const fs = require('fs');
let code = fs.readFileSync('apps/zalo-app/src/pages/index.tsx', 'utf8');

// 1. Add new states
code = code.replace(
  'const [selectedCourt, setSelectedCourt] = useState("");',
  'const [selectedCourt, setSelectedCourt] = useState("");\n  const [customerName, setCustomerName] = useState("");\n  const [customerPhone, setCustomerPhone] = useState("");'
);

// 2. Add inputs to modal
code = code.replace(
  '<Text size="small" bold style={{ marginTop: "16px", marginBottom: "8px" }}>Chọn sân:</Text>',
  `<Text size="small" bold style={{ marginTop: "16px", marginBottom: "8px" }}>Tên của bạn:</Text>
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
          <Text size="small" bold style={{ marginBottom: "8px" }}>Chọn sân:</Text>`
);

// 3. Update submitBooking logic
const submitCode = `  const submitBooking = () => {
    if (!selectedCourt || !bookingDate || !bookingTime || !customerName || !customerPhone) {
      openSnackbar({ type: "warning", text: "Vui lòng nhập đầy đủ thông tin!" });
      return;
    }
    
    const [h, m] = bookingTime.split(':');
    const endH = parseInt(h) + 1;
    const endTime = \`\${endH.toString().padStart(2, '0')}:\${m}\`;

    fetch(\`\${API_URL}/booking-requests/public\`, {
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
        notes: 'Đặt từ Zalo Mini App'
      })
    })
    .then(res => res.json())
    .then(data => {
      if(data.success) {
        openSnackbar({ type: "success", text: "Đã gửi yêu cầu về hệ thống Courtify!" });
        setShowBookingModal(false);
      } else {
        openSnackbar({ type: "warning", text: data.message || "Lỗi đặt sân" });
      }
    })
    .catch(err => {
      openSnackbar({ type: "warning", text: "Lỗi kết nối!" });
    });
  };`;

code = code.replace(
  /const submitBooking = \(\) => \{[\s\S]*?setBookingTime\(""\);\s*\};/,
  submitCode
);

fs.writeFileSync('apps/zalo-app/src/pages/index.tsx', code);
