const fs = require('fs');
let code = fs.readFileSync('apps/zalo-app/src/pages/availability.tsx', 'utf8');

const oldSelector = /<div style=\{\{ display: 'flex', overflowX: 'auto', gap: '8px', paddingBottom: '4px', scrollbarWidth: 'none' \}\}>[\s\S]*?<\/div>/;

const newSelector = `<select 
            value={selectedVenue}
            onChange={(e) => setSelectedVenue(e.target.value)}
            style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #CBD5E1", backgroundColor: "white" }}
          >
            {venues.map(v => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>`;

code = code.replace(oldSelector, newSelector);

fs.writeFileSync('apps/zalo-app/src/pages/availability.tsx', code);
