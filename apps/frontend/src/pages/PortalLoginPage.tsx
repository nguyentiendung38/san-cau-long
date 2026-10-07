import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ChevronLeft, XCircle, Eye, EyeOff } from 'lucide-react';

export default function PortalLoginPage() {
    const navigate = useNavigate();
    const [showPassword, setShowPassword] = useState(false);

    // Form states
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!email || !password) {
            alert('Vui lòng điền đủ thông tin');
            return;
        }

        try {
            const { portalAuthApi } = await import('@/services/portal-auth.service');
            const res = await portalAuthApi.login({ identifier: email, password });
            
            localStorage.setItem('portalUserToken', res.data.token);
            localStorage.setItem('portalUser', JSON.stringify({
                id: res.data.customer.id,
                name: res.data.customer.name,
                email: res.data.customer.email || ''
            }));
            localStorage.setItem('portalUserId', res.data.customer.id);
            if (res.data.customer.phone) {
                localStorage.setItem('portalUserPhone', res.data.customer.phone);
            }
            navigate('/trang-chu');
        } catch (error: any) {
            const msg = error.response?.data?.message || 'Đăng nhập thất bại';
            alert(msg);
        }
    };

    return (
        <div className="min-h-screen bg-[#2e9c56] font-sans selection:bg-green-200 flex flex-col">
            {/* Header */}
            <div className="flex items-center px-4 py-4 text-white relative">
                <button 
                    onClick={() => navigate('/trang-chu')}
                    className="absolute left-4 p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                    <ChevronLeft className="w-6 h-6" />
                </button>
                <h1 className="flex-1 text-center font-bold text-lg">Đăng nhập</h1>
            </div>

            {/* Form Container */}
            <div className="flex-1 px-4 md:px-0 flex flex-col items-center mt-2">
                <div className="bg-white rounded-[24px] w-full max-w-lg shadow-2xl overflow-hidden">
                    <div className="p-6 pt-8">
                        <form onSubmit={handleLogin} className="space-y-6" autoComplete="off">
                            {/* Dummy inputs to trap Chrome Autofill */}
                            <input type="text" style={{ opacity: 0, position: 'absolute', top: '-1000px', height: 0, width: 0 }} autoComplete="username" tabIndex={-1} aria-hidden="true" />
                            <input type="password" style={{ opacity: 0, position: 'absolute', top: '-1000px', height: 0, width: 0 }} autoComplete="current-password" tabIndex={-1} aria-hidden="true" />
                            
                            {/* Email */}
                            <div>
                                <label className="block text-sm font-bold text-gray-800 mb-2">Email của bạn (*)</label>
                                <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden focus-within:border-green-500 focus-within:ring-1 focus-within:ring-green-500 transition-all bg-white pr-3">
                                    <input 
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="Nhập email đăng nhập"
                                        className="flex-1 px-4 py-3 outline-none text-sm text-gray-800 placeholder-gray-400"
                                    />
                                    {email && (
                                        <button type="button" onClick={() => setEmail('')} className="text-green-700 hover:text-green-800">
                                            <XCircle className="w-5 h-5 text-white bg-green-700 rounded-full" fill="currentColor" />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Password */}
                            <div>
                                <label className="block text-sm font-bold text-gray-800 mb-2">Mật khẩu (*)</label>
                                <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden focus-within:border-green-500 focus-within:ring-1 focus-within:ring-green-500 transition-all bg-white pr-3">
                                    <input 
                                        type={showPassword ? "text" : "password"}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Nhập mật khẩu"
                                        className="flex-1 px-4 py-3 outline-none text-sm text-gray-800 placeholder-gray-400"
                                    />
                                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-green-700 hover:text-green-800">
                                        {showPassword ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                                    </button>
                                </div>
                            </div>

                            {/* Submit Button */}
                            <div className="pt-2">
                                <button 
                                    type="submit"
                                    className="w-full bg-[#116a32] hover:bg-[#0e5c2b] text-white font-bold py-3.5 rounded-lg transition-colors shadow-md"
                                >
                                    ĐĂNG NHẬP
                                </button>
                            </div>

                            {/* Forgot Password Link */}
                            <div className="text-center pt-2">
                                <span className="text-sm text-gray-500">Bạn quên mật khẩu? </span>
                                <Link to="/client-forgot-password" className="text-sm font-bold text-[#116a32] hover:underline">
                                    Quên mật khẩu
                                </Link>
                            </div>
                        </form>
                    </div>
                </div>

                {/* Additional Actions */}
                <div className="w-full max-w-lg mt-6 text-center space-y-4">
                    <div className="text-white text-sm">
                        Bạn chưa có tài khoản?{' '}
                        <Link to="/dang-ky" className="font-bold hover:underline">
                            Đăng ký
                        </Link>
                    </div>

                    <button className="w-full bg-white hover:bg-gray-50 text-gray-700 font-semibold py-3.5 rounded-lg transition-colors shadow-md flex items-center justify-center gap-3">
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                        Đăng nhập với Google
                    </button>
                </div>
            </div>
        </div>
    );
}
