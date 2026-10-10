const fs = require('fs');
let code = fs.readFileSync('apps/frontend/src/pages/PortalBookingVisual.tsx', 'utf8');

const regex = /<div className="grid grid-cols-3 gap-3">[\s\S]*?Chuyển khoản<\/span>\s*<\/button>\s*<\/div>/;

const newCode = `<div className="flex flex-wrap gap-2">
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

if (regex.test(code)) {
    code = code.replace(regex, newCode);
    fs.writeFileSync('apps/frontend/src/pages/PortalBookingVisual.tsx', code);
    console.log('Replaced successfully via regex');
} else {
    console.log('Regex did not match');
}
