const fs = require('fs');
let code = fs.readFileSync('apps/frontend/src/components/booking/NewBookingModal.tsx', 'utf8');

code = code.replace(/import \{ bookingApi, CreateBookingInput, PricingResult \} from '@\/services\/booking\.service';/, 
    "import { bookingApi, CreateBookingInput, PricingResult } from '@/services/booking.service';\nimport { voucherApi } from '@/services/voucher.service';");

code = code.replace(/const \[loadingAvailability, setLoadingAvailability\] = useState\(false\);/, 
    `const [loadingAvailability, setLoadingAvailability] = useState(false);
    const [voucherCode, setVoucherCode] = useState('');
    const [voucherValid, setVoucherValid] = useState(false);
    const [voucherMessage, setVoucherMessage] = useState('');
    const [discountAmount, setDiscountAmount] = useState(0);
    const [isApplyingVoucher, setIsApplyingVoucher] = useState(false);

    const handleApplyVoucher = async () => {
        if (!voucherCode.trim() || !pricing) return;
        setIsApplyingVoucher(true);
        setVoucherMessage('');
        try {
            const res = await voucherApi.validate(voucherCode.trim(), pricing.total);
            if (res.valid) {
                setVoucherValid(true);
                setDiscountAmount(res.discountAmount);
                setVoucherMessage(\`Áp dụng thành công, giảm \${res.discountAmount.toLocaleString()}đ\`);
            } else {
                setVoucherValid(false);
                setDiscountAmount(0);
                setVoucherMessage('Mã không hợp lệ hoặc đã hết hạn');
            }
        } catch (e: any) {
            setVoucherValid(false);
            setDiscountAmount(0);
            setVoucherMessage(e.response?.data?.message || 'Lỗi kiểm tra mã giảm giá');
        } finally {
            setIsApplyingVoucher(false);
        }
    };
`);

// Also need to reset voucher on close
code = code.replace(/setErrors\(\{\}\);/g, `setErrors({});
            setVoucherCode('');
            setVoucherValid(false);
            setVoucherMessage('');
            setDiscountAmount(0);`);

// And add payload
code = code.replace(/notes: formData\.notes,/, `notes: formData.notes,
            voucherCode: voucherValid ? voucherCode : undefined,
            discountAmount: voucherValid ? discountAmount : undefined,`);

// And add UI
const uiRegex = /\{pricing && \([\s\S]*?<div className="flex justify-between items-center text-lg font-bold mt-4 pt-4 border-t border-primary-500\/30">\s*<span className="text-foreground">Tổng cộng:<\/span>\s*<span className="text-primary-500">\{formatCurrency\(pricing\.total\)\}<\/span>\s*<\/div>\s*<\/div>\s*\)\}/m;

const newUI = `{pricing && (
                        <div className="p-4 rounded-lg bg-gradient-to-r from-primary-500/10 to-cyan-500/10 border border-primary-500/30">
                            <div className="flex justify-between items-center">
                                <span className="text-foreground-secondary">Thời lượng:</span>
                                <span className="font-medium text-foreground">{pricing.duration} giờ</span>
                            </div>
                            <div className="flex justify-between items-center mt-2">
                                <span className="text-foreground-secondary">Giá/giờ:</span>
                                <span className="font-medium text-foreground">{formatCurrency(pricing.pricePerHour)}</span>
                            </div>
                            <div className="flex justify-between items-center mt-2 text-sm text-primary-400">
                                <span>Khung giá áp dụng:</span>
                                <span>{pricing.appliedRule}</span>
                            </div>

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
                                    <span>-{formatCurrency(discountAmount)}</span>
                                </div>
                            )}

                            <div className="flex justify-between items-center text-lg font-bold mt-4 pt-4 border-t border-primary-500/30">
                                <span className="text-foreground">Tổng cộng:</span>
                                <span className="text-primary-500">{formatCurrency(Math.max(0, pricing.total - discountAmount))}</span>
                            </div>
                        </div>
                    )}`;

code = code.replace(uiRegex, newUI);

fs.writeFileSync('apps/frontend/src/components/booking/NewBookingModal.tsx', code);
