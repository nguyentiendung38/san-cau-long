const fs = require('fs');
let code = fs.readFileSync('apps/zalo-app/src/pages/index.tsx', 'utf8');

// 1. Add state for endTime
code = code.replace(
  'const [bookingTime, setBookingTime] = useState("");',
  'const [bookingTime, setBookingTime] = useState("");\n  const [endTime, setEndTime] = useState("");'
);

// 2. Add End Time dropdown HTML
const startTimeHtml = `          <Text size="small" bold style={{ marginBottom: "8px" }}>Giờ bắt đầu:</Text>
          <select 
            value={bookingTime} 
            onChange={(e) => setBookingTime(e.target.value)} 
            style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #CBD5E1", backgroundColor: "white", marginBottom: "16px" }}
          >
            <option value="">Chọn giờ bắt đầu</option>
            {generateTimeOptions().map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>`;

const endTimeHtml = `          <Text size="small" bold style={{ marginBottom: "8px" }}>Giờ kết thúc:</Text>
          <select 
            value={endTime} 
            onChange={(e) => setEndTime(e.target.value)} 
            style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #CBD5E1", backgroundColor: "white", marginBottom: "16px" }}
          >
            <option value="">Chọn giờ kết thúc</option>
            {generateTimeOptions().map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>`;

code = code.replace(
  /<Text size="small" bold style=\{\{ marginBottom: "8px" \}\}>Giờ bắt đầu:<\/Text>[\s\S]*?<\/select>/,
  startTimeHtml + '\n' + endTimeHtml
);

// 3. Fix validation logic
code = code.replace(
  /const \[h, m\] = bookingTime\.split\(':'\);[\s\S]*?const endTime = `\$\{endH\.toString\(\)\.padStart\(2, '0'\)\}:\$\{m\}`;/,
  `if (!bookingTime || !endTime) {
      openSnackbar({ type: "warning", text: "Vui lòng chọn đầy đủ giờ bắt đầu và kết thúc!" });
      return;
    }
    if (endTime <= bookingTime) {
      openSnackbar({ type: "warning", text: "Giờ kết thúc phải lớn hơn giờ bắt đầu!" });
      return;
    }`
);

fs.writeFileSync('apps/zalo-app/src/pages/index.tsx', code);
