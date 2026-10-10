const fs = require('fs');
let code = fs.readFileSync('apps/zalo-app/src/pages/index.tsx', 'utf8');

const oldCourtSelector = /<div style=\{\{ display: 'flex', overflowX: 'auto', gap: '8px', paddingBottom: '4px', scrollbarWidth: 'none' \}\}>[\s\S]*?<\/div>/;

const newCourtSelector = `<select 
                value={selectedCourt}
                onChange={(e) => setSelectedCourt(e.target.value)}
                style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #CBD5E1", backgroundColor: "white" }}
              >
                {courts.map(c => (
                  <option key={c.id} value={c.id}>{c.name + " - " + (c.surfaceType || "Tiêu chuẩn")}</option>
                ))}
              </select>`;

code = code.replace(oldCourtSelector, newCourtSelector);

fs.writeFileSync('apps/zalo-app/src/pages/index.tsx', code);
