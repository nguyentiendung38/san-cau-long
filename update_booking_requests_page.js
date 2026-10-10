const fs = require('fs');
let code = fs.readFileSync('apps/frontend/src/pages/BookingRequestsPage.tsx', 'utf8');

const regex = /const items = JSON\.parse\(req\.orderedItems\);\n\s*return items\.map\(\(i: any\) => \`\$\{i\.quantity\} x \$\{i\.name\}\`\)\.join\(', '\);/;

const replacement = `let items = JSON.parse(req.orderedItems);
                                                        if (typeof items === 'string') {
                                                            items = JSON.parse(items);
                                                        }
                                                        if (Array.isArray(items)) {
                                                            return items.map((i: any) => \`\${i.quantity} x \${i.name}\`).join(', ');
                                                        }
                                                        return req.orderedItems;`;

code = code.replace(regex, replacement);

fs.writeFileSync('apps/frontend/src/pages/BookingRequestsPage.tsx', code);
console.log('Fixed BookingRequestsPage orderedItems display');
