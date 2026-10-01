const fs = require("fs");
const lines = fs.readFileSync("apps/frontend/src/pages/PortalPage.tsx", "utf8").split("\n");
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("favToast.isAdd")) {
        lines.splice(i - 4, 1);
        fs.writeFileSync("apps/frontend/src/pages/PortalPage.tsx", lines.join("\n"), "utf8");
        console.log("Fixed");
        break;
    }
}
