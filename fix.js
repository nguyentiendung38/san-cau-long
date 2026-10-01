const fs = require("fs");
let content = fs.readFileSync("apps/frontend/src/pages/PortalPage.tsx", "utf8");

content = content.replace(/rowSpan="3"/g, "rowSpan={3}");
content = content.replace(/45\.000 ./g, "45.000 ð");
content = content.replace(/50\.000 ./g, "50.000 ð");
content = content.replace(/90\.000 ./g, "90.000 ð");
content = content.replace(/95\.000 ./g, "95.000 ð");
content = content.replace(/85\.000 ./g, "85.000 ð");

// Fix tabs
content = content.replace(/Th.ng tin/g, "Thông tin");
content = content.replace(/G.i h.i vi.n/g, "Gói h?i viên");
content = content.replace(/D.ch v./g, "D?ch v?");
content = content.replace(/H.nh .nh/g, "H?nh ?nh");
content = content.replace(/.i.u kho.n & quy ..nh/g, "Ði?u kho?n & quy ð?nh");
content = content.replace(/.nh gi./g, "Ðánh giá");
content = content.replace(/C.u l.ng/g, "C?u lông");
content = content.replace(/Li.n h./g, "Liên h?");
content = content.replace(/B.NG GI. S.N/g, "B?NG GIÁ SÂN");

fs.writeFileSync("apps/frontend/src/pages/PortalPage.tsx", content, "utf8");
console.log("Fixed!");
