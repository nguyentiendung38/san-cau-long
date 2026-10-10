const fs = require('fs');
let code = fs.readFileSync('apps/zalo-app/src/pages/index.tsx', 'utf8');

const timeOptions = [];
for (let h = 5; h <= 23; h++) {
  const hStr = h.toString().padStart(2, '0');
  timeOptions.push('<option value="' + hStr + ':00">' + hStr + ':00</option>');
  timeOptions.push('<option value="' + hStr + ':30">' + hStr + ':30</option>');
}
const optionsString = timeOptions.join('\\n              ');

const regexStart = /<Text size="small" bold style=\{\{ marginTop: "16px", marginBottom: "8px" \}\}>Giờ bắt đầu:<\/Text>[\s\S]*?<input[\s\S]*?onChange=\{\(e\) => setBookingTime\(e.target.value\)\}[\s\S]*?\/>/;
const regexEnd = /<Text size="small" bold style=\{\{ marginTop: "16px", marginBottom: "8px" \}\}>Giờ kết thúc:<\/Text>[\s\S]*?<input[\s\S]*?onChange=\{\(e\) => setEndTime\(e.target.value\)\}[\s\S]*?\/>/;

const newTimeInput = \`<Text size="small" bold style={{ marginTop: "16px", marginBottom: "8px" }}>Giờ bắt đầu:</Text>
            <select 
              value={bookingTime}
              onChange={(e) => setBookingTime(e.target.value)}
              style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #CBD5E1", backgroundColor: "white" }}
            >
              <option value="">Chọn giờ...</option>
              \${optionsString}
            </select>\`;

const newEndInput = \`<Text size="small" bold style={{ marginTop: "16px", marginBottom: "8px" }}>Giờ kết thúc:</Text>
            <select 
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #CBD5E1", backgroundColor: "white" }}
            >
              <option value="">Chọn giờ...</option>
              \${optionsString}
            </select>\`;

code = code.replace(regexStart, newTimeInput);
code = code.replace(regexEnd, newEndInput);

fs.writeFileSync('apps/zalo-app/src/pages/index.tsx', code);
