const fs = require("fs");
let content = fs.readFileSync("apps/frontend/src/pages/PortalPage.tsx", "utf8");

// 1. Add viewingVenueDetail state
const stateInsertIdx = content.indexOf("const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);");
if (!content.includes("viewingVenueDetail")) {
    content = content.substring(0, stateInsertIdx) + "const [viewingVenueDetail, setViewingVenueDetail] = useState<Venue | null>(null);\n    " + content.substring(stateInsertIdx);
}

// 2. Change image onClick in Home tab
const homeTabRegex = /onClick=\{\(\) => setSelectedVenue\(venue\)\}\s*className="relative h-\[200px\] overflow-hidden cursor-pointer"/g;
content = content.replace(homeTabRegex, 'onClick={() => setViewingVenueDetail(venue)} className="relative h-[200px] overflow-hidden cursor-pointer"');

// 3. Rename current Modal to Detail Modal
// In the Detail modal, selectedVenue is used. We need to change it to viewingVenueDetail.
const modalStartIdx = content.indexOf("{/* Modal */}");
const modalEndIdx = content.indexOf("<ChatBotWidget />");
let modalBlock = content.substring(modalStartIdx, modalEndIdx);

// We change the Detail modal to use viewingVenueDetail instead of selectedVenue
modalBlock = modalBlock.replace(/selectedVenue && \(/, "viewingVenueDetail && (");
modalBlock = modalBlock.replace(/setSelectedVenue\(null\)/g, "setViewingVenueDetail(null)");
modalBlock = modalBlock.replace(/selectedVenue\./g, "viewingVenueDetail.");
// And the "Ð?t l?ch" button inside the Detail modal should open the Booking modal
modalBlock = modalBlock.replace(/onClick=\{\(\) => setBookingCourt\(true as any\)\}/, "onClick={() => { setSelectedVenue(viewingVenueDetail); setViewingVenueDetail(null); }}");
// Also remove the VisualBooking component from inside the Detail modal
modalBlock = modalBlock.replace(/\{bookingCourt && viewingVenueDetail && \([\s\S]*?<\/[dD]iv>\s*\)\}/, "</div>\n            )}"); // be careful, it might just be the component

// Wait, the VisualBooking component was:
const visualBookingMatch = /\{bookingCourt && viewingVenueDetail && \([\s\S]*?\}\)/;
modalBlock = modalBlock.replace(visualBookingMatch, "");

const oldBookingModal = `
            {/* Booking Modal (Old List of Courts) */}
            {selectedVenue && (
                <div className="fixed inset-0 z-[100] bg-white flex flex-col animate-in fade-in slide-in-from-bottom-10 duration-300">
                    <div className="flex items-center gap-4 p-4 border-b border-gray-100 bg-white shadow-sm">
                        <button onClick={() => setSelectedVenue(null)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors">
                            <X className="w-6 h-6 text-gray-600" />
                        </button>
                        <div>
                            <h2 className="font-bold text-lg text-gray-800 leading-tight">{selectedVenue.name}</h2>
                            <p className="text-sm text-gray-500">{selectedVenue.address}</p>
                        </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
                        <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <MapPin className="w-5 h-5 text-[#19b251]" />
                            Danh sách sân tr?ng
                        </h3>
                        
                        {loadingCourts ? (
                            <div className="flex justify-center p-10"><div className="w-8 h-8 border-4 border-[#19b251] border-t-transparent rounded-full animate-spin"></div></div>
                        ) : venueCourts.length === 0 ? (
                            <div className="text-center p-10 bg-white rounded-xl shadow-sm border border-gray-100">
                                <p className="text-gray-500">Chýa có d? li?u sân.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {venueCourts.map(court => (
                                    <div key={court.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex flex-col gap-3 hover:shadow-md transition-shadow overflow-hidden">
                                        <div className="-mt-4 -mx-4 mb-0 h-40 sm:h-36 bg-gray-100 relative">
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
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    
                    {bookingCourt && selectedVenue && (
                        <PortalBookingVisual venue={selectedVenue} onClose={() => setBookingCourt(null)} />
                    )}
                </div>
            )}
`;

content = content.substring(0, modalStartIdx) + modalBlock + "\n" + oldBookingModal + "\n" + content.substring(modalEndIdx);

fs.writeFileSync("apps/frontend/src/pages/PortalPage.tsx", content, "utf8");
console.log("Restored!");
