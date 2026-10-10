const fs = require('fs');
let code = fs.readFileSync('apps/backend/src/services/booking-request.service.ts', 'utf8');

const regex1 = /if \(data\.orderedItems && Array\.isArray\(data\.orderedItems\)\) \{\n\s*const itemsTotal = data\.orderedItems\.reduce\(\(sum: number, item: any\) => sum \+ \(item\.price \* item\.quantity\), 0\);\n\s*paymentAmount \+= itemsTotal;\n\s*\}/;

const replace1 = `
        let parsedOrderedItems = data.orderedItems;
        if (typeof data.orderedItems === 'string') {
            try {
                parsedOrderedItems = JSON.parse(data.orderedItems);
            } catch (e) {
                console.error('Failed to parse orderedItems in create', e);
                parsedOrderedItems = [];
            }
        }

        // Cộng thêm tiền dịch vụ (nếu có)
        if (parsedOrderedItems && Array.isArray(parsedOrderedItems)) {
            const itemsTotal = parsedOrderedItems.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);
            paymentAmount += itemsTotal;
        }`;

code = code.replace(regex1, replace1);

const regex2 = /orderedItems: data\.orderedItems \? JSON\.stringify\(data\.orderedItems\) : null,/;
const replace2 = `orderedItems: parsedOrderedItems && parsedOrderedItems.length > 0 ? JSON.stringify(parsedOrderedItems) : null,`;

code = code.replace(regex2, replace2);

fs.writeFileSync('apps/backend/src/services/booking-request.service.ts', code);
console.log('Fixed orderedItems double stringify issue');
