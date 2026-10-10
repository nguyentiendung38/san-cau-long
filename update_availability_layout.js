const fs = require('fs');
let code = fs.readFileSync('apps/zalo-app/src/pages/availability.tsx', 'utf8');

const oldGrid = `<Box className="bg-white p-4 rounded-xl shadow-sm overflow-x-auto">
             <div style={{ display: 'flex', minWidth: 'max-content' }}>
                <div style={{ width: '60px', flexShrink: 0, borderRight: '1px solid #eee' }}>
                   <div style={{ height: '40px', borderBottom: '1px solid #eee' }}></div>
                   {timeSlots.map(time => (
                     <div key={time} style={{ height: '30px', fontSize: '10px', color: '#888', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px dashed #eee' }}>
                       {time}
                     </div>
                   ))}
                </div>
                {availability.courts.map((court: any) => (
                  <div key={court.id} style={{ width: '100px', flexShrink: 0, borderRight: '1px solid #eee' }}>
                    <div style={{ height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid #eee', fontWeight: 'bold', fontSize: '12px', textAlign: 'center' }}>
                      {court.name}
                    </div>
                    {timeSlots.map(time => {
                      const booked = isBooked(court.id, time);
                      return (
                        <div key={time} style={{ 
                          height: '30px', 
                          borderBottom: '1px dashed #eee',
                          backgroundColor: booked ? '#FEE2E2' : '#ECFDF5',
                          display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                          {booked ? <Icon icon="zi-close" style={{ color: '#EF4444', fontSize: '14px' }}/> : <Icon icon="zi-check" style={{ color: '#10B981', fontSize: '14px' }}/>}
                        </div>
                      );
                    })}
                  </div>
                ))}
             </div>`;

const newGrid = `<Box className="bg-white p-4 rounded-xl shadow-sm overflow-x-auto">
             <div style={{ overflowX: 'auto', paddingBottom: '16px' }}>
               <div style={{ display: 'flex', minWidth: 'max-content' }}>
                  <div style={{ width: '80px', flexShrink: 0, borderRight: '1px solid #eee', position: 'sticky', left: 0, backgroundColor: 'white', zIndex: 10 }}>
                     <div style={{ height: '30px', borderBottom: '1px solid #eee' }}></div>
                     {availability.courts.map((court: any) => (
                       <div key={court.id} style={{ height: '40px', display: 'flex', alignItems: 'center', fontWeight: 'bold', fontSize: '12px', borderBottom: '1px solid #eee' }}>
                         {court.name}
                       </div>
                     ))}
                  </div>
                  
                  {timeSlots.map(time => (
                    <div key={time} style={{ width: '50px', flexShrink: 0, borderRight: '1px solid #eee' }}>
                      <div style={{ height: '30px', fontSize: '10px', color: '#888', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid #eee' }}>
                        {time}
                      </div>
                      {availability.courts.map((court: any) => {
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
                      })}
                    </div>
                  ))}
               </div>
             </div>`;

code = code.replace(oldGrid, newGrid);

fs.writeFileSync('apps/zalo-app/src/pages/availability.tsx', code);
