const fs = require('fs');
let code = fs.readFileSync('apps/frontend/src/components/booking/BookingDetailPanel.tsx', 'utf8');

const oldCode = `                                    {(booking.paymentAmount || 0) > 0 && booking.invoiceItem?.invoice?.paymentStatus !== 'PAID' && (
                                        <div className="mt-2 pt-2 border-t border-border/50 text-sm">
                                            <div className="flex items-center justify-between text-green-600 font-medium">
                                                <span>Đã cọc (Khách chuyển khoản):</span>
                                                <span>- {formatCurrency(booking.paymentAmount!)}</span>
                                            </div>
                                            <div className="flex items-center justify-between text-error font-bold mt-1">
                                                <span>Cần thu thêm:</span>
                                                <span className="text-base">{formatCurrency(Math.max(0, booking.totalAmount - booking.paymentAmount!))}</span>
                                            </div>
                                        </div>
                                    )}`;

const newCode = `                                    {(booking.paymentAmount || 0) > 0 && booking.invoiceItem?.invoice?.paymentStatus !== 'PAID' && (
                                        <div className="mt-2 pt-2 border-t border-border/50 text-sm">
                                            <div className="flex items-center justify-between text-green-600 font-medium">
                                                <span>{booking.paymentMethod === 'VNPAY' ? 'Đã thanh toán (VNPAY):' : 'Đã cọc (Khách chuyển khoản):'}</span>
                                                <span>- {formatCurrency(booking.paymentAmount!)}</span>
                                            </div>
                                            {Math.max(0, booking.totalAmount - booking.paymentAmount!) > 0 && (
                                                <div className="flex items-center justify-between text-error font-bold mt-1">
                                                    <span>Cần thu thêm:</span>
                                                    <span className="text-base">{formatCurrency(Math.max(0, booking.totalAmount - booking.paymentAmount!))}</span>
                                                </div>
                                            )}
                                        </div>
                                    )}`;

code = code.replace(oldCode, newCode);
fs.writeFileSync('apps/frontend/src/components/booking/BookingDetailPanel.tsx', code);
