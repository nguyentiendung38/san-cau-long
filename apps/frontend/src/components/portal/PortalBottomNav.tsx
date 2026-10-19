import { Flame, Home, MapPin, Compass, UserRound } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

const items = [
    { id: 'home', label: 'Trang chủ', Icon: Home },
    { id: 'map', label: 'Bản đồ', Icon: MapPin },
    { id: 'explore', label: 'Khám phá', Icon: Compass },
    { id: 'featured_courts', label: 'Nổi bật', Icon: Flame },
    { id: 'account', label: 'Tài khoản', Icon: UserRound },
];

export function PortalBottomNav() {
    const navigate = useNavigate();
    const location = useLocation();
    const requestedTab = new URLSearchParams(location.search).get('tab') || 'home';
    const activeTab = location.pathname === '/trang-chu' ? requestedTab : '';

    const handleTabClick = (tab: string) => {
        navigate(`/trang-chu?tab=${tab}`);
    };

    return (
        <nav aria-label="Điều hướng chính" className="fixed inset-x-0 bottom-0 z-50 px-3 pb-[max(env(safe-area-inset-bottom),10px)] pt-2">
            <div className="mx-auto flex max-w-xl items-center justify-around rounded-2xl border border-slate-200/80 bg-white/95 px-1 py-1.5 shadow-[0_10px_40px_rgba(15,23,42,0.14)] backdrop-blur-xl">
                {items.map(({ id, label, Icon }) => {
                    const isActive = activeTab === id;
                    return (
                        <button
                            key={id}
                            type="button"
                            onClick={() => handleTabClick(id)}
                            aria-current={isActive ? 'page' : undefined}
                            className={`flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl px-1 py-2 transition ${
                                isActive ? 'bg-emerald-50 text-emerald-700' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-700'
                            }`}
                        >
                            <Icon className={`h-5 w-5 ${isActive ? 'stroke-[2.5]' : ''}`} />
                            <span className="truncate text-[10px] font-semibold sm:text-[11px]">{label}</span>
                        </button>
                    );
                })}
            </div>
        </nav>
    );
}
