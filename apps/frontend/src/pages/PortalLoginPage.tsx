import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, Sparkles } from 'lucide-react';
import { portalAuthApi } from '@/services/portal-auth.service';

export default function PortalLoginPage() {
    const navigate = useNavigate();
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setErrorMessage('');
        setIsLoading(true);

        try {
            const response = await portalAuthApi.login({ identifier: identifier.trim(), password });
            const { token, customer } = response.data;
            localStorage.setItem('portalUserToken', token);
            localStorage.setItem('portalUser', JSON.stringify({
                id: customer.id,
                name: customer.name,
                email: customer.email || '',
            }));
            localStorage.setItem('portalUserId', customer.id);
            if (customer.phone) localStorage.setItem('portalUserPhone', customer.phone);
            window.dispatchEvent(new Event('storage'));
            navigate('/trang-chu');
        } catch (error: any) {
            setErrorMessage(error.response?.data?.message || 'Đăng nhập chưa thành công. Vui lòng thử lại.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-10">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(34,197,94,0.22),_transparent_55%)]" />
            <div className="pointer-events-none absolute -left-24 top-1/3 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />
            <div className="pointer-events-none absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-teal-400/10 blur-3xl" />

            <button
                type="button"
                onClick={() => navigate('/trang-chu')}
                className="absolute left-5 top-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/80 transition hover:bg-white/10 hover:text-white"
            >
                <ArrowLeft className="h-4 w-4" />
                Về trang chủ
            </button>

            <section className="relative grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-white/10 bg-white shadow-2xl shadow-black/30 md:grid-cols-[0.95fr_1.05fr]">
                <aside className="relative hidden flex-col justify-between overflow-hidden p-8 text-white md:flex bg-gradient-to-br from-emerald-800 via-green-800 to-teal-900">
                    <div className="relative flex items-center gap-3">
                        <img src="/logo-hue.jpg" alt="Logo Trường Đại học Kinh tế Huế" className="h-12 w-12 rounded-full object-contain bg-white p-0.5 shadow-md border-2 border-white/40" />
                        <div>
                            <span className="text-xl font-black tracking-tight block">SÂN CẦU LÔNG HUẾ</span>
                            <span className="text-xs text-lime-200 font-semibold">Trường Đại học Kinh tế Huế</span>
                        </div>
                    </div>

                    {/* Campus Image Frame - Hiển thị ảnh trường sáng rõ */}
                    <div className="relative my-4 overflow-hidden rounded-2xl border-2 border-white/30 bg-white/10 p-1.5 shadow-2xl backdrop-blur-md">
                        <img
                            src="/campus-hue.jpg"
                            alt="Trường Đại học Kinh tế Huế - Nâng cánh những ước mơ"
                            className="w-full h-44 object-cover rounded-xl shadow-md"
                        />
                        <div className="mt-2 px-1 flex items-center justify-between text-[11px] font-bold text-white">
                            <span>🏛️ Cơ sở ĐH Kinh tế Huế</span>
                            <span className="text-lime-300">Nâng cánh những ước mơ</span>
                        </div>
                    </div>

                    <div className="relative bg-black/25 rounded-2xl p-4 border border-white/15 backdrop-blur-sm">
                        <p className="text-xs font-bold uppercase tracking-wider text-lime-300 mb-1">Chào mừng bạn</p>
                        <h2 className="text-xl font-black leading-snug">Sẵn sàng cho trận cầu tiếp theo?</h2>
                        <p className="mt-2 text-xs leading-relaxed text-emerald-50/90">
                            Đăng nhập tài khoản để đặt sân nhanh chóng, nhận ưu đãi sinh viên và theo dõi lịch chơi tiện lợi.
                        </p>
                    </div>

                    <div className="relative flex items-center gap-2.5 text-xs text-emerald-100/90 pt-2 border-t border-white/15">
                        <ShieldCheck className="h-4 w-4 text-lime-300 shrink-0" />
                        <span>Bảo mật thông tin tài khoản người dùng</span>
                    </div>
                </aside>

                <div className="px-6 py-10 sm:px-10 sm:py-12">
                    <div className="mb-9 md:hidden">
                        <div className="mb-6 flex items-center gap-3">
                            <img src="/logo-hue.jpg" alt="Logo Trường Đại học Kinh tế Huế" className="h-12 w-12 rounded-full object-contain bg-white p-0.5 shadow-md border border-emerald-100" />
                            <div>
                                <p className="text-base font-bold text-gray-900">SÂN CẦU LÔNG HUẾ</p>
                                <p className="text-xs text-emerald-700">Trường Đại học Kinh tế Huế</p>
                            </div>
                        </div>
                    </div>
                    <div className="mb-8">
                        <p className="mb-2 text-sm font-semibold text-emerald-700">Tài khoản khách hàng</p>
                        <h2 className="text-3xl font-bold tracking-tight text-slate-900">Đăng nhập</h2>
                        <p className="mt-2 text-sm leading-6 text-slate-500">Dùng email hoặc số điện thoại đã đăng ký.</p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-5">
                        <div>
                            <label htmlFor="portal-identifier" className="mb-2 block text-sm font-semibold text-slate-700">
                                Email hoặc số điện thoại
                            </label>
                            <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 px-3.5 transition focus-within:border-emerald-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-emerald-500/10">
                                <Mail className="h-5 w-5 shrink-0 text-slate-400" />
                                <input
                                    id="portal-identifier"
                                    type="text"
                                    required
                                    autoComplete="username"
                                    value={identifier}
                                    onChange={(event) => setIdentifier(event.target.value)}
                                    placeholder="ten@email.com hoặc 09..."
                                    className="w-full bg-transparent px-3 py-3.5 text-sm text-slate-900 outline-none placeholder:text-slate-400"
                                />
                            </div>
                        </div>

                        <div>
                            <div className="mb-2 flex items-center justify-between">
                                <label htmlFor="portal-password" className="text-sm font-semibold text-slate-700">Mật khẩu</label>
                                <Link to="/client-forgot-password" className="text-xs font-semibold text-emerald-700 transition hover:text-emerald-800">
                                    Quên mật khẩu?
                                </Link>
                            </div>
                            <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 px-3.5 transition focus-within:border-emerald-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-emerald-500/10">
                                <LockKeyhole className="h-5 w-5 shrink-0 text-slate-400" />
                                <input
                                    id="portal-password"
                                    type={showPassword ? 'text' : 'password'}
                                    required
                                    autoComplete="current-password"
                                    value={password}
                                    onChange={(event) => setPassword(event.target.value)}
                                    placeholder="Nhập mật khẩu"
                                    className="w-full bg-transparent px-3 py-3.5 text-sm text-slate-900 outline-none placeholder:text-slate-400"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword((visible) => !visible)}
                                    aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                                    className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
                                >
                                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                </button>
                            </div>
                        </div>

                        {errorMessage && (
                            <p role="alert" className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                                {errorMessage}
                            </p>
                        )}

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="group flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-700/20 transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {isLoading ? 'Đang đăng nhập...' : 'Đăng nhập'}
                            {!isLoading && <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />}
                        </button>
                    </form>

                    <div className="mt-8 border-t border-slate-100 pt-6 text-center text-sm text-slate-500">
                        Chưa có tài khoản?{' '}
                        <Link to="/dang-ky" className="font-bold text-emerald-700 hover:text-emerald-800">Tạo tài khoản</Link>
                    </div>
                </div>
            </section>
        </main>
    );
}
