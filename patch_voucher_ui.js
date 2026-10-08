const fs = require('fs');
let code = fs.readFileSync('apps/frontend/src/components/booking/NewBookingModal.tsx', 'utf8');

const regex = /\{pricing && \([\s\S]*?<span className="font-bold text-primary-500">\s*\{new Intl\.NumberFormat\('vi-VN'\)\.format\(pricing\.total\)\} đ\s*<\/span>\s*<\/div>\s*<\/div>\s*\)\}/m;

const replacement = `{pricing && (
                        <div className="p-4 rounded-lg bg-gradient-to-r from-primary-500/10 to-cyan-500/10 border border-primary-500/30">
                            <div className="flex justify-between items-center">
                                <span className="text-foreground-secondary">Thời lượng:</span>
                                <span className="font-medium text-foreground">{pricing.duration} giờ</span>
                            </div>
                            <div className="flex justify-between items-center mt-2">
                                <span className="text-foreground-secondary">Giá/giờ:</span>
                                <span className="font-medium text-foreground">
                                    {new Intl.NumberFormat('vi-VN').format(pricing.pricePerHour)} đ
                                </span>
                            </div>
                            {pricing.appliedRule && (
                                <div className="flex justify-between items-center mt-2">
                                    <span className="text-foreground-secondary">Áp dụng:</span>
                                    <span className="text-sm text-primary-400">{pricing.appliedRule}</span>
                                </div>
                            )}

                            {/* Voucher Input */}
                            <div className="mt-4 flex gap-2">
                                <input
                                    type="text"
                                    placeholder="Nhập mã giảm giá..."
                                    value={voucherCode}
                                    onChange={(e) => {
                                        setVoucherCode(e.target.value.toUpperCase());
                                        if (voucherValid) {
                                            setVoucherValid(false);
                                            setDiscountAmount(0);
                                            setVoucherMessage('');
                                        }
                                    }}
                                    className="flex-1 bg-background border border-border rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:border-primary-500 uppercase"
                                />
                                <Button 
                                    type="button"
                                    size="sm"
                                    onClick={handleApplyVoucher}
                                    disabled={!voucherCode || isApplyingVoucher}
                                >
                                    {isApplyingVoucher ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Áp dụng'}
                                </Button>
                            </div>
                            {voucherMessage && (
                                <p className={\`text-xs mt-1 \${voucherValid ? 'text-green-500' : 'text-red-500'}\`}>
                                    {voucherMessage}
                                </p>
                            )}

                            {voucherValid && discountAmount > 0 && (
                                <div className="flex justify-between items-center mt-2 text-green-500">
                                    <span>Giảm giá:</span>
                                    <span>-{new Intl.NumberFormat('vi-VN').format(discountAmount)} đ</span>
                                </div>
                            )}

                            <div className="flex justify-between items-center mt-3 pt-3 border-t border-border">
                                <span className="font-semibold text-foreground">Tổng cộng:</span>
                                <span className="font-bold text-primary-500">
                                    {new Intl.NumberFormat('vi-VN').format(Math.max(0, pricing.total - discountAmount))} đ
                                </span>
                            </div>
                        </div>
                    )}`;

code = code.replace(regex, replacement);
fs.writeFileSync('apps/frontend/src/components/booking/NewBookingModal.tsx', code);
