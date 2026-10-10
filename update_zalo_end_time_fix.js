const fs = require('fs');
let code = fs.readFileSync('apps/zalo-app/src/pages/index.tsx', 'utf8');

const regex = /<select \n\s*value=\{bookingTime\}[\s\S]*?<\/select>/;
const match = code.match(regex);
if (match) {
  const replacement = match[0] + `\n<Text size="small" bold style={{ marginBottom: "8px" }}>Giờ kết thúc:</Text>\n          <select \n            value={endTime} \n            onChange={(e) => setEndTime(e.target.value)} \n            style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #CBD5E1", backgroundColor: "white", marginBottom: "16px" }}\n          >\n            <option value="">Chọn giờ kết thúc</option>\n            {generateTimeOptions().map(t => (\n              <option key={t} value={t}>{t}</option>\n            ))}\n          </select>`;
  code = code.replace(match[0], replacement);
}

fs.writeFileSync('apps/zalo-app/src/pages/index.tsx', code);
