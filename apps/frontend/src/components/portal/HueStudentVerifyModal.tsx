import React, { useState, useEffect } from 'react';
import { X, Mail, ArrowLeft, Loader2, RefreshCw, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { portalAuthApi } from '@/services/portal-auth.service';
import { useToast } from '@/hooks/use-toast';

interface HueStudentVerifyModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (updatedProfile?: any) => void;
}

export function HueStudentVerifyModal({ isOpen, onClose, onSuccess }: HueStudentVerifyModalProps) {
    const { toast } = useToast();

    const [step, setStep] = useState<1 | 2>(1);
    const [studentId, setStudentId] = useState('');
    const [email, setEmail] = useState('');
    const [faculty, setFaculty] = useState('Khoa Hệ thống thông tin kinh tế');
    const [emailModifiedByUser, setEmailModifiedByUser] = useState(false);

    // Step 2: OTP State
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [countdown, setCountdown] = useState(60);
    const [canResend, setCanResend] = useState(false);
    const [devOtpHint, setDevOtpHint] = useState<string | null>(null);

    const [isLoading, setIsLoading] = useState(false);

    // Reset when modal opens/closes
    useEffect(() => {
        if (isOpen) {
            setStep(1);
            setOtp(['', '', '', '', '', '']);
            setCountdown(60);
            setCanResend(false);
            setDevOtpHint(null);
        }
    }, [isOpen]);

    // Timer countdown
    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (step === 2 && countdown > 0) {
            timer = setInterval(() => setCountdown(c => c - 1), 1000);
        } else if (countdown === 0) {
            setCanResend(true);
        }
        return () => clearInterval(timer);
    }, [step, countdown]);

    if (!isOpen) return null;

    // Handle student ID change -> auto suggest email if not customized
    const handleStudentIdChange = (val: string) => {
        const clean = val.toUpperCase().replace(/\s+/g, '');
        setStudentId(clean);
        if (!emailModifiedByUser) {
            if (clean) {
                setEmail(`${clean.toLowerCase()}@hce.edu.vn`);
            } else {
                setEmail('');
            }
        }
    };

    // Step 1: Request OTP
    const handleRequestOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        const cleanStudentId = studentId.trim();
        const cleanEmail = email.trim().toLowerCase();

        if (!cleanStudentId) {
            toast({ title: 'Thiếu thông tin', description: 'Vui lòng nhập Mã số sinh viên (MSSV)', variant: 'error' });
            return;
        }

        const mssvRegex = /^[0-9]{2}[A-Z][0-9]{5,8}$/;
        if (!mssvRegex.test(cleanStudentId)) {
            toast({
                title: 'Định dạng MSSV không hợp lệ',
                description: 'Định dạng chuẩn HCE gồm 2 số khóa + K + số thứ tự (Ví dụ: 21K4080123)',
                variant: 'error',
            });
            return;
        }

        if (!cleanEmail.endsWith('@hce.edu.vn')) {
            toast({
                title: 'Email sinh viên không hợp lệ',
                description: 'Vui lòng sử dụng hòm thư do trường cấp với đuôi @hce.edu.vn (Ví dụ: ' + cleanStudentId.toLowerCase() + '@hce.edu.vn)',
                variant: 'error',
            });
            return;
        }

        setIsLoading(true);
        try {
            const res = await portalAuthApi.requestHueOtp({
                studentId: cleanStudentId,
                email: cleanEmail,
                faculty,
            });

            if (res.devOtp) {
                setDevOtpHint(res.devOtp);
            }

            toast({
                title: 'Đã gửi mã OTP!',
                description: res.message || `Mã xác thực đã được gửi về ${cleanEmail}`,
                variant: 'success',
            });

            setStep(2);
            setCountdown(60);
            setCanResend(false);
            setOtp(['', '', '', '', '', '']);
        } catch (err: any) {
            toast({
                title: 'Không thể gửi mã OTP',
                description: err?.response?.data?.message || 'Có lỗi xảy ra, vui lòng kiểm tra lại thông tin',
                variant: 'error',
            });
        } finally {
            setIsLoading(false);
        }
    };

    // OTP Input logic
    const handleOtpChange = (index: number, val: string) => {
        const char = val.replace(/\D/g, '').slice(-1);
        const newOtp = [...otp];
        newOtp[index] = char;
        setOtp(newOtp);

        // Auto move next
        if (char && index < 5) {
            const nextInput = document.getElementById(`hue-otp-${index + 1}`);
            nextInput?.focus();
        }
    };

    const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace' && !otp[index] && index > 0) {
            const prevInput = document.getElementById(`hue-otp-${index - 1}`);
            prevInput?.focus();
        }
    };

    const handleOtpPaste = (e: React.ClipboardEvent) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        if (pasted) {
            const newOtp = [...otp];
            for (let i = 0; i < 6; i++) {
                newOtp[i] = pasted[i] || '';
            }
            setOtp(newOtp);
            const targetIdx = Math.min(pasted.length, 5);
            document.getElementById(`hue-otp-${targetIdx}`)?.focus();
        }
    };

    // Step 2: Verify OTP
    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        const otpCode = otp.join('').trim();
        if (otpCode.length < 6) {
            toast({ title: 'Thiếu mã OTP', description: 'Vui lòng nhập đủ 6 chữ số mã OTP', variant: 'error' });
            return;
        }

        setIsLoading(true);
        try {
            const res = await portalAuthApi.verifyHueOtp({
                studentId: studentId.trim(),
                email: email.trim().toLowerCase(),
                faculty,
                otp: otpCode,
                customerType: 'STUDENT',
            });

            toast({
                title: 'Xác thực thành công!',
                description: 'Xác thực Sinh viên HUE thành công! Ưu đãi -20% tiền sân đã được kích hoạt.',
                variant: 'success',
            });

            onSuccess(res.data);
            onClose();
        } catch (err: any) {
            toast({
                title: 'Xác thực thất bại',
                description: err?.response?.data?.message || 'Mã OTP không đúng hoặc đã hết hạn',
                variant: 'error',
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm animate-in fade-in">
            <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-gray-100 relative">
                {/* Header */}
                <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                    <div className="flex items-center gap-2.5">
                        <img src="/logo-hue.jpg" alt="Logo HUE" className="w-10 h-10 rounded-full object-contain bg-white p-0.5 border border-emerald-100 shadow-xs" />
                        <div>
                            <h3 className="font-black text-base text-gray-900 leading-tight">Xác thực Sinh viên HUE</h3>
                            <p className="text-xs text-emerald-700 font-semibold">Trường Đại học Kinh tế, Đại học Huế</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Step 1: Input MSSV & Email */}
                {step === 1 && (
                    <form onSubmit={handleRequestOtp} className="mt-4 space-y-3.5">
                        <div className="rounded-2xl bg-emerald-50/70 p-3 text-xs leading-5 text-emerald-900 border border-emerald-100/80 flex items-start gap-2.5">
                            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                            <div>
                                Nhập <strong>MSSV</strong> và <strong>Email trường (@hce.edu.vn)</strong> để nhận mã OTP xác nhận chính chủ và kích hoạt <strong>ưu đãi giảm 20%</strong> tiền sân.
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Mã số sinh viên (MSSV) *</label>
                            <input
                                type="text"
                                required
                                placeholder="Ví dụ: 21K4080123"
                                value={studentId}
                                onChange={(e) => handleStudentIdChange(e.target.value)}
                                className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm font-semibold text-gray-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                            />
                            <p className="mt-1 text-[11px] text-gray-500">Định dạng chuẩn: 2 số năm + K + mã số (Ví dụ: <strong>21K4080123</strong>)</p>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Email sinh viên HCE *</label>
                            <div className="relative">
                                <input
                                    type="email"
                                    required
                                    placeholder="21k4080123@hce.edu.vn"
                                    value={email}
                                    onChange={(e) => {
                                        setEmail(e.target.value);
                                        setEmailModifiedByUser(true);
                                    }}
                                    className="w-full rounded-xl border border-gray-200 pl-9 pr-3.5 py-2.5 text-sm font-semibold text-gray-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                                />
                                <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                            </div>
                            <p className="mt-1 text-[11px] text-emerald-700">Bắt buộc đuôi <strong>@hce.edu.vn</strong> để nhận mã OTP</p>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Khoa / Viện trực thuộc *</label>
                            <select
                                value={faculty}
                                onChange={(e) => setFaculty(e.target.value)}
                                className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm font-semibold text-gray-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                            >
                                <option value="Khoa Hệ thống thông tin kinh tế">Khoa Hệ thống thông tin kinh tế</option>
                                <option value="Khoa Quản trị kinh doanh">Khoa Quản trị kinh doanh</option>
                                <option value="Khoa Tài chính - Ngân hàng">Khoa Tài chính - Ngân hàng</option>
                                <option value="Khoa Kế toán - Kiểm toán">Khoa Kế toán - Kiểm toán</option>
                                <option value="Khoa Kinh tế">Khoa Kinh tế</option>
                                <option value="Khoa Kinh tế quốc tế">Khoa Kinh tế quốc tế</option>
                                <option value="Cán bộ / Giảng viên">Cán bộ / Giảng viên nhà trường</option>
                            </select>
                        </div>

                        <div className="flex items-center gap-2.5 pt-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex-1 py-2.5 font-bold text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition"
                            >
                                Để sau
                            </button>
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="flex-1 py-2.5 font-bold text-sm text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md shadow-emerald-200 disabled:opacity-50 transition flex items-center justify-center gap-2"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span>Đang gửi OTP...</span>
                                    </>
                                ) : (
                                    <span>Gửi mã OTP</span>
                                )}
                            </button>
                        </div>
                    </form>
                )}

                {/* Step 2: Enter OTP */}
                {step === 2 && (
                    <form onSubmit={handleVerifyOtp} className="mt-4 space-y-4">
                        <button
                            type="button"
                            onClick={() => setStep(1)}
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800 transition mb-1"
                        >
                            <ArrowLeft className="w-3.5 h-3.5" />
                            <span>Thay đổi thông tin MSSV / Email</span>
                        </button>

                        <div className="rounded-2xl bg-slate-50 p-3.5 border border-slate-200 text-xs text-slate-700">
                            <div>Mã xác thực 6 số đã được gửi đến:</div>
                            <div className="font-black text-emerald-700 text-sm mt-0.5 break-all">{email}</div>
                            <div className="text-[11px] text-slate-500 mt-1">Vui lòng kiểm tra hộp thư đến (hoặc hòm thư rác) để lấy mã OTP.</div>
                        </div>

                        {/* Local dev simulation hint */}
                        {devOtpHint && (
                            <div className="rounded-xl bg-amber-50 border border-amber-200 p-2.5 text-xs text-amber-900 flex items-center justify-between">
                                <span>💡 Thử nghiệm: <strong>{devOtpHint}</strong></span>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const chars = devOtpHint.split('').slice(0, 6);
                                        setOtp(chars);
                                    }}
                                    className="px-2 py-0.5 bg-amber-200/80 hover:bg-amber-300 rounded text-[11px] font-bold text-amber-950 transition"
                                >
                                    Điền nhanh
                                </button>
                            </div>
                        )}

                        <div>
                            <label className="block text-xs font-bold text-gray-700 uppercase mb-2 text-center">Nhập mã xác nhận OTP (6 số)</label>
                            <div className="flex justify-center gap-2" onPaste={handleOtpPaste}>
                                {otp.map((digit, idx) => (
                                    <input
                                        key={idx}
                                        id={`hue-otp-${idx}`}
                                        type="text"
                                        maxLength={1}
                                        value={digit}
                                        onChange={(e) => handleOtpChange(idx, e.target.value)}
                                        onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                                        className="w-11 h-12 text-center text-lg font-black rounded-xl border border-gray-300 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200 outline-none bg-white text-slate-900 shadow-sm"
                                        autoFocus={idx === 0}
                                    />
                                ))}
                            </div>
                        </div>

                        <div className="text-center text-xs">
                            {countdown > 0 ? (
                                <span className="text-slate-500">
                                    Gửi lại mã sau: <strong className="text-emerald-700">{countdown}s</strong>
                                </span>
                            ) : (
                                <button
                                    type="button"
                                    disabled={isLoading}
                                    onClick={handleRequestOtp}
                                    className="font-bold text-emerald-700 hover:text-emerald-800 underline inline-flex items-center gap-1"
                                >
                                    <RefreshCw className="w-3.5 h-3.5" />
                                    <span>Gửi lại mã OTP</span>
                                </button>
                            )}
                        </div>

                        <div className="flex items-center gap-2.5 pt-1">
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex-1 py-2.5 font-bold text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition"
                            >
                                Hủy
                            </button>
                            <button
                                type="submit"
                                disabled={isLoading || otp.join('').length < 6}
                                className="flex-1 py-2.5 font-bold text-sm text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md shadow-emerald-200 disabled:opacity-50 transition flex items-center justify-center gap-2"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span>Đang xác thực...</span>
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 className="w-4 h-4" />
                                        <span>Kích hoạt ưu đãi</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}

