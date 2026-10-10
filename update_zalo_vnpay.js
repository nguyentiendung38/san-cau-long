const fs = require('fs');
let code = fs.readFileSync('apps/zalo-app/src/pages/index.tsx', 'utf8');

// Add state for paymentMethod
code = code.replace(
  'const [customerPhone, setCustomerPhone] = useState("");',
  'const [customerPhone, setCustomerPhone] = useState("");\n  const [paymentMethod, setPaymentMethod] = useState("DEPOSIT_TRANSFER");'
);

// Add select UI in Modal
code = code.replace(
  '<Text size="small" bold style={{ marginBottom: "8px" }}>Chọn sân:</Text>',
  `<Text size="small" bold style={{ marginBottom: "8px" }}>Hình thức thanh toán:</Text>
          <select 
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #CBD5E1", backgroundColor: "white", marginBottom: "16px" }}
          >
            <option value="DEPOSIT_TRANSFER">Thanh toán tại sân (Chờ kiểm tra)</option>
            <option value="VNPAY">Thanh toán online (VNPAY)</option>
          </select>
          <Text size="small" bold style={{ marginBottom: "8px" }}>Chọn sân:</Text>`
);

// Modify submit code
const newSubmitCode = `
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
        notes: 'Đặt từ Zalo Mini App',
        paymentMethod: paymentMethod
      })
    })
    .then(res => res.json())
    .then(data => {
      if(data.success) {
        if (paymentMethod === 'VNPAY' && data.data && data.data.id) {
           openSnackbar({ type: "success", text: "Đang chuyển hướng đến VNPAY..." });
           fetch(\`\${API_URL}/vnpay/create-payment\`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                 orderId: data.data.id,
                 amount: data.data.paymentAmount || 100000
              })
           })
           .then(r => r.json())
           .then(payData => {
              if (payData.success && payData.payUrl) {
                 window.location.href = payData.payUrl;
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
`;

code = code.replace(/fetch\(`\$\{API_URL\}\/booking-requests\/public`, \{[\s\S]*?\}\);\s*\};/m, newSubmitCode.trim() + '\n  };');

fs.writeFileSync('apps/zalo-app/src/pages/index.tsx', code);
