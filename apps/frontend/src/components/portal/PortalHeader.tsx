import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';

export function PortalHeader() {
    const navigate = useNavigate();
    const [portalCustomerName, setPortalCustomerName] = useState('Khách');
    const [now] = useState(new Date());

    useEffect(() => {
        const fetchUser = () => {
            const userStr = localStorage.getItem('portalUser');
            if (userStr) {
                try {
                    const user = JSON.parse(userStr);
                    if (user.name) setPortalCustomerName(user.name);
                } catch (e) {
                    // Ignore
                }
            } else {
                setPortalCustomerName('Khách');
            }
        };
        fetchUser();

        // Listen for storage events (if login happens in another tab or we want to update)
        window.addEventListener('storage', fetchUser);
        return () => window.removeEventListener('storage', fetchUser);
    }, []);

    const getDayName = () => {
        const days = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
        return days[now.getDay()];
    };

    const formatDate = () => {
        const day = String(now.getDate()).padStart(2, '0');
        const month = String(now.getMonth() + 1).padStart(2, '0');
        return `${day}/${month}`;
    };

    const handleLogout = () => {
        localStorage.removeItem('portalUserToken');
        localStorage.removeItem('portalUser');
        localStorage.removeItem('portalUserId');
        localStorage.removeItem('portalUserPhone');
        setPortalCustomerName('Khách');
        navigate('/trang-chu');
    };

    return (
        <header className="bg-white px-4 py-2.5 text-black border-b border-gray-100 sticky top-0 z-40 shadow-sm">
            <div className="max-w-[1400px] mx-auto flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white rounded-full flex flex-col items-center justify-center text-black font-black italic shadow-inner border border-gray-200">
                        {portalCustomerName !== 'Khách' ? portalCustomerName.charAt(0).toUpperCase() : 'K'}
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[11px] font-medium text-gray-500 tracking-wide">{getDayName()}, {formatDate()}</span>
                        <span className="font-bold text-sm tracking-wide text-black">{portalCustomerName !== 'Khách' ? portalCustomerName : 'KHÁCH'}</span>
                    </div>
                </div>
                
                <div className="flex items-center gap-2">
                    {portalCustomerName === 'Khách' ? (
                        <>
                            <button onClick={() => navigate('/dang-nhap')} className="bg-white text-black px-5 py-1.5 rounded-full text-sm font-bold shadow-sm hover:bg-gray-50 transition">
                                Đăng nhập
                            </button>
                            <button onClick={() => navigate('/dang-ky')} className="bg-transparent border border-gray-300 text-black px-5 py-1.5 rounded-full text-sm font-bold hover:bg-gray-100 transition">
                                Đăng kí
                            </button>
                        </>
                    ) : (
                        <button onClick={handleLogout} className="bg-gray-100 hover:bg-gray-200 text-black px-4 py-1.5 rounded-full text-sm font-bold transition">
                            Đăng xuất
                        </button>
                    )}
                </div>
            </div>
        </header>
    );
}
