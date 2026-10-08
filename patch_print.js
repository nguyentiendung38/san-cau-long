const fs = require('fs');
let code = fs.readFileSync('apps/frontend/src/pages/PrintInvoicePage.tsx', 'utf8');

const replacement = `{(invoice.depositAmount > 0 || invoice.paidAmount > 0) && (
                                <>
                                    {invoice.depositAmount > 0 && (
                                        <div className="flex justify-between py-2 text-sm">
                                            <span className="text-gray-600">Khách đã cọc:</span>
                                            <span className="text-green-600">-{formatCurrency(invoice.depositAmount)}</span>
                                        </div>
                                    )}
                                    {invoice.paidAmount > 0 && (
                                        <div className="flex justify-between py-2 text-sm">
                                            <span className="text-gray-600">Đã thanh toán:</span>
                                            <span className="text-green-600">{formatCurrency(invoice.paidAmount)}</span>
                                        </div>
                                    )}
                                    {invoice.paymentStatus !== 'PAID' && (
                                        <div className="flex justify-between py-2 text-sm font-bold">
                                            <span className="text-gray-800">Còn cần thu thêm:</span>
                                            <span className="text-red-600">{formatCurrency(Math.max(0, invoice.total - (invoice.depositAmount || 0) - (invoice.paidAmount || 0)))}</span>
                                        </div>
                                    )}
                                </>
                            )}`;

const regex = /\{invoice\.paidAmount > 0 && invoice\.paidAmount < invoice\.total && \([\s\S]*?<\/>\s*\)\}/m;
code = code.replace(regex, replacement);

fs.writeFileSync('apps/frontend/src/pages/PrintInvoicePage.tsx', code);
