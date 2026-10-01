const fs = require("fs");
let content = fs.readFileSync("apps/frontend/src/pages/PortalBookingVisual.tsx", "utf8");

const dateLogicStr = `    const now = new Date();
    const todayString = \`\${now.getFullYear()}-\${String(now.getMonth() + 1).padStart(2, '0')}-\${String(now.getDate()).padStart(2, '0')}\`;
    const currentTimeString = \`\${String(now.getHours()).padStart(2, '0')}:\${String(now.getMinutes()).padStart(2, '0')}\`;`;

const maxDateLogic = `    const now = new Date();
    const todayString = \`\${now.getFullYear()}-\${String(now.getMonth() + 1).padStart(2, '0')}-\${String(now.getDate()).padStart(2, '0')}\`;
    const currentTimeString = \`\${String(now.getHours()).padStart(2, '0')}:\${String(now.getMinutes()).padStart(2, '0')}\`;
    const maxDate = new Date(now.getFullYear(), now.getMonth() + 2, 0);
    const maxDateString = \`\${maxDate.getFullYear()}-\${String(maxDate.getMonth() + 1).padStart(2, '0')}-\${String(maxDate.getDate()).padStart(2, '0')}\`;`;

content = content.replace(dateLogicStr, maxDateLogic);

const inputStr = `                          min={todayString}
                          value={selectedDate}`;

const newInputStr = `                          min={todayString}
                          max={maxDateString}
                          value={selectedDate}`;

content = content.replace(inputStr, newInputStr);

fs.writeFileSync("apps/frontend/src/pages/PortalBookingVisual.tsx", content, "utf8");
console.log("Max date logic added");
