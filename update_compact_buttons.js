const fs = require('fs');
let code = fs.readFileSync('apps/frontend/src/pages/PortalBookingVisual.tsx', 'utf8');

const oldCode = `<div className="grid grid-cols-3 gap-3">
                                        
                                        
                                        <button
                                            type="button"
                                            onClick={() => setPaymentMethod('VNPAY')}
                                            className={cn(
                                                "py-3 flex items-center justify-center gap-1 rounded-xl border-2 transition-all",
                                                paymentMethod === 'VNPAY' ? "border-blue-500 bg-blue-50/50 text-blue-700" : "border-gray-100 bg-white text-gray-500 hover:border-blue-200"
                                            )}
                                        >
                                            <span className="text-xl">💳</span>
                                            <span className="text-sm font-bold">VNPAY</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setPaymentMethod('DEPOSIT_TRANSFER')}
                                            className={cn(
                                                "py-3 flex items-center justify-center gap-2 rounded-xl border-2 transition-all",
                                                paymentMethod === 'DEPOSIT_TRANSFER' ? "border-green-500 bg-green-50/50 text-green-700" : "border-gray-100 bg-white text-gray-500 hover:border-green-200"
                                            )}
                                        >
                                            <span className="text-xl">🏦</span>
                                            <span className="text-sm font-bold">Chuyển khoản</span>
                                        </button>
                                    </div>`;

const newCode = `<div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setPaymentMethod('VNPAY')}
                                            className={cn(
                                                "py-2 px-4 flex items-center gap-1.5 rounded-lg border transition-all",
                                                paymentMethod === 'VNPAY' ? "border-blue-500 bg-blue-50 text-blue-700 font-bold" : "border-gray-200 bg-white text-gray-600 font-medium hover:border-blue-200"
                                            )}
                                        >
                                            <span className="text-lg">💳</span>
                                            <span className="text-sm">VNPAY</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setPaymentMethod('DEPOSIT_TRANSFER')}
                                            className={cn(
                                                "py-2 px-4 flex items-center gap-1.5 rounded-lg border transition-all",
                                                paymentMethod === 'DEPOSIT_TRANSFER' ? "border-green-500 bg-green-50 text-green-700 font-bold" : "border-gray-200 bg-white text-gray-600 font-medium hover:border-green-200"
                                            )}
                                        >
                                            <span className="text-lg">🏦</span>
                                            <span className="text-sm">Chuyển khoản</span>
                                        </button>
                                    </div>`;

// Use simple replacement since whitespace might vary slightly
const index = code.indexOf('<div className="grid grid-cols-3 gap-3">');
if (index !== -1) {
    const endStr = '</button>\\n                                    </div>';
    const endIndex = code.indexOf(endStr, index);
    if (endIndex !== -1) {
        code = code.substring(0, index) + newCode + code.substring(endIndex + endStr.length);
        code = code.replace('\\\\n', '\\n'); // cleanup just in case
        fs.writeFileSync('apps/frontend/src/pages/PortalBookingVisual.tsx', code);
        console.log('Replaced successfully');
    } else {
        console.log('End index not found');
    }
} else {
    console.log('Start index not found');
}
