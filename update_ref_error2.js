const fs = require('fs');
let code = fs.readFileSync('apps/backend/src/services/booking-request.service.ts', 'utf8');

const lines = code.split('\\n');
const idx = lines.findIndex(l => l.includes('let paymentAmount = pricing.total;'));

if (idx !== -1) {
    const endIdx = lines.findIndex((l, i) => i > idx && l.includes('prisma.bookingRequest.create({'));
    
    if (endIdx !== -1) {
        lines.splice(idx, endIdx - idx,
            "        let paymentAmount = pricing.total;",
            "",
            "        let parsedOrderedItems = data.orderedItems;",
            "        if (typeof data.orderedItems === 'string') {",
            "            try {",
            "                parsedOrderedItems = JSON.parse(data.orderedItems);",
            "            } catch (e) {",
            "                console.error('Failed to parse orderedItems in create', e);",
            "                parsedOrderedItems = [];",
            "            }",
            "        }",
            "",
            "        // Cộng thêm tiền dịch vụ (nếu có)",
            "        if (parsedOrderedItems && Array.isArray(parsedOrderedItems)) {",
            "            const itemsTotal = parsedOrderedItems.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);",
            "            paymentAmount += itemsTotal;",
            "        }",
            ""
        );
        fs.writeFileSync('apps/backend/src/services/booking-request.service.ts', lines.join('\\n'));
        console.log('Fixed ReferenceError');
    } else {
        console.log('endIdx not found', lines.slice(idx, idx + 20));
    }
} else {
    console.log('idx not found');
}
