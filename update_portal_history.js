const fs = require('fs');
let code = fs.readFileSync('apps/frontend/src/pages/PortalPage.tsx', 'utf8');

code = code.replace(
    'queryFn: () => bookingRequestApi.getMyRequests(userPhone),',
    'queryFn: () => bookingRequestApi.getMyRequests(userPhone).then(data => data.filter((b: any) => !b.notes?.includes("Zalo"))),'
);

fs.writeFileSync('apps/frontend/src/pages/PortalPage.tsx', code);
console.log('Fixed Web Portal history filter');
