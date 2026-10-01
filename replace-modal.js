const fs = require("fs");
let content = fs.readFileSync("apps/frontend/src/pages/PortalPage.tsx", "utf8");

const startStr = "            {/* Modal */}\r\n            {selectedVenue && (";
// Alternatively, search using regular expressions carefully or substring
const startIdx = content.indexOf("            {/* Modal */}");
const endIdx = content.lastIndexOf("            <ChatBotWidget />");

if (startIdx !== -1 && endIdx !== -1) {
    const before = content.substring(0, startIdx);
    const after = content.substring(endIdx);
    
    // Check if we need to add imports
    let newBefore = before;
    if (!newBefore.includes("Heart")) {
        newBefore = newBefore.replace("MapPin, Calendar, ", "Heart, MapPin, Calendar, ");
    }
    
    const newModal = `            {/* Modal */}
            {selectedVenue && (
                <div className="fixed inset-0 z-[100] bg-[#f3f4f6] flex flex-col animate-in fade-in slide-in-from-bottom-10 duration-300 overflow-y-auto">
                    
                    {/* Banner */}
                    <div className="relative h-[250px] w-full shrink-0">
                        <img src="/court-a1.jpg" alt="Banner" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/20"></div>
                        
                        {/* Top controls */}
                        <div className="absolute top-4 left-4 right-4 flex justify-between items-start">
                            <button onClick={() => setSelectedVenue(null)} className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-md hover:bg-gray-100 transition-colors">
                                <ChevronLeft className="w-6 h-6 text-gray-700" />
                            </button>
                            
                            <div className="flex items-center gap-2">
                                <button className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-md hover:bg-gray-100 transition-colors">
                                    <svg className="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                                </button>
                                <button className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-md hover:bg-gray-100 transition-colors">
                                    <Heart className="w-5 h-5 text-gray-700" />
                                </button>
                                <button 
                                    onClick={() => setBookingCourt(true as any)}
                                    className="px-6 h-10 bg-[#eab308] hover:bg-yellow-500 text-white font-bold rounded-full shadow-md transition-colors ml-2"
                                >
                                    Ð?t l?ch
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Info Card */}
                    <div className="relative -mt-10 mx-4 bg-white rounded-2xl shadow-sm p-4 flex gap-4 shrink-0 border border-gray-100">
                        <div className="w-16 h-16 rounded-full border border-gray-200 p-2 shrink-0 bg-white shadow-sm flex items-center justify-center">
                            <img src="/court-a1.jpg" className="w-full h-full object-cover rounded-full" />
                        </div>
                        <div className="flex-1">
                            <h2 className="font-bold text-[17px] text-gray-800 uppercase leading-tight mb-1">{selectedVenue.name}</h2>
                            <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border border-[#19b251] text-[#19b251] text-xs font-semibold bg-green-50 mb-3">
                                <MapPin className="w-3 h-3" /> C?u lông
                            </div>
                            
                            <div className="flex flex-col gap-2 text-sm text-gray-600">
                                <div className="flex items-start gap-2">
                                    <MapPin className="w-4 h-4 shrink-0 text-[#19b251] mt-0.5" />
                                    <span>{selectedVenue.address}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Clock className="w-4 h-4 shrink-0 text-[#19b251]" />
                                    <span>{selectedVenue.openTime} - {selectedVenue.closeTime}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <svg className="w-4 h-4 shrink-0 text-[#19b251]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                                    <span className="text-[#19b251] font-medium cursor-pointer">Liên h?</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex overflow-x-auto bg-white border-b border-gray-200 mt-4 px-4 sticky top-0 z-10 scrollbar-hide shrink-0">
                        {['Thông tin', 'Gói h?i viên', 'D?ch v?', 'H?nh ?nh', 'Ði?u kho?n & quy ð?nh', 'Ðánh giá'].map(tab => (
                            <button 
                                key={tab}
                                className={\`whitespace-nowrap px-4 py-3 text-sm font-medium border-b-2 transition-colors \${tab === 'D?ch v?' ? 'border-[#19b251] text-[#19b251]' : 'border-transparent text-gray-500 hover:text-gray-700'}\`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>

                    {/* Content */}
                    <div className="p-4 bg-white flex-1">
                        <h3 className="font-bold text-gray-800 text-[15px] uppercase mb-4 text-[#19b251]">B?NG GIÁ SÂN</h3>
                        
                        <div className="border border-gray-200 rounded-lg overflow-hidden">
                            <div className="bg-white px-4 py-3 border-b border-gray-200 font-bold text-sm text-gray-800 text-center">
                                Sân C?u Lông
                            </div>
                            <table className="w-full text-sm text-center">
                                <thead className="bg-white border-b border-gray-200 text-gray-800 font-bold">
                                    <tr>
                                        <th className="py-3 px-2 border-r border-gray-200 font-bold">Th?</th>
                                        <th className="py-3 px-2 border-r border-gray-200 font-bold">Khung gi?</th>
                                        <th className="py-3 px-2 border-r border-gray-200 font-bold">C? ð?nh</th>
                                        <th className="py-3 px-2 font-bold">V?ng lai</th>
                                    </tr>
                                </thead>
                                <tbody className="text-gray-600 bg-white">
                                    <tr className="border-b border-gray-200">
                                        <td className="py-3 px-2 border-r border-gray-200 font-medium" rowSpan="3">T2 - T6</td>
                                        <td className="py-3 px-2 border-r border-gray-200 border-b border-gray-200">9h - 15h</td>
                                        <td className="py-3 px-2 border-r border-gray-200 border-b border-gray-200">45.000 ð</td>
                                        <td className="py-3 px-2 border-b border-gray-200">50.000 ð</td>
                                    </tr>
                                    <tr className="border-b border-gray-200">
                                        <td className="py-3 px-2 border-r border-gray-200 border-b border-gray-200">17h - 19h</td>
                                        <td className="py-3 px-2 border-r border-gray-200 border-b border-gray-200">90.000 ð</td>
                                        <td className="py-3 px-2 border-b border-gray-200">95.000 ð</td>
                                    </tr>
                                    <tr className="border-b border-gray-200">
                                        <td className="py-3 px-2 border-r border-gray-200">19h - 21h30</td>
                                        <td className="py-3 px-2 border-r border-gray-200">85.000 ð</td>
                                        <td className="py-3 px-2">90.000 ð</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {bookingCourt && selectedVenue && (
                        <PortalBookingVisual venue={selectedVenue} onClose={() => setBookingCourt(null)} />
                    )}
                </div>
            )}
            
`;

    fs.writeFileSync("apps/frontend/src/pages/PortalPage.tsx", newBefore + newModal + after, "utf8");
    console.log("Replaced modal!");
} else {
    console.log("Could not find start or end index.");
}
