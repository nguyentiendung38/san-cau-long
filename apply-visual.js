const fs = require("fs");
let content = fs.readFileSync("apps/frontend/src/pages/PortalPage.tsx", "utf8");

if (!content.includes("PortalBookingVisual")) {
    content = content.replace("import { ChatBotWidget } from '@/components/chatbot/ChatBotWidget';", "import { ChatBotWidget } from '@/components/chatbot/ChatBotWidget';\nimport { PortalBookingVisual } from './PortalBookingVisual';");
}

const regex = /\{bookingCourt && \([\s\S]*?<ChatBotWidget \/>/m;
const replacement = `{bookingCourt && selectedVenue && (
                        <PortalBookingVisual venue={selectedVenue} onClose={() => setBookingCourt(null)} />
                    )}
                    
                    <ChatBotWidget />`;

if(regex.test(content)) {
    content = content.replace(regex, replacement);
    fs.writeFileSync("apps/frontend/src/pages/PortalPage.tsx", content, "utf8");
    console.log("Replaced form with VisualBooking");
} else {
    console.log("Regex failed");
}
