const fs = require("fs");
let content = fs.readFileSync("apps/frontend/src/pages/PortalPage.tsx", "utf8");
const lines = content.split("\n");
const b64 = "ICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT0iZmxleC0xIj4KICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9ImZvbnQtbWVkaXVtIHRleHQtZ3JheS04MDAiPlRow7RuZyBiw6FvPC9kaXY+CiAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPSJ0ZXh0LWdyYXktNTAwIHRleHQtc20gbXQtMC41Ij4KICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtmYXZUb2FzdC5pc0FkZCA/ICfEkMOjIHRow6ptIHbDoG8gZGFuaCBzw6FjaCB5w6p1IHRow61jaCcgOiAnxJDDoyB4w7NhIGto4buPaSBkYW5oIHPDoWNoIHnDqnUgdGjDrWNoJ30KICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+CiAgICAgICAgICAgICAgICAgICAgPC9kaXY+";
const replacement = Buffer.from(b64, "base64").toString("utf8");
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("favToast.isAdd")) {
        lines.splice(i - 2, 5, replacement);
        fs.writeFileSync("apps/frontend/src/pages/PortalPage.tsx", lines.join("\n"), "utf8");
        console.log("Success");
        break;
    }
}
