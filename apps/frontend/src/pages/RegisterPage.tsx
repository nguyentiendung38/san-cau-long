import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, XCircle, Eye, EyeOff, Loader2, MailCheck } from 'lucide-react';

export default function RegisterPage() {
    const navigate = useNavigate();
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
            alert('Số điện thoại di động không đúng');
            return;
        }

        if (!email) {
            alert('Vui lòng nhập email để nhận mã OTP');
            return;
        }

        if (password.length < 8) {
            alert('Mật khẩu tối thiểu ít nhất 8 kí tự');
            return;
        }

        if (password !== confirmPassword) {
            alert('Mật khẩu nhập lại không khớp');
            return;
        }

        if (!name.trim()) {
            alert('Vui lòng nhập họ tên');
            return;
        }

        setIsLoading(true);
        try {
            const { portalAuthApi } = await import('@/services/portal-auth.service');
            // Gửi yêu cầu OTP qua API mới
            const res = await portalAuthApi.requestOtp({ phone, password, name, email });
            
            alert(res.data?.message || 'Đã gửi mã OTP, vui lòng kiểm tra email của bạn');
            setOtp(['', '', '', '', '', '']);

            // Chuyển sang bước nhập OTP
            setStep(2);
            setCountdown(60);
            setCanResend(false);
        } catch (error: any) {
            const msg = error.response?.data?.message || 'Không thể gửi mã OTP, vui lòng thử lại';
            alert(msg);
        } finally {
            setIsLoading(false);
        }
    };

        const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        const otpString = otp.join('');
        if (otpString.length < 6) {
            alert('Vui lòng nhập đủ 6 số OTP');
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
            alert(msg);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-slate-50 to-teal-100 font-sans antialiased selection:bg-emerald-200 flex flex-col">
            {/* Header */}
            <div className="flex items-center px-4 py-5 text-slate-700 relative w-full max-w-xl mx-auto">
                <button 
                    onClick={() => step === 2 ? setStep(1) : navigate('/trang-chu')}
                    aria-label="Quay lại"
                    className="absolute left-4 p-2 hover:bg-white/70 rounded-full transition-colors"
                >
                    <ChevronLeft className="w-6 h-6" />
                </button>
                <h1 className="flex-1 text-center font-bold text-base sm:text-lg">Đăng ký tài khoản</h1>
            </div>

            {/* Form Container */}
            <div className="flex-1 px-4 pb-10 flex flex-col items-center">
                <div className="bg-white/95 rounded-[28px] border border-white w-full max-w-lg mt-2 p-6 sm:p-8 shadow-[0_24px_70px_-28px_rgba(15,23,42,0.3)]">
                    
                    {step === 1 ? (
                        <form onSubmit={handleRequestOtp} className="space-y-6" autoComplete="off">
                            {/* Dummy inputs to trap Chrome Autofill */}
                            <input type="text" style={{ opacity: 0, position: 'absolute', top: '-1000px', height: 0, width: 0 }} autoComplete="username" tabIndex={-1} aria-hidden="true" />
                            <input type="password" style={{ opacity: 0, position: 'absolute', top: '-1000px', height: 0, width: 0 }} autoComplete="current-password" tabIndex={-1} aria-hidden="true" />
                            
                            {/* Phone */}
                            <div>
                                <label className="block text-sm font-bold text-gray-800 mb-2">Số điện thoại liên hệ (*)</label>
                                <div className={`flex items-center border rounded-lg overflow-hidden transition-all ${phoneTouched && phone.length > 0 && !/^(0[35789]\d{8}|[35789]\d{8})$/.test(phone) ? 'border-red-500 bg-red-50' : 'border-gray-200 bg-white focus-within:border-green-500 focus-within:ring-1 focus-within:ring-green-500'}`}>
                                    <div className={`flex items-center gap-2 px-3 py-3 border-r ${phoneTouched && phone.length > 0 && !/^(0[35789]\d{8}|[35789]\d{8})$/.test(phone) ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'}`}>
                                        <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center overflow-hidden">
                                            <span className="text-yellow-400 text-[10px]">★</span>
                                        </div>
                                        <span className="text-sm font-medium text-gray-700">+ 84</span>
                                    </div>
                                    <input 
                                        type="tel"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        onBlur={() => setPhoneTouched(true)}
                                        placeholder="Nhập số điện thoại"
                                        className={`flex-1 px-4 py-3 outline-none text-sm bg-transparent placeholder-gray-400 ${phoneTouched && phone.length > 0 && !/^(0[35789]\d{8}|[35789]\d{8})$/.test(phone) ? 'text-red-500' : 'text-gray-800'}`}
                                    />
                                </div>
                                {phoneTouched && phone.length > 0 && !/^(0[35789]\d{8}|[35789]\d{8})$/.test(phone) && (
                                    <p className="text-red-500 text-xs mt-1.5 ml-1">Số điện thoại không hợp lệ</p>
                                )}
                            </div>

                            {/* Email */}
                            <div>
                                <label className="block text-sm font-bold text-gray-800 mb-2">Email (*)</label>
                                <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden focus-within:border-green-500 focus-within:ring-1 focus-within:ring-green-500 transition-all bg-white pr-3">
                                    <input 
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="Để nhận mã xác nhận OTP"
                                        className="flex-1 px-4 py-3 outline-none text-sm text-gray-800 placeholder-gray-400"
                                    />
                                    {email && (
                                        <button type="button" onClick={() => setEmail('')} className="text-green-700 hover:text-green-800">
                                            <XCircle className="w-5 h-5 text-white bg-green-700 rounded-full" fill="currentColor" />
                                        </button>
                                    )}
                                </div>
                                <p className="mt-1.5 ml-1 text-xs text-gray-500">Mã xác nhận được gửi qua email; hệ thống không gửi SMS.</p>
                            </div>

                            {/* Name */}
                            <div>
                                <label className="block text-sm font-bold text-gray-800 mb-2">Tên đầy đủ (*)</label>
                                <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden focus-within:border-green-500 focus-within:ring-1 focus-within:ring-green-500 transition-all bg-white pr-3">
                                    <input 
                                        type="text"
                                        required
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="Nhập họ và tên"
                                        autoComplete="off"
                                        readOnly
                                        onFocus={(e) => e.target.removeAttribute('readonly')}
                                        className="flex-1 px-4 py-3 outline-none text-sm text-gray-800 placeholder-gray-400"
                                    />
                                </div>
                            </div>

                            {/* Password */}
                            <div>
                                <label className="block text-sm font-bold text-gray-800 mb-2">Mật khẩu (*)</label>
                                <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden focus-within:border-green-500 focus-within:ring-1 focus-within:ring-green-500 transition-all bg-white pr-3">
                                    <input 
                                        type={showPassword ? "text" : "password"}
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Tối thiểu 8 ký tự"
                                        className="flex-1 px-4 py-3 outline-none text-sm text-gray-800 placeholder-gray-400"
                                    />
                                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-green-700 hover:text-green-800">
                                        {showPassword ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                                    </button>
                                </div>
                            </div>

                            {/* Confirm Password */}
                            <div>
                                <label className="block text-sm font-bold text-gray-800 mb-2">Nhập lại mật khẩu</label>
                                <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden focus-within:border-green-500 focus-within:ring-1 focus-within:ring-green-500 transition-all bg-white pr-3">
                                    <input 
                                        type={showConfirmPassword ? "text" : "password"}
                                        required
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="Nhập lại mật khẩu"
                                        className="flex-1 px-4 py-3 outline-none text-sm text-gray-800 placeholder-gray-400"
                                    />
                                    <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="text-green-700 hover:text-green-800">
                                        {showConfirmPassword ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                                    </button>
                                </div>
                            </div>

                            {/* Submit Button */}
                            <div className="pt-4">
                                <button 
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full flex items-center justify-center bg-[#116a32] hover:bg-[#0e5c2b] text-white font-bold py-3.5 rounded-lg transition-colors shadow-md disabled:opacity-70"
                                >
                                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
                                    {isLoading ? 'ĐANG GỬI MÃ OTP...' : 'TIẾP TỤC'}
                                </button>
                            </div>
                        </form>
                    ) : (
                        <form onSubmit={handleVerifyOtp} className="space-y-5 flex flex-col items-center pt-2">
                            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-50 text-emerald-700 ring-1 ring-emerald-100">
                                <MailCheck className="h-8 w-8" strokeWidth={1.8} />
                            </div>
                            
                            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">Xác nhận email</h2>
                            <p className="text-center text-slate-500 text-sm leading-6 px-2">
                                Nhập mã gồm 6 chữ số đã gửi đến
                                <span className="mt-1 block font-semibold text-slate-800 break-all">{email}</span>
                            </p>

                            <div className="relative flex gap-1.5 sm:gap-2 justify-center py-3 w-full max-w-[340px] mx-auto">
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
                                            for(let i=0; i<val.length; i++) newOtp[i] = val[i];
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
                                            className={`w-10 h-14 sm:w-12 border-2 rounded-xl flex items-center justify-center text-2xl font-bold transition-all bg-white ${isActive ? 'border-emerald-500 ring-4 ring-emerald-500/10' : 'border-slate-200'} text-slate-800`}
                                        >
                                            {digit}
                                        </div>
                                    );
                                })}
                            </div>

                            <button 
                                type="submit"
                                disabled={isLoading || otp.join('').length < 6}
                                className="w-full flex items-center justify-center bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-3.5 rounded-xl transition-colors shadow-lg shadow-emerald-900/10 disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {isLoading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
                                XÁC NHẬN ĐĂNG KÝ
                            </button>

                            <button 
                                type="button" 
                                onClick={handleRequestOtp} 
                                disabled={isLoading || !canResend}
                                className="text-sm font-semibold text-emerald-700 hover:text-emerald-800 disabled:cursor-not-allowed disabled:text-slate-400"
                            >
                                {canResend ? 'Gửi lại mã OTP' : `Gửi lại mã sau ${countdown}s`}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
