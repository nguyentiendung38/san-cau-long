const fs = require("fs");
let content = fs.readFileSync("apps/frontend/src/pages/PortalPage.tsx", "utf8");

const oldBlock = `<div key={court.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex flex-col gap-3 hover:shadow-md transition-shadow">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h4 className="font-bold text-gray-800 text-lg">{court.name}</h4>
                                                <p className="text-xs text-gray-500 mt-0.5">{court.description || 'Sân tiêu chu?n thi ð?u'}</p>
                                            </div>
                                            <span className="text-[10px] font-bold px-2 py-1 bg-green-100 text-[#19b251] rounded-lg">S?N SÀNG</span>
                                        </div>
                                        <button onClick={() => setBookingCourt(court)} className="w-full bg-[#19b251] hover:bg-green-600 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors mt-2 shadow-sm">
                                            Ch?n gi? & Ð?t sân
                                        </button>
                                    </div>`;

const newBlock = `<div key={court.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex flex-col gap-3 hover:shadow-md transition-shadow overflow-hidden">
                                        <div className="-mt-4 -mx-4 mb-0 aspect-video bg-gray-100 relative">
                                            <img 
                                                src={
                                                    court.name.includes('A1') ? '/court-a1.jpg' : 
                                                    court.name.includes('A2') ? '/court-a2.jpg' : 
                                                    court.name.includes('A3') ? '/court-a3.jpg' : 
                                                    court.name.includes('A4') ? '/court-a4.jpg' : 
                                                    '/court-a1.jpg'
                                                }
                                                alt={court.name}
                                                className="w-full h-full object-cover"
                                            />
                                            <div className="absolute top-3 right-3">
                                                <span className="text-[10px] font-bold px-2.5 py-1.5 bg-green-100/90 backdrop-blur-sm text-[#19b251] rounded-lg border border-green-200">S?N SÀNG</span>
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-start mt-1">
                                            <div>
                                                <h4 className="font-bold text-gray-800 text-lg">{court.name}</h4>
                                                <p className="text-xs text-gray-500 mt-0.5">{court.description || 'Sân tiêu chu?n thi ð?u'}</p>
                                            </div>
                                        </div>
                                        <button onClick={() => setBookingCourt(court)} className="w-full bg-[#19b251] hover:bg-green-600 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors mt-1 shadow-sm">
                                            Ch?n gi? & Ð?t sân
                                        </button>
                                    </div>`;

// Since text contains vietnamese characters and we read it with utf8, it should be fine. 
// BUT Wait, PowerShell might corrupt the vietnamese characters when writing this script! 
// Let's use Base64 to be safe.
