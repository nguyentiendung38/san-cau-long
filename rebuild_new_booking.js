const fs = require('fs');
let code = fs.readFileSync('apps/frontend/src/components/booking/NewBookingModal.tsx', 'utf8');

// 1. Timezone Fix
code = code.replace(/([a-zA-Z0-9_\(\)\.?]+)\.toISOString\(\)\.split\('T'\)\[0\]/g, (match, p1) => {
    return `\`\${${p1}.getFullYear()}-\${String(${p1}.getMonth()+1).padStart(2, '0')}-\${String(${p1}.getDate()).padStart(2, '0')}\``;
});
code = code.replace(/new\s+`\$\{Date\(\)\.getFullYear\(\)\}-\$\{String\(Date\(\)\.getMonth\(\)\+1\)\.padStart\(2, '0'\)\}-\$\{String\(Date\(\)\.getDate\(\)\)\.padStart\(2, '0'\)\}`/g, 
    "`${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`");

// 2. Validation Fix
const valRegex = /if \(availability && !availability\.available\) \{\s*newErrors\.availability = 'Khung giờ này đã có người đặt';\s*\}/m;
const valRep = `if (availability && !availability.available) {
            newErrors.availability = 'Khung giờ này đã có người đặt';
        }

        if (pricing && pricing.total === 0 && pricing.appliedRule === 'Chưa thiết lập giá') {
            newErrors.availability = 'Khung giờ này ngoài giờ hoạt động (chưa thiết lập giá)';
        }`;
code = code.replace(valRegex, valRep);

// 3. UI Check Availability Class
const classRegex = /className=\{cn\(\s*'flex items-center gap-3 p-3 rounded-lg border',\s*!availability\?.available \?\s*'border-red-500\/30 bg-red-500\/10'\s*:\s*'border-green-500\/30 bg-green-500\/10'\s*\)\}/m;
const classRep = `className={cn(
                                'flex items-center gap-3 p-3 rounded-lg border',
                                (!availability?.available || (pricing && pricing.total === 0 && pricing.appliedRule === 'Chưa thiết lập giá'))
                                    ? 'border-red-500/30 bg-red-500/10' 
                                    : 'border-green-500/30 bg-green-500/10'
                            )}`;
code = code.replace(classRegex, classRep);

// 4. UI Check Availability Message
const msgRegex = /\) : availability\?\.available \? \([\s\S]*?<Check className="w-5 h-5 text-green-500" \/>\s*<span className="text-green-400 text-sm">Khung giờ trống, có thể đặt<\/span>\s*<\/>\s*\) : \(/m;
const msgRep = `) : pricing && pricing.total === 0 && pricing.appliedRule === 'Chưa thiết lập giá' ? (
                                <>
                                    <AlertCircle className="w-5 h-5 text-red-500" />
                                    <span className="text-red-400 text-sm">Ngoài giờ hoạt động (chưa thiết lập giá)</span>
                                </>
                            ) : availability?.available ? (
                                <>
                                    <Check className="w-5 h-5 text-green-500" />
                                    <span className="text-green-400 text-sm">Khung giờ trống, có thể đặt</span>
                                </>
                            ) : (`;
code = code.replace(msgRegex, msgRep);

// 5. Voucher Logic
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
                setVoucherMessage(\`Áp dụng thành công, giảm \${new Intl.NumberFormat('vi-VN').format(res.discountAmount)}đ\`);
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

code = code.replace(/setErrors\(\{\}\);/g, `setErrors({});
            setVoucherCode('');
            setVoucherValid(false);
            setVoucherMessage('');
            setDiscountAmount(0);`);

code = code.replace(/notes: formData\.notes,/, `notes: formData.notes,
            voucherCode: voucherValid ? voucherCode : undefined,
            discountAmount: voucherValid ? discountAmount : undefined,`);

// 6. Voucher UI
const uiRegex = /\{pricing && \([\s\S]*?<span className="text-xl font-bold text-primary-400">\s*\{new Intl\.NumberFormat\('vi-VN'\)\.format\(pricing\.total\)\} đ\s*<\/span>\s*<\/div>\s*<\/div>\s*\)\}/m;
const uiRep = `{pricing && (
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
                                <span className="text-xl font-bold text-primary-400">
                                    {new Intl.NumberFormat('vi-VN').format(Math.max(0, pricing.total - discountAmount))} đ
                                </span>
                            </div>
                        </div>
                    )}`;
code = code.replace(uiRegex, uiRep);

// 7. Input Time Fixes
const timeStartRegex = /<select\s*value=\{formData\.startTime\}[\s\S]*?<\/select>/m;
const timeStartRep = `<input
                                type="time"
                                value={formData.startTime}
                                onChange={(e) => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
                                className={cn(
                                    "w-full bg-background-tertiary border rounded-lg px-3 py-2 text-foreground",
                                    "focus:outline-none focus:ring-2 focus:ring-primary-500",
                                    errors.startTime ? 'border-red-500' : 'border-border'
                                )}
                            />`;
code = code.replace(timeStartRegex, timeStartRep);

const timeEndRegex = /<select\s*value=\{formData\.endTime\}[\s\S]*?<\/select>/m;
const timeEndRep = `<input
                                type="time"
                                value={formData.endTime}
                                onChange={(e) => setFormData(prev => ({ ...prev, endTime: e.target.value }))}
                                className={cn(
                                    "w-full bg-background-tertiary border rounded-lg px-3 py-2 text-foreground",
                                    "focus:outline-none focus:ring-2 focus:ring-primary-500",
                                    errors.endTime ? 'border-red-500' : 'border-border'
                                )}
                            />`;
code = code.replace(timeEndRegex, timeEndRep);

fs.writeFileSync('apps/frontend/src/components/booking/NewBookingModal.tsx', code);
