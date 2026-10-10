const fs = require('fs');
let code = fs.readFileSync('apps/zalo-app/src/pages/availability.tsx', 'utf8');

const regex = /<Box className="bg-white p-4 rounded-xl shadow-sm overflow-x-auto">[\s\S]*?(?=<Box className="bg-white p-4 rounded-xl shadow-sm mt-4">)/;

const getNextHalfHour = \`
  const getNextHalfHourStr = (time: string) => {
    const [h, m] = time.split(':').map(Number);
    if (m === 0) return \\\`\${h.toString().padStart(2, '0')}:30\\\`;
    return \\\`\${(h + 1).toString().padStart(2, '0')}:00\\\`;
  };
\`;

if (!code.includes('getNextHalfHourStr')) {
  code = code.replace('const isPassed', getNextHalfHour + '\\n  const isPassed');
}

const newGrid = \`<Box className="bg-white p-4 rounded-xl shadow-sm">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {availability.courts.map((court: any) => (
                <div key={court.id}>
                  <Text bold style={{ marginBottom: '12px', fontSize: '15px', color: '#1E293B', borderBottom: '2px solid #F1F5F9', paddingBottom: '8px' }}>
                    {court.name}
                  </Text>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                    {timeSlots.map(time => {
                      const booked = isBooked(court.id, time);
                      const passed = isPassed(time);
                      const nextTime = getNextHalfHourStr(time);
                      
                      let bgColor = '#ECFDF5';
                      let textColor = '#059669';
                      let borderColor = '#34D399';
                      let icon = 'zi-check';
                      
                      if (passed) {
                        bgColor = '#F3F4F6';
                        textColor = '#9CA3AF';
                        borderColor = '#E5E7EB';
                        icon = '';
                      } else if (booked) {
                        bgColor = '#FEF2F2';
                        textColor = '#DC2626';
                        borderColor = '#FCA5A5';
                        icon = 'zi-close';
                      }

                      return (
                        <div 
                          key={time} 
                          style={{
                            backgroundColor: bgColor,
                            color: textColor,
                            border: \\\`1px solid \${borderColor}\\\`,
                            borderRadius: '8px',
                            padding: '8px 4px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            opacity: passed ? 0.6 : 1
                          }}
                        >
                          <span style={{ fontSize: '11px', fontWeight: 'bold' }}>{time}-{nextTime}</span>
                          {!passed && <Icon icon={icon} style={{ fontSize: '14px', marginTop: '2px' }} />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

             <Box mt={6} flex flexDirection="row" justifyContent="center">
                <Box flex alignItems="center" mr={4}>
                  <Box style={{ width: 12, height: 12, backgroundColor: '#ECFDF5', marginRight: 4, borderRadius: 2, border: '1px solid #34D399' }}></Box>
                  <Text size="xSmall">Trống</Text>
                </Box>
                <Box flex alignItems="center" mr={4}>
                  <Box style={{ width: 12, height: 12, backgroundColor: '#FEF2F2', marginRight: 4, borderRadius: 2, border: '1px solid #FCA5A5' }}></Box>
                  <Text size="xSmall">Đã đặt</Text>
                </Box>
                <Box flex alignItems="center">
                  <Box style={{ width: 12, height: 12, backgroundColor: '#F3F4F6', marginRight: 4, borderRadius: 2, border: '1px solid #E5E7EB' }}></Box>
                  <Text size="xSmall">Đã qua</Text>
                </Box>
             </Box>
          </Box>
          \`;

code = code.replace(regex, newGrid);
fs.writeFileSync('apps/zalo-app/src/pages/availability.tsx', code);
