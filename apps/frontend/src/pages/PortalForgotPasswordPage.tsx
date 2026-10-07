import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, XCircle, Eye, EyeOff, Loader2 } from 'lucide-react';
import { portalAuthApi } from '@/services/portal-auth.service';

export default function PortalForgotPasswordPage() {
    const navigate = useNavigate();
    const [step, setStep] = useState<1 | 2>(1);
    const [isLoading, setIsLoading] = useState(false);
    
    // Form states
    const [email, setEmail] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    
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
        
        if (!email) {
            alert('Vui lòng nhập email đăng ký tài khoản');
            return;
        }

        setIsLoading(true);
        try {
            const res = await portalAuthApi.forgotPasswordOtp({ email });
            
            if (res.message) {
                alert(res.message);
            } else {
                alert('Đã gửi mã OTP, vui lòng kiểm tra email của bạn');
            }

            setStep(2);
            setCountdown(60);
            setCanResend(false);
        } catch (error: any) {
            const msg = error.response?.data?.message || 'Không thể gửi mã OTP, vui lòng kiểm tra lại email';
            alert(msg);
        } finally {
            setIsLoading(false);
        }
    };

        const handleOtpChange = (index: number, value: string) => {
        const cleanValue = value.replace(/\D/g, '');
        if (!cleanValue && value) return;

        // If the user pastes or the keyboard auto-fills multiple characters
        if (cleanValue.length > 1) {
            const digits = cleanValue.split('').slice(0, 6 - index);
            setOtp(prev => {
                const newOtp = [...prev];
                digits.forEach((digit, i) => {
                    if (index + i < 6) newOtp[index + i] = digit;
                });
                return newOtp;
            });
            
            // Focus the next empty input or the last one
            const nextIndex = Math.min(index + digits.length, 5);
            const nextInput = document.getElementById(`otp-${nextIndex}`);
            if (nextInput) {
                setTimeout(() => nextInput.focus(), 0);
            }
            return;
        }

        const char = cleanValue;
        if (!char) {
            setOtp(prev => {
                const newOtp = [...prev];
                newOtp[index] = '';
                return newOtp;
            });
            return;
        }

        setOtp(prev => {
            const newOtp = [...prev];
            newOtp[index] = char;
            return newOtp;
        });

        // Focus next
        if (index < 5) {
            const nextInput = document.getElementById(`otp-${index + 1}`);
            if (nextInput) {
                setTimeout(() => nextInput.focus(), 0);
            }
        }
    };

    const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace' && !otp[index] && index > 0) {
            const prevInput = document.getElementById(`otp-${index - 1}`);
            if (prevInput) {
                prevInput.focus();
            }
        } else if (e.key === 'ArrowLeft' && index > 0) {
            document.getElementById(`otp-${index - 1}`)?.focus();
        } else if (e.key === 'ArrowRight' && index < 5) {
            document.getElementById(`otp-${index + 1}`)?.focus();
        }
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        const otpString = otp.join('');
        if (otpString.length < 6) {
            alert('Vui lòng nhập đủ 6 số OTP');
            return;
        }

        if (newPassword.length < 8) {
            alert('Mật khẩu mới phải có ít nhất 8 ký tự');
            return;
        }

        setIsLoading(true);
        try {
            await portalAuthApi.resetPassword({ email, otp: otpString, newPassword });
            alert('Đổi mật khẩu thành công! Vui lòng đăng nhập lại.');
            navigate('/dang-nhap');
        } catch (error: any) {
            const msg = error.response?.data?.message || 'Mã OTP không đúng hoặc đã hết hạn';
            alert(msg);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#2e9c56] font-sans selection:bg-green-200 flex flex-col">
            {/* Header */}
            <div className="flex items-center px-4 py-4 text-white relative">
                <button 
                    onClick={() => step === 2 ? setStep(1) : navigate('/dang-nhap')}
                    className="absolute left-4 p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                    <ChevronLeft className="w-6 h-6" />
                </button>
                <h1 className="flex-1 text-center font-bold text-lg">Quên mật khẩu</h1>
            </div>

            {/* Form Container */}
            <div className="flex-1 px-4 md:px-0 flex flex-col items-center">
                <div className="bg-white rounded-[24px] w-full max-w-lg mt-2 p-6 shadow-2xl">
                    
                    {step === 1 ? (
                        <form onSubmit={handleRequestOtp} className="space-y-6" autoComplete="off">
                            {/* Dummy inputs to trap Chrome Autofill */}
                            <input type="text" style={{ opacity: 0, position: 'absolute', top: '-1000px', height: 0, width: 0 }} autoComplete="username" tabIndex={-1} aria-hidden="true" />
                            <input type="password" style={{ opacity: 0, position: 'absolute', top: '-1000px', height: 0, width: 0 }} autoComplete="current-password" tabIndex={-1} aria-hidden="true" />
                            
                            <div>
                                <label className="block text-sm font-bold text-gray-800 mb-2">Email đăng ký tài khoản</label>
                                <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden focus-within:border-green-500 focus-within:ring-1 focus-within:ring-green-500 transition-all bg-white pr-3">
                                    <input 
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="Nhập email của bạn"
                                        autoComplete="off"
                                        className="flex-1 px-4 py-3 outline-none text-sm text-gray-800 placeholder-gray-400"
                                    />
                                    {email && (
                                        <button type="button" onClick={() => setEmail('')} className="text-green-700 hover:text-green-800">
                                            <XCircle className="w-5 h-5 text-white bg-green-700 rounded-full" fill="currentColor" />
                                        </button>
                                    )}
                                </div>
                                <p className="text-xs text-gray-500 mt-2">Chúng tôi sẽ gửi một mã OTP gồm 6 số về email này để bạn khôi phục mật khẩu.</p>
                            </div>

                            <div className="pt-4">
                                <button 
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full flex items-center justify-center bg-[#116a32] hover:bg-[#0e5c2b] text-white font-bold py-3.5 rounded-lg transition-colors shadow-md disabled:opacity-70"
                                >
                                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
                                    {isLoading ? 'ĐANG GỬI...' : 'TIẾP TỤC'}
                                </button>
                            </div>
                        </form>
                    ) : (
                        <form onSubmit={handleResetPassword} className="space-y-6 flex flex-col items-center pt-4" autoComplete="off">
                            {/* Dummy inputs to trap Chrome Autofill */}
                            <input type="text" style={{ opacity: 0, position: 'absolute', top: '-1000px', height: 0, width: 0 }} autoComplete="username" tabIndex={-1} aria-hidden="true" />
                            <input type="password" style={{ opacity: 0, position: 'absolute', top: '-1000px', height: 0, width: 0 }} autoComplete="current-password" tabIndex={-1} aria-hidden="true" />
                            
                            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-2">
                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                            </div>
                            
                            <h2 className="text-xl font-bold text-gray-800">Tạo mật khẩu mới</h2>
                            <p className="text-center text-gray-500 text-sm px-4">
                                Nhập mã OTP đã được gửi đến email <br/>
                                <span className="font-bold text-gray-700">{email}</span>
                            </p>

                            <div className="relative flex gap-2 justify-center py-4 w-[340px] mx-auto">
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={6}
                                    autoComplete="one-time-code"
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
                                            className={`w-12 h-14 border-2 rounded-xl flex items-center justify-center text-2xl font-bold transition-all bg-white ${isActive ? 'border-green-500 ring-1 ring-green-500' : 'border-gray-300'} text-gray-800`}
                                        >
                                            {digit}
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="w-full">
                                <label className="block text-sm font-bold text-gray-800 mb-2">Mật khẩu mới</label>
                                <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden focus-within:border-green-500 focus-within:ring-1 focus-within:ring-green-500 transition-all bg-white pr-3">
                                    <input 
                                        type={showPassword ? "text" : "password"}
                                        required
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        placeholder="Nhập mật khẩu mới (tối thiểu 8 ký tự)"
                                        autoComplete="new-password"
                                        className="flex-1 px-4 py-3 outline-none text-sm text-gray-800 placeholder-gray-400"
                                    />
                                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-green-700 hover:text-green-800">
                                        {showPassword ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                                    </button>
                                </div>
                            </div>

                            <button 
                                type="submit"
                                disabled={isLoading || otp.join('').length < 6 || newPassword.length < 8}
                                className="w-full flex items-center justify-center bg-[#116a32] hover:bg-[#0e5c2b] text-white font-bold py-3.5 rounded-lg transition-colors shadow-md disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {isLoading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
                                ĐỔI MẬT KHẨU
                            </button>

                            <button 
                                type="button" 
                                onClick={handleRequestOtp} 
                                disabled={isLoading}
                                className="text-sm font-semibold text-green-700 hover:text-green-800"
                            >
                                Gửi lại mã OTP
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
