const fs = require('fs');
let code = fs.readFileSync('apps/zalo-app/src/pages/availability.tsx', 'utf8');

const oldVenueSelector = `<Select
            value={selectedVenue}
            onChange={(val) => setSelectedVenue(val as string)}
          >
            {venues.map(v => (
              <Select.Option key={v.id} value={v.id} title={v.name} />
            ))}
          </Select>`;

const newVenueSelector = `<div style={{ display: 'flex', overflowX: 'auto', gap: '8px', paddingBottom: '4px', scrollbarWidth: 'none' }}>
            {venues.map(v => (
              <div 
                key={v.id}
                onClick={() => setSelectedVenue(v.id)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '20px',
                  whiteSpace: 'nowrap',
                  fontSize: '13px',
                  fontWeight: selectedVenue === v.id ? 'bold' : 'normal',
                  backgroundColor: selectedVenue === v.id ? '#10B981' : '#F3F4F6',
                  color: selectedVenue === v.id ? 'white' : '#4B5563',
                  border: \`1px solid \${selectedVenue === v.id ? '#10B981' : '#E5E7EB'}\`,
                  transition: 'all 0.2s ease'
                }}
              >
                {v.name}
              </div>
            ))}
          </div>`;

code = code.replace(oldVenueSelector, newVenueSelector);

fs.writeFileSync('apps/zalo-app/src/pages/availability.tsx', code);
