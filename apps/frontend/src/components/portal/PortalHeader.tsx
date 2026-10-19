import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, ChevronDown, Compass, LogOut, MapPin, Sparkles, UserRound } from 'lucide-react';

export function PortalHeader() {
    const navigate = useNavigate();
    const [customerName, setCustomerName] = useState('');
    const [menuOpen, setMenuOpen] = useState(false);

    useEffect(() => {
        const readCustomer = () => {
            const userString = localStorage.getItem('portalUser');
            if (!userString || !localStorage.getItem('portalUserToken')) {
                setCustomerName('');
                return;
            }
            try {
                const user = JSON.parse(userString);
                setCustomerName(typeof user.name === 'string' ? user.name : '');
            } catch {
                setCustomerName('');
            }
        };
        readCustomer();
        window.addEventListener('storage', readCustomer);
        return () => window.removeEventListener('storage', readCustomer);
    }, []);

    const goToTab = (tab: string) => {
        setMenuOpen(false);
        navigate(`/trang-chu?tab=${tab}`);
    };

    const handleLogout = () => {
        localStorage.removeItem('portalUserToken');
        localStorage.removeItem('portalUser');
        localStorage.removeItem('portalUserId');
        localStorage.removeItem('portalUserPhone');
        setCustomerName('');
        setMenuOpen(false);
        window.dispatchEvent(new Event('storage'));
        navigate('/trang-chu');
    };

    return (
        <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 px-4 shadow-sm shadow-slate-900/[0.03] backdrop-blur-xl sm:px-6">
            <div className="mx-auto flex h-[68px] max-w-7xl items-center justify-between gap-4">
                <button
                    type="button"
                    onClick={() => navigate('/trang-chu')}
                    className="flex shrink-0 items-center gap-2.5"
                    aria-label="Courtify - Trang chủ"
                >
                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-green-700 text-white shadow-md shadow-emerald-700/20">
                        <Sparkles className="h-5 w-5" />
                    </span>
                    <span className="text-lg font-black tracking-tight text-slate-900">Courtify</span>
                </button>

                <nav className="hidden items-center gap-1 lg:flex" aria-label="Menu chính">
                    <button onClick={() => goToTab('home')} className="rounded-xl px-3.5 py-2 text-sm font-semibold text-slate-600 transition hover:bg-emerald-50 hover:text-emerald-700">
                        Trang chủ
                    </button>
                    <button onClick={() => goToTab('map')} className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold text-slate-600 transition hover:bg-emerald-50 hover:text-emerald-700">
                        <MapPin className="h-4 w-4" /> Bản đồ
                    </button>
                    <button onClick={() => goToTab('explore')} className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold text-slate-600 transition hover:bg-emerald-50 hover:text-emerald-700">
                        <Compass className="h-4 w-4" /> Khám phá
                    </button>
                </nav>

                {customerName ? (
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => setMenuOpen((open) => !open)}
                            aria-expanded={menuOpen}
                            aria-haspopup="menu"
                            className="flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1.5 pl-1.5 pr-3 transition hover:border-emerald-200 hover:bg-emerald-50/50"
                        >
                            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-800">
                                {customerName.charAt(0).toUpperCase()}
                            </span>
                            <span className="hidden max-w-32 truncate text-sm font-semibold text-slate-700 sm:block">{customerName}</span>
                            <ChevronDown className={`h-4 w-4 text-slate-400 transition ${menuOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {menuOpen && (
                            <div role="menu" className="absolute right-0 top-full mt-3 w-60 overflow-hidden rounded-2xl border border-slate-100 bg-white p-2 shadow-xl shadow-slate-900/10">
                                <div className="border-b border-slate-100 px-3 py-3">
                                    <p className="text-xs font-medium text-slate-400">Xin chào</p>
                                    <p className="mt-0.5 truncate text-sm font-bold text-slate-800">{customerName}</p>
                                </div>
                                <button role="menuitem" onClick={() => goToTab('account')} className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-emerald-700">
                                    <UserRound className="h-4 w-4" /> Tài khoản của tôi
                                </button>
                                <button role="menuitem" onClick={() => goToTab('history')} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-emerald-700">
                                    <CalendarDays className="h-4 w-4" /> Lịch đã đặt
                                </button>
                                <button role="menuitem" onClick={handleLogout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-rose-600 transition hover:bg-rose-50">
                                    <LogOut className="h-4 w-4" /> Đăng xuất
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex items-center gap-2">
                        <button onClick={() => navigate('/dang-nhap')} className="rounded-full px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 sm:px-4">
                            Đăng nhập
                        </button>
                        <button onClick={() => navigate('/dang-ky')} className="rounded-full bg-emerald-700 px-4 py-2 text-sm font-bold text-white shadow-md shadow-emerald-700/15 transition hover:bg-emerald-800">
                            Đăng ký
                        </button>
                    </div>
                )}
            </div>
        </header>
    );
}
