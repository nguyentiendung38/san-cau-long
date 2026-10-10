const fs = require('fs');
let code = fs.readFileSync('apps/backend/src/services/booking-request.service.ts', 'utf8');

const targetStr = "let paymentAmount = pricing.total;";
const replaceStr = `        let parsedOrderedItems = data.orderedItems;
        if (typeof data.orderedItems === 'string') {
            try {
                parsedOrderedItems = JSON.parse(data.orderedItems);
            } catch (e) {
                console.error('Failed to parse orderedItems in create', e);
                parsedOrderedItems = [];
            }
        }

        let paymentAmount = pricing.total;`;

if (code.includes(targetStr) && !code.includes('let parsedOrderedItems')) {
    code = code.replace(targetStr, replaceStr);
    
    // Fix the array check
    code = code.replace(
        "if (data.orderedItems && Array.isArray(data.orderedItems))",
        "if (parsedOrderedItems && Array.isArray(parsedOrderedItems))"
    );
    
    code = code.replace(
        "const itemsTotal = data.orderedItems.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);",
        "const itemsTotal = parsedOrderedItems.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);"
    );
    
    fs.writeFileSync('apps/backend/src/services/booking-request.service.ts', code);
    console.log('Fixed reference error robustly');
} else {
    console.log('Target string not found or already fixed');
}
