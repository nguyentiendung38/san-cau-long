const fs = require('fs');
let code = fs.readFileSync('apps/zalo-app/src/pages/index.tsx', 'utf8');

// 1. Add courts and selectedCourt states
code = code.replace(
  'const [bookingTime, setBookingTime] = useState("");',
  'const [bookingTime, setBookingTime] = useState("");\n  const [courts, setCourts] = useState<any[]>([]);\n  const [selectedCourt, setSelectedCourt] = useState("");'
);

// 2. Modify handleBookClick
code = code.replace(
  /const handleBookClick = \(venue: any\) => \{[\s\S]*?\};\n/,
  `const handleBookClick = (venue: any) => {
    setSelectedVenue(venue);
    setShowBookingModal(true);
    setCourts([]);
    setSelectedCourt("");
    fetch(\`\${API_URL}/venues/\${venue.id}/availability?date=\${new Date().toISOString()}\`)
      .then(res => res.json())
      .then(data => {
         if (data.success && data.data && data.data.courts) {
            setCourts(data.data.courts);
            if (data.data.courts.length > 0) setSelectedCourt(data.data.courts[0].id);
         }
      })
      .catch(console.error);
  };\n`
);

// 3. Modify submitBooking check
code = code.replace(
  'if (!bookingDate || !bookingTime) {',
  'if (!selectedCourt || !bookingDate || !bookingTime) {\n      openSnackbar({ type: "warning", text: "Vui lòng chọn đầy đủ Sân, Ngày và Giờ!" });\n      return;\n    }\n    if (false) {'
);

// 4. Add select UI to Modal
code = code.replace(
  '<Text size="small" bold style={{ marginTop: "16px", marginBottom: "8px" }}>Ngày chơi:</Text>',
  `<Text size="small" bold style={{ marginTop: "16px", marginBottom: "8px" }}>Chọn sân:</Text>
          <select 
            value={selectedCourt}
            onChange={(e) => setSelectedCourt(e.target.value)}
            style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #CBD5E1", backgroundColor: "white" }}
          >
            {courts.length === 0 ? <option value="">Đang tải danh sách sân...</option> : null}
            {courts.map(c => (
              <option key={c.id} value={c.id}>{c.name} - {c.surfaceType || 'Tiêu chuẩn'}</option>
            ))}
          </select>
          
          <Text size="small" bold style={{ marginTop: "16px", marginBottom: "8px" }}>Ngày chơi:</Text>`
);

fs.writeFileSync('apps/zalo-app/src/pages/index.tsx', code);
