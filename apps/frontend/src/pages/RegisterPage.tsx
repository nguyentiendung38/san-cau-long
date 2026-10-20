import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, Eye, EyeOff, Loader2, MailCheck, Phone, Mail, User, Lock, ShieldCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function RegisterPage() {
    const navigate = useNavigate();
    const { toast } = useToast();
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    // Form states
    const [step, setStep] = useState<1 | 2>(1);
    const [isLoading, setIsLoading] = useState(false);

    const [phone, setPhone] = useState('');
    const [phoneTouched, setPhoneTouched] = useState(false);
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    // OTP state
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [countdown, setCountdown] = useState(60);
    const [canResend, setCanResend] = useState(false);

    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (step === 2 && countdown > 0) {
            timer = setInterval(() => setCountdown(c => c - 1), 1000);
        } else if (countdown === 0) {
            setCanResend(true);
        }
        return () => clearInterval(timer);
    }, [step, countdown]);

    const handleRequestOtp = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!phone || !/^(0[35789]\d{8}|[35789]\d{8})$/.test(phone)) {
            setPhoneTouched(true);
            toast({ title: 'Số điện thoại di động không đúng', variant: 'error' });
            return;
        }

        if (!email) {
            toast({ title: 'Vui lòng nhập email để nhận mã OTP', variant: 'error' });
            return;
        }

        if (password.length < 8) {
            toast({ title: 'Mật khẩu tối thiểu ít nhất 8 kí tự', variant: 'error' });
            return;
        }

        if (password !== confirmPassword) {
            toast({ title: 'Mật khẩu nhập lại không khớp', variant: 'error' });
            return;
        }

        if (!name.trim()) {
            toast({ title: 'Vui lòng nhập họ tên', variant: 'error' });
            return;
        }

        setIsLoading(true);
        try {
            const { portalAuthApi } = await import('@/services/portal-auth.service');
            const res = await portalAuthApi.requestOtp({ phone, password, name, email });

            toast({ title: 'Đã gửi mã OTP', description: res.data?.message || 'Vui lòng kiểm tra email của bạn', variant: 'success' });
            setOtp(['', '', '', '', '', '']);

            setStep(2);
            setCountdown(60);
            setCanResend(false);
        } catch (error: any) {
            const msg = error.response?.data?.message || 'Không thể gửi mã OTP, vui lòng thử lại';
            toast({ title: 'Lỗi', description: msg, variant: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        const otpString = otp.join('');
        if (otpString.length < 6) {
            toast({ title: 'Vui lòng nhập đủ 6 số OTP', variant: 'error' });
            return;
        }

        setIsLoading(true);
        try {
            const { portalAuthApi } = await import('@/services/portal-auth.service');
            const res = await portalAuthApi.verifyOtp({ phone, password, name, email, otp: otpString });

            // Lưu token và thông tin user
            localStorage.setItem('portalUserToken', res.data.token);
            localStorage.setItem('portalUser', JSON.stringify({
                id: res.data.customer.id,
                name: res.data.customer.name,
                email: res.data.customer.email
            }));
            localStorage.setItem('portalUserId', res.data.customer.id);
            localStorage.setItem('portalUserPhone', res.data.customer.phone);
            window.dispatchEvent(new Event('storage'));
            navigate('/trang-chu');
        } catch (error: any) {
            const msg = error.response?.data?.message || 'Mã OTP không đúng hoặc đã hết hạn';
            toast({ title: 'Lỗi xác thực', description: msg, variant: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="h-screen max-h-screen flex overflow-hidden">
            {/* Left - Hero with Campus Showcase (Y hệt giao diện Login) */}
            <div className="hidden lg:flex lg:w-1/2 p-6 xl:p-8 flex-col justify-between relative overflow-hidden bg-gradient-to-br from-[#063d2c] via-[#085a3c] to-[#04281c] text-white">
                {/* Decorative background glow */}
                <div className="absolute -right-20 -top-20 w-80 h-80 rounded-full bg-emerald-400/10 blur-3xl pointer-events-none" />
                <div className="absolute -left-20 -bottom-20 w-80 h-80 rounded-full bg-lime-400/10 blur-3xl pointer-events-none" />

                {/* Header Logo */}
                <div className="flex items-center gap-3 relative z-10">
                    <img
                        src="/logo-hue.jpg"
                        alt="Logo Trường Đại học Kinh tế Huế"
                        className="w-11 h-11 rounded-full object-contain bg-white p-0.5 shadow-md border-2 border-white/40"
                    />
                    <div>
                        <span className="text-xl font-black text-white tracking-tight block">SÂN CẦU LÔNG HUẾ</span>
                        <span className="text-xs font-semibold text-lime-300 tracking-wider uppercase">Trường Đại học Kinh tế Huế</span>
                    </div>
                </div>

                {/* Prominent Campus Photo Showcase - 100% rõ nét, không bị che khuất */}
                <div className="relative z-10 my-2 xl:my-3">
                    <div className="overflow-hidden rounded-2xl border border-white/30 bg-white/10 p-1.5 shadow-xl backdrop-blur-md">
                        <img
                            src="/campus-hue.jpg"
                            alt="Toàn cảnh Trường Đại học Kinh tế Huế"
                            className="w-full h-36 xl:h-44 object-cover rounded-xl shadow-md transition-transform duration-500 hover:scale-[1.01]"
                        />
                        <div className="mt-2 px-1.5 flex items-center justify-between text-[11px]">
                            <span className="font-bold text-white flex items-center gap-1">
                                🏛️ Cơ sở Trường ĐH Kinh tế Huế
                            </span>
                            <span className="font-semibold text-lime-300 bg-black/40 px-2 py-0.5 rounded-full border border-lime-300/30">
                                Nâng cánh những ước mơ
                            </span>
                        </div>
                    </div>
                </div>

                {/* Bottom System Info & Stats */}
                <div className="relative z-10 bg-black/35 rounded-2xl p-3.5 xl:p-4 border border-white/20 backdrop-blur-md shadow-lg">
                    <div className="flex items-center justify-between mb-1.5">
                        <h2 className="text-sm font-extrabold text-white">
                            Đặc Quyền Thành Viên Sân HUE
                        </h2>
                        <span className="text-[10px] font-bold text-lime-300 bg-white/10 px-2 py-0.5 rounded-full">
                            Ưu đãi -20% Sinh viên
                        </span>
                    </div>
                    <p className="text-[11px] text-emerald-100/85 leading-snug mb-2.5 line-clamp-2">
                        Tạo tài khoản miễn phí để tích lũy điểm đổi quà, đặt sân trực tuyến 24/7 và nhận ưu đãi giảm 20% sinh viên.
                    </p>
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/15 text-center">
                        <div>
                            <p className="text-lg xl:text-xl font-black text-lime-300 leading-tight">500+</p>
                            <p className="text-[10px] text-white/70">Khách hàng</p>
                        </div>
                        <div>
                            <p className="text-lg xl:text-xl font-black text-lime-300 leading-tight">50+</p>
                            <p className="text-[10px] text-white/70">Sân hoạt động</p>
                        </div>
                        <div>
                            <p className="text-lg xl:text-xl font-black text-lime-300 leading-tight">10K+</p>
                            <p className="text-[10px] text-white/70">Lượt đặt</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right - Form Container */}
            <div className="flex-1 flex items-center justify-center p-5 sm:p-6 bg-background overflow-y-auto">
                <div className="w-full max-w-md py-2">
                    {/* Top back button */}
                    <div className="mb-2">
                        <button
                            type="button"
                            onClick={() => step === 2 ? setStep(1) : navigate('/dang-nhap')}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-emerald-700 transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            <span>{step === 2 ? 'Quay lại điền thông tin' : 'Về trang đăng nhập'}</span>
                        </button>
                    </div>

                    {/* Mobile logo & campus card */}
                    <div className="lg:hidden flex flex-col items-center gap-3 mb-6 justify-center">
                        <div className="flex items-center gap-3">
                            <img src="/logo-hue.jpg" alt="Logo Trường Đại học Kinh tế Huế" className="w-12 h-12 rounded-full object-contain bg-white p-0.5 shadow-md border border-slate-200" />
                            <div>
                                <span className="text-xl font-black text-emerald-700 block">SÂN CẦU LÔNG HUẾ</span>
                                <span className="text-xs text-slate-500 font-medium">Trường Đại học Kinh tế Huế</span>
                            </div>
                        </div>
                        <div className="w-full mt-1 overflow-hidden rounded-xl border border-slate-200 shadow-sm bg-white p-1">
                            <img
                                src="/campus-hue.jpg"
                                alt="Cơ sở Trường Đại học Kinh tế Huế"
                                className="w-full h-32 object-cover rounded-lg"
                            />
                            <p className="text-[11px] text-center text-slate-600 font-semibold py-1">
                                🏛️ ĐH Kinh tế Huế · Nâng cánh những ước mơ
                            </p>
                        </div>
                    </div>

                    {/* Form Heading */}
                    <div className="mb-3.5">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Tài khoản khách hàng</p>
                        <h2 className="text-2xl font-black tracking-tight text-foreground mt-0.5">
                            {step === 1 ? 'Đăng ký tài khoản' : 'Xác thực OTP'}
                        </h2>
                        <p className="text-foreground-secondary text-xs sm:text-sm mt-1">
                            {step === 1
                                ? 'Nhập thông tin bên dưới để tạo tài khoản đặt sân trực tuyến'
                                : `Nhập mã xác nhận 6 chữ số đã gửi đến email ${email}`
                            }
                        </p>
                    </div>

                    {/* Step 1: Input Form */}
                    {step === 1 ? (
                        <form onSubmit={handleRequestOtp} className="space-y-3" autoComplete="off">
                            {/* Dummy inputs to prevent autofill confusion */}
                            <input type="text" style={{ opacity: 0, position: 'absolute', top: '-1000px', height: 0, width: 0 }} autoComplete="username" tabIndex={-1} aria-hidden="true" />
                            <input type="password" style={{ opacity: 0, position: 'absolute', top: '-1000px', height: 0, width: 0 }} autoComplete="current-password" tabIndex={-1} aria-hidden="true" />

                            {/* Họ và tên */}
                            <div>
                                <label className="block text-[11px] font-bold uppercase tracking-wide text-foreground mb-1">
                                    Họ và tên (*)
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        required
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="Ví dụ: Nguyễn Văn An"
                                        className="w-full rounded-xl border border-border bg-background-secondary pl-9 pr-3.5 py-2 text-xs sm:text-sm text-foreground placeholder:text-foreground-muted outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                                    />
                                    <User className="w-3.5 h-3.5 text-foreground-muted absolute left-3 top-2.5" />
                                </div>
                            </div>

                            {/* Số điện thoại & Email trên 2 cột (hoặc 1 cột ở mobile) */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                <div>
                                    <label className="block text-[11px] font-bold uppercase tracking-wide text-foreground mb-1">
                                        Số điện thoại (*)
                                    </label>
                                    <div className="flex rounded-xl border border-border bg-background-secondary overflow-hidden focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500 transition-all">
                                        <div className="flex items-center gap-1 px-2.5 bg-black/5 dark:bg-white/5 border-r border-border text-[11px] font-bold text-foreground-secondary">
                                            <span>+84</span>
                                        </div>
                                        <input
                                            type="tel"
                                            required
                                            value={phone}
                                            onChange={(e) => setPhone(e.target.value)}
                                            onBlur={() => setPhoneTouched(true)}
                                            placeholder="0912 345 678"
                                            className="w-full px-2.5 py-2 text-xs sm:text-sm text-foreground placeholder:text-foreground-muted bg-transparent outline-none"
                                        />
                                    </div>
                                    {phoneTouched && phone.length > 0 && !/^(0[35789]\d{8}|[35789]\d{8})$/.test(phone) && (
                                        <p className="text-red-500 text-[10px] mt-0.5">SĐT không hợp lệ</p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-[11px] font-bold uppercase tracking-wide text-foreground mb-1">
                                        Email nhận OTP (*)
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="email"
                                            required
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="email@example.com"
                                            className="w-full rounded-xl border border-border bg-background-secondary pl-8 pr-2.5 py-2 text-xs sm:text-sm text-foreground placeholder:text-foreground-muted outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                                        />
                                        <Mail className="w-3.5 h-3.5 text-foreground-muted absolute left-2.5 top-2.5" />
                                    </div>
                                </div>
                            </div>

                            {/* Mật khẩu & Nhập lại mật khẩu trên 2 cột */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                <div>
                                    <label className="block text-[11px] font-bold uppercase tracking-wide text-foreground mb-1">
                                        Mật khẩu (*)
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            required
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            placeholder=">= 8 ký tự"
                                            className="w-full rounded-xl border border-border bg-background-secondary pl-8 pr-8 py-2 text-xs sm:text-sm text-foreground placeholder:text-foreground-muted outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                                        />
                                        <Lock className="w-3.5 h-3.5 text-foreground-muted absolute left-2.5 top-2.5" />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-2.5 top-2 text-foreground-muted hover:text-foreground transition-colors"
                                        >
                                            {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[11px] font-bold uppercase tracking-wide text-foreground mb-1">
                                        Nhập lại mật khẩu (*)
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={showConfirmPassword ? 'text' : 'password'}
                                            required
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            placeholder="Khớp mật khẩu"
                                            className="w-full rounded-xl border border-border bg-background-secondary pl-8 pr-8 py-2 text-xs sm:text-sm text-foreground placeholder:text-foreground-muted outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                                        />
                                        <Lock className="w-3.5 h-3.5 text-foreground-muted absolute left-2.5 top-2.5" />
                                        <button
                                            type="button"
                                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                            className="absolute right-2.5 top-2 text-foreground-muted hover:text-foreground transition-colors"
                                        >
                                            {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Submit Button */}
                            <div className="pt-1.5">
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-green-700 hover:from-emerald-500 hover:to-green-600 text-white font-bold py-2.5 px-4 rounded-xl shadow-md transition-all active:scale-[0.99] disabled:opacity-70 disabled:cursor-not-allowed text-xs sm:text-sm"
                                >
                                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                    <span>{isLoading ? 'Đang gửi mã OTP...' : 'Tiếp tục nhận mã OTP'}</span>
                                </button>
                            </div>
                        </form>
                    ) : (
                        /* Step 2: OTP Verification */
                        <form onSubmit={handleVerifyOtp} className="space-y-5 flex flex-col items-center">
                            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-50 text-emerald-700 ring-1 ring-emerald-200">
                                <MailCheck className="h-8 w-8" strokeWidth={1.8} />
                            </div>

                            <p className="text-center text-foreground-secondary text-xs sm:text-sm leading-relaxed max-w-xs">
                                Vui lòng kiểm tra hộp thư đến (hoặc thư rác) tại địa chỉ:
                                <strong className="mt-1 block text-foreground font-bold break-all">{email}</strong>
                            </p>

                            <div className="relative flex gap-2 justify-center py-2 w-full max-w-[340px] mx-auto">
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={6}
                                    autoComplete="one-time-code"
                                    aria-label="Mã xác nhận gồm 6 chữ số"
                                    value={otp.join('')}
                                    onChange={(e) => {
                                        const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                                        setOtp(prev => {
                                            const newOtp = ['', '', '', '', '', ''];
                                            for (let i = 0; i < val.length; i++) newOtp[i] = val[i];
                                            return newOtp;
                                        });
                                    }}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-text z-10"
                                />
                                {otp.map((digit, index) => {
                                    const isActive = otp.join('').length === index || (index === 5 && otp.join('').length === 6);
                                    return (
                                        <div
                                            key={index}
                                            className={`w-11 h-14 border-2 rounded-xl flex items-center justify-center text-2xl font-black transition-all bg-background-secondary ${isActive ? 'border-emerald-500 ring-4 ring-emerald-500/10' : 'border-border'} text-foreground`}
                                        >
                                            {digit}
                                        </div>
                                    );
                                })}
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading || otp.join('').length < 6}
                                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-green-700 hover:from-emerald-500 hover:to-green-600 text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all active:scale-[0.99] disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                <span>Xác nhận đăng ký</span>
                            </button>

                            <button
                                type="button"
                                onClick={handleRequestOtp}
                                disabled={isLoading || !canResend}
                                className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 disabled:cursor-not-allowed disabled:text-foreground-muted"
                            >
                                {canResend ? 'Gửi lại mã OTP' : `Gửi lại mã sau ${countdown}s`}
                            </button>
                        </form>
                    )}

                    {/* Bottom Login Link */}
                    <div className="mt-4 border-t border-border pt-3 text-center text-xs text-foreground-secondary">
                        Đã có tài khoản?{' '}
                        <Link to="/dang-nhap" className="font-bold text-emerald-600 hover:text-emerald-700 hover:underline">
                            Đăng nhập ngay
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
