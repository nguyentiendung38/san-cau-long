const fs = require('fs');
let code = fs.readFileSync('apps/zalo-app/src/pages/availability.tsx', 'utf8');

const isPassedLogic = `  const isPassed = (time: string) => {
    const today = new Date().toISOString().split('T')[0];
    if (date > today) return false;
    if (date < today) return true;
    
    const now = new Date();
    const currentNum = now.getHours() + now.getMinutes() / 60;
    const [h, m] = time.split(':').map(Number);
    const timeNum = h + m / 60;
    
    // If the slot's start time is already in the past
    return timeNum < currentNum;
  };

  const isBooked =`;

code = code.replace(/  const isBooked =/, isPassedLogic);

const oldRenderLogic = `                      {availability.courts.map((court: any) => {
                        const booked = isBooked(court.id, time);
                        return (
                          <div key={court.id} style={{ 
                            height: '40px', 
                            borderBottom: '1px solid #eee',
                            backgroundColor: booked ? '#FEE2E2' : '#ECFDF5',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                          }}>
                            {booked ? <Icon icon="zi-close" style={{ color: '#EF4444', fontSize: '14px' }}/> : <Icon icon="zi-check" style={{ color: '#10B981', fontSize: '14px' }}/>}
                          </div>
                        );
                      })}`;

const newRenderLogic = `                      {availability.courts.map((court: any) => {
                        const booked = isBooked(court.id, time);
                        const passed = isPassed(time);
                        return (
                          <div key={court.id} style={{ 
                            height: '40px', 
                            borderBottom: '1px solid #eee',
                            backgroundColor: passed ? '#F3F4F6' : (booked ? '#FEE2E2' : '#ECFDF5'),
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            opacity: passed ? 0.6 : 1
                          }}>
                            {passed ? <div style={{width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#9CA3AF'}}></div> : (booked ? <Icon icon="zi-close" style={{ color: '#EF4444', fontSize: '14px' }}/> : <Icon icon="zi-check" style={{ color: '#10B981', fontSize: '14px' }}/>)}
                          </div>
                        );
                      })}`;

code = code.replace(oldRenderLogic, newRenderLogic);

const oldLegend = `<Box mt={4} flex flexDirection="row" justifyContent="center">
                <Box flex alignItems="center" mr={4}>
                  <Box style={{ width: 12, height: 12, backgroundColor: '#ECFDF5', marginRight: 4, borderRadius: 2, border: '1px solid #10B981' }}></Box>
                  <Text size="xSmall">Trống</Text>
                </Box>
                <Box flex alignItems="center">
                  <Box style={{ width: 12, height: 12, backgroundColor: '#FEE2E2', marginRight: 4, borderRadius: 2, border: '1px solid #EF4444' }}></Box>
                  <Text size="xSmall">Đã đặt</Text>
                </Box>
             </Box>`;

const newLegend = `<Box mt={4} flex flexDirection="row" justifyContent="center">
                <Box flex alignItems="center" mr={4}>
                  <Box style={{ width: 12, height: 12, backgroundColor: '#ECFDF5', marginRight: 4, borderRadius: 2, border: '1px solid #10B981' }}></Box>
                  <Text size="xSmall">Trống</Text>
                </Box>
                <Box flex alignItems="center" mr={4}>
                  <Box style={{ width: 12, height: 12, backgroundColor: '#FEE2E2', marginRight: 4, borderRadius: 2, border: '1px solid #EF4444' }}></Box>
                  <Text size="xSmall">Đã đặt</Text>
                </Box>
                <Box flex alignItems="center">
                  <Box style={{ width: 12, height: 12, backgroundColor: '#F3F4F6', marginRight: 4, borderRadius: 2, border: '1px solid #9CA3AF' }}></Box>
                  <Text size="xSmall">Đã qua</Text>
                </Box>
             </Box>`;

code = code.replace(oldLegend, newLegend);

fs.writeFileSync('apps/zalo-app/src/pages/availability.tsx', code);
