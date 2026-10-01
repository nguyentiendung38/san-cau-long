const fs = require("fs");
let content = fs.readFileSync("apps/frontend/src/pages/PortalPage.tsx", "utf8");

const replacement = `{bookingCourt && selectedVenue && (
                        <PortalBookingVisual venue={selectedVenue} onClose={() => setBookingCourt(null)} />
                    )}
                </div>
            )}
            
            <ChatBotWidget />`;

content = content.replace(/\{bookingCourt && selectedVenue && \([\s\S]*?<ChatBotWidget \/>/m, replacement);
fs.writeFileSync("apps/frontend/src/pages/PortalPage.tsx", content, "utf8");
console.log("Fixed syntax");
