const fs = require("fs");
let content = fs.readFileSync("apps/frontend/src/pages/PortalPage.tsx", "utf8");

const target = "    useEffect(() => {\n        const fetchVenues = async () => {";
const replacement = `    useEffect(() => {
        const handlePhoneUpdate = () => {
            const savedPhone = localStorage.getItem('portalUserPhone');
            if (savedPhone) setUserPhone(savedPhone);
        };
        window.addEventListener('portal-phone-updated', handlePhoneUpdate);
        return () => window.removeEventListener('portal-phone-updated', handlePhoneUpdate);
    }, []);

    useEffect(() => {
        const fetchVenues = async () => {`;

content = content.replace(target, replacement);
fs.writeFileSync("apps/frontend/src/pages/PortalPage.tsx", content, "utf8");
console.log("Added event listener!");
