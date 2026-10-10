const fs = require('fs');
let code = fs.readFileSync('apps/zalo-app/src/pages/availability.tsx', 'utf8');

const regex = /<Box className="bg-white p-4 rounded-xl shadow-sm overflow-x-auto">[\s\S]*?(?=\) : null\})/;

const getNextHalfHour = "  const getNextHalfHourStr = (time: string) => {\\n" +
"    const [h, m] = time.split(':').map(Number);\\n" +
"    if (m === 0) return `${h.toString().padStart(2, '0')}:30`;\\n" +
"    return `${(h + 1).toString().padStart(2, '0')}:00`;\\n" +
"  };\\n";

if (!code.includes('getNextHalfHourStr')) {
  code = code.replace('const isPassed', getNextHalfHour + '\\n  const isPassed');
}

const newGrid = '<Box className="bg-white p-4 rounded-xl shadow-sm">\\n' +
'            <div style={{ display: \\'flex\\', flexDirection: \\'column\\', gap: \\'24px\\' }}>\\n' +
'              {availability.courts.map((court: any) => (\\n' +
'                <div key={court.id}>\\n' +
'                  <Text bold style={{ marginBottom: \\'12px\\', fontSize: \\'15px\\', color: \\'#1E293B\\', borderBottom: \\'2px solid #F1F5F9\\', paddingBottom: \\'8px\\' }}>\\n' +
'                    {court.name}\\n' +
'                  </Text>\\n' +
'                  <div style={{ display: \\'grid\\', gridTemplateColumns: \\'repeat(3, 1fr)\\', gap: \\'8px\\' }}>\\n' +
'                    {timeSlots.map(time => {\\n' +
'                      const booked = isBooked(court.id, time);\\n' +
'                      const passed = isPassed(time);\\n' +
'                      const nextTime = getNextHalfHourStr(time);\\n' +
'                      \\n' +
'                      let bgColor = \\'#ECFDF5\\';\\n' +
'                      let textColor = \\'#059669\\';\\n' +
'                      let borderColor = \\'#34D399\\';\\n' +
'                      \\n' +
'                      if (passed) {\\n' +
'                        bgColor = \\'#F3F4F6\\';\\n' +
'                        textColor = \\'#9CA3AF\\';\\n' +
'                        borderColor = \\'#E5E7EB\\';\\n' +
'                      } else if (booked) {\\n' +
'                        bgColor = \\'#FEF2F2\\';\\n' +
'                        textColor = \\'#DC2626\\';\\n' +
'                        borderColor = \\'#FCA5A5\\';\\n' +
'                      }\\n' +
'\\n' +
'                      return (\\n' +
'                        <div \\n' +
'                          key={time} \\n' +
'                          style={{\\n' +
'                            backgroundColor: bgColor,\\n' +
'                            color: textColor,\\n' +
'                            border: `1px solid ${borderColor}`,\\n' +
'                            borderRadius: \\'8px\\',\\n' +
'                            padding: \\'8px 4px\\',\\n' +
'                            display: \\'flex\\',\\n' +
'                            flexDirection: \\'column\\',\\n' +
'                            alignItems: \\'center\\',\\n' +
'                            justifyContent: \\'center\\',\\n' +
'                            opacity: passed ? 0.6 : 1\\n' +
'                          }}\\n' +
'                        >\\n' +
'                          <span style={{ fontSize: \\'11px\\', fontWeight: \\'bold\\' }}>{time}-{nextTime}</span>\\n' +
'                        </div>\\n' +
'                      );\\n' +
'                    })}\\n' +
'                  </div>\\n' +
'                </div>\\n' +
'              ))}\\n' +
'            </div>\\n' +
'\\n' +
'             <Box mt={6} flex flexDirection="row" justifyContent="center">\\n' +
'                <Box flex alignItems="center" mr={4}>\\n' +
'                  <Box style={{ width: 12, height: 12, backgroundColor: \\'#ECFDF5\\', marginRight: 4, borderRadius: 2, border: \\'1px solid #34D399\\' }}></Box>\\n' +
'                  <Text size="xSmall">Trống</Text>\\n' +
'                </Box>\\n' +
'                <Box flex alignItems="center" mr={4}>\\n' +
'                  <Box style={{ width: 12, height: 12, backgroundColor: \\'#FEF2F2\\', marginRight: 4, borderRadius: 2, border: \\'1px solid #FCA5A5\\' }}></Box>\\n' +
'                  <Text size="xSmall">Đã đặt</Text>\\n' +
'                </Box>\\n' +
'                <Box flex alignItems="center">\\n' +
'                  <Box style={{ width: 12, height: 12, backgroundColor: \\'#F3F4F6\\', marginRight: 4, borderRadius: 2, border: \\'1px solid #E5E7EB\\' }}></Box>\\n' +
'                  <Text size="xSmall">Đã qua</Text>\\n' +
'                </Box>\\n' +
'             </Box>\\n' +
'          </Box>\\n        ';

code = code.replace(regex, newGrid);
fs.writeFileSync('apps/zalo-app/src/pages/availability.tsx', code);
