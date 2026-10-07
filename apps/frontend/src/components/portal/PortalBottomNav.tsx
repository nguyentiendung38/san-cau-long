import { Home, MapPin, Compass, Flame, User } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

export function PortalBottomNav() {
    const navigate = useNavigate();
    const location = useLocation();

    // Determine active tab based on query params or path
    const searchParams = new URLSearchParams(location.search);
    let activeTab = searchParams.get('tab') || 'home';
    const exploreFilter = searchParams.get('filter') || 'all';

    // If we are not on the main /trang-chu page, let's treat the route itself as an indicator
    // But since the bottom nav is going to be displayed everywhere, clicking a tab MUST navigate to /trang-chu
    const isMainPage = location.pathname === '/trang-chu';

    if (!isMainPage) {
        // We can just keep 'home' active or nothing active depending on the page
        // Actually, if we are on /chon-san, we might want 'home' to be active, but let's just use empty string or infer from URL.
        activeTab = ''; 
    }

    const handleTabClick = (tab: string, filter?: string) => {
        let url = `/trang-chu?tab=${tab}`;
        if (filter) {
            url += `&filter=${filter}`;
        }
        navigate(url);
    };

    return (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex justify-around items-end pb-[max(env(safe-area-inset-bottom),8px)] pt-2 z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
            <button onClick={() => handleTabClick('home')} className={`flex flex-col items-center w-16 group ${activeTab === 'home' ? 'text-[#19b251]' : 'text-gray-400 hover:text-[#19b251]'}`}>
                <Home className="w-5 h-5 mb-1" />
                <span className="text-[10px] font-bold">Trang chủ</span>
            </button>
            <button onClick={() => handleTabClick('map')} className={`flex flex-col items-center w-16 group ${activeTab === 'map' ? 'text-[#19b251]' : 'text-gray-400 hover:text-[#19b251]'}`}>
                <MapPin className="w-5 h-5 mb-1" />
                <span className="text-[10px] font-bold">Bản đồ</span>
            </button>
            
            {/* Floating Khám phá button */}
            <div className="relative -top-3">
                <button onClick={() => handleTabClick('explore')} className={`w-[48px] h-[48px] rounded-full flex flex-col items-center justify-center shadow-[0_4px_15px_rgba(25,178,81,0.2)] border-[1.5px] transition-all bg-white ${activeTab === 'explore' ? 'border-[#19b251] text-[#19b251]' : 'border-[#19b251]/20 text-[#19b251]'}`}>
                    <Compass className="w-5 h-5" />
                </button>
                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 text-[10px] font-bold text-[#19b251] whitespace-nowrap">Khám phá</div>
            </div>
            
            <button onClick={() => handleTabClick('explore', 'hot')} className={`flex flex-col items-center w-16 group ${activeTab === 'explore' && exploreFilter !== 'all' ? 'text-[#19b251]' : 'text-gray-400 hover:text-[#19b251]'}`}>
                <Flame className="w-5 h-5 mb-1" />
                <span className="text-[10px] font-bold">Nổi bật</span>
            </button>
            <button onClick={() => handleTabClick('account')} className={`flex flex-col items-center w-16 group ${activeTab === 'account' ? 'text-[#19b251]' : 'text-gray-400 hover:text-[#19b251]'}`}>
                <User className="w-5 h-5 mb-1" />
                <span className="text-[10px] font-bold">Tài khoản</span>
            </button>
        </div>
    );
}
