import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
    Search, MapPin, Map, CalendarCheck, Heart, User, Home, Flame, Compass, 
    Settings2, Calendar, ChevronRight, Info, ShieldCheck, Sparkles, Globe, X, ChevronLeft,
    Star, Navigation, Clock, CalendarDays, Bell, BookOpen, Gift, LogOut
} from 'lucide-react';
import { venueApi, courtApi, Venue, Court } from '@/services/venue.service';
import { ChatBotWidget } from '@/components/chatbot/ChatBotWidget';
import { PortalBookingVisual } from './PortalBookingVisual';
import { bookingRequestApi } from '@/services/booking.service';
import { useToast } from '@/hooks/use-toast';
import { exploreContentPublicApi, ExploreContent, ExploreContentType, TYPE_LABELS, TYPE_ICONS } from '@/services/explore-content.service';

const TIME_SLOTS: string[] = [];
for (let h = 6; h <= 23; h++) {
    const hour = h.toString().padStart(2, '0');
    TIME_SLOTS.push(`${hour}:00`);
    if (h !== 23) {
        TIME_SLOTS.push(`${hour}:30`);
    }
}

export default function PortalPage() {
    const [activeTab, setActiveTab] = useState<'home' | 'account' | 'map' | 'explore' | 'history'>('home');
    const [exploreFilter, setExploreFilter] = useState<string>('all');
    
    const [venues, setVenues] = useState<Venue[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterMode, setFilterMode] = useState<'all' | 'booked' | 'favorite'>('all');



    const [viewingVenueDetail, setViewingVenueDetail] = useState<Venue | null>(null);
    const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
    const [venueCourts, setVenueCourts] = useState<Court[]>([]);
    const [loadingCourts, setLoadingCourts] = useState(false);
    
    const [bookingCourt, setBookingCourt] = useState<Court | null>(null);
    const [bookingForm, setBookingForm] = useState({
        name: '', phone: '', date: '', startTime: '', endTime: '', notes: ''
    });

    
    const [favToast, setFavToast] = useState<{show: boolean, isAdd: boolean, id: number}>({ show: false, isAdd: true, id: 0 });

    const [favoriteVenueIds, setFavoriteVenueIds] = useState<string[]>(() => {
        try { return JSON.parse(localStorage.getItem('portal_favorites') || '[]'); } catch { return []; }
    });
    const [bookedVenueIds, setBookedVenueIds] = useState<string[]>(() => {
        try { return JSON.parse(localStorage.getItem('portal_booked') || '[]'); } catch { return []; }
    });

        const toggleFavorite = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setFavoriteVenueIds(prev => {
            const isRemoving = prev.includes(id);
            const next = isRemoving ? prev.filter(v => v !== id) : [...prev, id];
            localStorage.setItem('portal_favorites', JSON.stringify(next));
            
            setFavToast({ show: true, isAdd: !isRemoving, id: Date.now() });
            
            return next;
        });
    };

    // Auto hide toast
    useEffect(() => {
        if (favToast.show) {
            const timer = setTimeout(() => setFavToast(prev => ({...prev, show: false})), 3000);
            return () => clearTimeout(timer);
        }
    }, [favToast.id, favToast.show]);
    
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const navigate = useNavigate();
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const { data: exploreItems = [] } = useQuery<ExploreContent[]>({
        queryKey: ['explore-contents-public', exploreFilter],
        queryFn: () => exploreContentPublicApi.getAll(exploreFilter === 'all' ? undefined : exploreFilter.toUpperCase()),
        enabled: activeTab === 'explore',
    });

    const [userPhone, setUserPhone] = useState(localStorage.getItem('portalUserPhone') || '');
    const [tempPhone, setTempPhone] = useState('');
    const { data: myRequests = [], isLoading: isLoadingRequests } = useQuery<any[]>({
        queryKey: ['my-requests', userPhone],
        queryFn: () => bookingRequestApi.getMyRequests(userPhone),
        enabled: activeTab === 'history' && !!userPhone,
    });

    const getByType = (type: ExploreContentType) => exploreItems.filter(item => item.type === type);

    const handleBookingSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedVenue || !bookingCourt) return;
        
        if (bookingForm.startTime < '06:00' || bookingForm.endTime > '23:00' || bookingForm.endTime <= bookingForm.startTime) {
            toast({
                title: 'Khung giờ không hợp lệ',
                description: 'Vui lòng chọn giờ từ 06:00 đến 23:00, và giờ kết thúc phải lớn hơn giờ bắt đầu.',
                variant: 'error',
            });
            return;
        }

        const now = new Date();
        const todayString = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const currentTimeString = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

        if (bookingForm.date < todayString || (bookingForm.date === todayString && bookingForm.startTime < currentTimeString)) {
            toast({
                title: 'Không thể chọn giờ quá khứ',
                description: 'Vui lòng chọn khung giờ trong tương lai.',
                variant: 'error',
            });
            return;
        }

        setIsSubmitting(true);
        try {
            await bookingRequestApi.createPublic({
                ...bookingForm,
                venueId: selectedVenue.id,
                courtId: bookingCourt.id,
            });
            toast({
                title: 'Gửi yêu cầu thành công!',
                description: 'Chúng tôi sẽ liên hệ lại để xác nhận lịch đặt của bạn.',
            });
            localStorage.setItem('portalUserPhone', bookingForm.phone);
            setUserPhone(bookingForm.phone);
            queryClient.invalidateQueries({ queryKey: ['my-requests'] });
            setBookedVenueIds(prev => {
                if (!prev.includes(selectedVenue.id)) {
                    const next = [...prev, selectedVenue.id];
                    localStorage.setItem('portal_booked', JSON.stringify(next));
                    return next;
                }
                return prev;
            });
            setBookingCourt(null);
            setBookingForm({ name: '', phone: '', date: '', startTime: '', endTime: '', notes: '' });
        } catch (error) {
            toast({
                title: 'Lỗi',
                description: 'Đã có lỗi xảy ra, vui lòng thử lại.',
                variant: 'error',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSelectVenue = async (venue: Venue) => {
        setSelectedVenue(venue);
        setLoadingCourts(true);
        try {
            const res = await courtApi.getByVenue(venue.id);
            setVenueCourts(res);
        } catch (error) {
            console.error('Failed to fetch courts', error);
        } finally {
            setLoadingCourts(false);
        }
    };

    useEffect(() => {
        const handlePhoneUpdate = () => {
            const savedPhone = localStorage.getItem('portalUserPhone');
            if (savedPhone) setUserPhone(savedPhone);
        };
        window.addEventListener('portal-phone-updated', handlePhoneUpdate);
        return () => window.removeEventListener('portal-phone-updated', handlePhoneUpdate);
    }, []);

    useEffect(() => {
        const fetchVenues = async () => {
            try {
                const res = await venueApi.getAll();
                setVenues(res.data || []);
            } catch (error) {
                console.error('Failed to fetch venues', error);
            } finally {
                setLoading(false);
            }
        };
        fetchVenues();
    }, []);

    const filteredVenues = venues.filter(v => {
        const matchesSearch = v.name.toLowerCase().includes(searchQuery.toLowerCase()) || (v.address && v.address.toLowerCase().includes(searchQuery.toLowerCase()));
        if (!matchesSearch) return false;
        
        if (filterMode === 'favorite') {
            return favoriteVenueIds.includes(v.id);
        }
        if (filterMode === 'booked') {
            return bookedVenueIds.includes(v.id);
        }
        return true;
    });

    const now = new Date();
    const todayString = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const currentTimeString = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const getDayName = () => {
        const days = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
        return days[now.getDay()];
    };

    const formatDate = () => {
        return `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
    };

    const portalCustomerName = (() => {
        try {
            const user = JSON.parse(localStorage.getItem('portalUser') || '{}');
            return user.name || 'Khách';
        } catch {
            return 'Khách';
        }
    })();

    const handleLogout = () => {
        localStorage.removeItem('portalUserToken');
        localStorage.removeItem('portalUser');
        window.location.reload();
    };

    return (
        <div className="min-h-screen bg-[#f3f4f6] flex flex-col font-sans selection:bg-[#19b251]/30">
            {/* Custom Fav Toast */}
            <div className={`fixed top-20 right-4 z-[9999] transition-all duration-300 transform ${favToast.show ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0 pointer-events-none'}`}>
                <div className="bg-[#f0fdf4] border border-[#86efac] shadow-lg rounded-xl p-4 flex items-start gap-3 min-w-[300px]">
                    <div className="mt-0.5 w-6 h-6 rounded-full border border-gray-800 flex items-center justify-center shrink-0">
                        <svg className="w-4 h-4 text-gray-800" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <div className="flex-1">
                        <div className="font-medium text-gray-800">Thông báo</div>
                        <div className="text-gray-500 text-sm mt-0.5">
                            {favToast.isAdd ? 'Đã thêm vào danh sách yêu thích' : 'Đã xóa khỏi danh sách yêu thích'}
                        </div>
                    </div>
                    <button onClick={() => setFavToast(prev => ({...prev, show: false}))} className="text-gray-400 hover:text-gray-600">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Top Header */}
            <header className="bg-[#129b46] px-4 py-2.5 text-white sticky top-0 z-40 shadow-sm">
                <div className="max-w-[1400px] mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-100 rounded-full flex flex-col items-center justify-center text-[#129b46] font-black italic shadow-inner border border-white/20">
                            {portalCustomerName !== 'Khách' ? portalCustomerName.charAt(0).toUpperCase() : 'K'}
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[11px] font-medium text-green-100 tracking-wide">{getDayName()}, {formatDate()}</span>
                            <span className="font-bold text-sm tracking-wide text-white">{portalCustomerName !== 'Khách' ? portalCustomerName : 'KHÁCH'}</span>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        {portalCustomerName === 'Khách' ? (
                            <>
                                <button onClick={() => navigate('/client-login')} className="bg-white text-[#129b46] px-5 py-1.5 rounded-full text-sm font-bold shadow-sm hover:bg-gray-50 transition">
                                    Đăng nhập
                                </button>
                                <button onClick={() => navigate('/register')} className="bg-transparent border border-white text-white px-5 py-1.5 rounded-full text-sm font-bold hover:bg-white/10 transition">
                                    Đăng kí
                                </button>
                            </>
                        ) : (
                            <button onClick={handleLogout} className="bg-white/20 hover:bg-white/30 text-white px-4 py-1.5 rounded-full text-sm font-bold transition">
                                Đăng xuất
                            </button>
                        )}
                    </div>
                </div>
            </header>

            {/* Main Content Areas */}
            {activeTab === 'home' && (
                <div className="flex flex-col flex-1 pb-24 px-4 pt-4 max-w-[1400px] mx-auto w-full">
                    
                    {/* Search & Actions Bar (White pill container - wider and less rounded) */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-5 flex flex-col md:flex-row items-center p-2 relative z-10 w-full h-[52px]">
                        <div className="relative flex-1 w-full flex items-center pl-3">
                            <div className="w-7 h-7 bg-green-50 text-[#19b251] rounded-full flex items-center justify-center mr-2 shrink-0">
                                <Search className="w-4 h-4" />
                            </div>
                            <input 
                                type="text"
                                placeholder="Tìm kiếm..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full bg-transparent text-gray-800 py-1.5 pr-4 focus:outline-none font-medium text-sm"
                            />
                        </div>
                        <div className="flex items-center gap-4 px-4 h-full md:border-l border-gray-200 text-gray-500 text-sm font-medium">
                            <button className="flex items-center justify-center hover:text-[#19b251] transition shrink-0 px-2">
                                <Settings2 className="w-4 h-4" />
                            </button>
                            <div className="w-px h-5 bg-gray-200 mx-1 hidden md:block"></div>
                            <button onClick={() => setActiveTab('map')} className="flex items-center gap-1.5 hover:text-[#19b251] transition-colors whitespace-nowrap">
                                <Map className="w-4 h-4" />
                                <span>Bản đồ</span>
                            </button>
                            <div className="w-px h-5 bg-gray-200 mx-1 hidden md:block"></div>
                            <button className="flex items-center gap-1.5 hover:text-[#19b251] transition-colors whitespace-nowrap">
                                <CalendarCheck className="w-4 h-4" />
                                <span>Sân đã đặt</span>
                            </button>
                            <div className="w-px h-5 bg-gray-200 mx-1 hidden md:block"></div>
                            <button className="flex items-center gap-1.5 hover:text-[#19b251] transition-colors whitespace-nowrap">
                                <Heart className="w-4 h-4" />
                                <span>Yêu thích</span>
                            </button>
                        </div>
                    </div>

                    {/* Banner Cố Định - Sharper corners, smaller height */}
                    <div className="bg-gradient-to-r from-[#0d8f3e] to-[#16a54f] rounded-xl p-8 md:p-10 text-white relative overflow-hidden shadow-sm flex flex-col items-center justify-center text-center mb-6 min-h-[220px]">
                        <span className="absolute top-4 left-4 px-2 py-1 bg-[#ff4757] text-white text-[10px] font-black rounded-md shadow-sm uppercase">HOT</span>
                        
                        <h2 className="text-3xl md:text-4xl lg:text-5xl font-black italic tracking-wide uppercase drop-shadow-sm leading-tight z-10">
                            QUẢN LÝ SÂN CẦU LÔNG <br/> TRƯỜNG ĐẠI HỌC KINH TẾ HUẾ
                        </h2>
                        <p className="mt-3 font-bold text-sm md:text-base tracking-wide drop-shadow-sm opacity-95 z-10">
                            Hệ thống đặt sân nhanh chóng & tiện lợi
                        </p>
                    </div>

                    {/* Danh sách Sân (Venues) */}
                    <div className="w-full">
                        {loading ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {[1,2,3].map(i => (
                                    <div key={i} className="animate-pulse flex flex-col gap-3">
                                        <div className="bg-gray-200 h-44 rounded-xl"></div>
                                        <div className="bg-gray-200 h-5 w-3/4 rounded mt-2"></div>
                                        <div className="bg-gray-200 h-4 w-1/2 rounded"></div>
                                    </div>
                                ))}
                            </div>
                        ) : filteredVenues.length === 0 ? (
                            <div className="text-center py-12">
                                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <Search className="w-6 h-6 text-gray-400" />
                                </div>
                                <p className="text-gray-500 font-medium">Không tìm thấy cơ sở nào</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                                {filteredVenues.map((venue) => {
                                    const isFav = favoriteVenueIds.includes(venue.id);
                                    
                                    return (
                                        <div key={venue.id} className="group bg-white rounded-xl overflow-hidden border border-gray-200 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col">
                                            {/* Image Section */}
                                            <div className="h-40 relative bg-gray-100 cursor-pointer overflow-hidden border-b border-gray-100" onClick={() => handleSelectVenue(venue)}>
                                                <img 
                                                    src={venue.logo || "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?q=80&w=800&auto=format&fit=crop"} 
                                                    alt={venue.name} 
                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                                                />
                                                
                                                {/* Top-left Badges */}
                                                <div className="absolute top-2.5 left-2.5 flex items-center">
                                                    <div className="flex items-center bg-[#0d8f3e] text-white rounded-full pr-2.5 shadow-sm z-10 h-6">
                                                        <div className="w-4 h-4 bg-white rounded-full flex items-center justify-center ml-1">
                                                            <Star className="w-2.5 h-2.5 text-gray-400 fill-gray-400" />
                                                        </div>
                                                        <span className="text-[10px] font-bold ml-1 tracking-wide">Đơn ngày</span>
                                                    </div>
                                                    <div className="bg-[#d946ef] text-white text-[10px] font-bold px-3 py-1 rounded-r-full shadow-sm -ml-2.5 pl-4 h-6 flex items-center">
                                                        Sự kiện
                                                    </div>
                                                </div>
                                                
                                                {/* Top-Right Buttons */}
                                                <div className="absolute top-2.5 right-2.5 flex gap-1.5">
                                                    <button onClick={(e) => toggleFavorite(venue.id, e)} className="w-7 h-7 bg-white rounded-full flex items-center justify-center shadow-sm hover:bg-gray-50 transition-colors">
                                                        <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-[#ea580c] text-[#ea580c]' : 'text-[#064e3b]'}`} />
                                                    </button>
                                                    <button className="w-7 h-7 bg-white rounded-full flex items-center justify-center shadow-sm hover:bg-gray-50 transition-colors">
                                                        <Navigation className="w-3.5 h-3.5 text-[#064e3b] transform rotate-45" />
                                                    </button>
                                                </div>
                                            </div>
                                            
                                            {/* Info Section */}
                                            <div className="flex items-center gap-3 p-3.5">
                                                {/* Logo icon */}
                                                <div className="w-10 h-10 shrink-0 bg-white rounded-full border border-gray-100 p-1 flex items-center justify-center overflow-hidden">
                                                    <img src="https://cdn-icons-png.flaticon.com/512/7576/7576974.png" alt="logo" className="w-full h-full object-contain" />
                                                </div>
                                                
                                                {/* Info Text */}
                                                <div className="flex-1 min-w-0 flex flex-col justify-center">
                                                    <h4 className="font-bold text-[#064e3b] text-sm line-clamp-1 cursor-pointer hover:text-[#19b251] transition-colors" onClick={() => handleSelectVenue(venue)}>
                                                        {venue.name.toUpperCase()}
                                                    </h4>
                                                    <div className="flex items-center gap-1 mt-0.5 text-[11px]">
                                                        <span className="font-medium text-[#f97316] shrink-0">(74.0km)</span>
                                                        <span className="text-gray-500 line-clamp-1">{venue.address}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1 mt-0.5 text-[#064e3b] text-[11px] font-medium">
                                                        <Clock className="w-3 h-3" />
                                                        <span>05:00 - 23:30</span>
                                                    </div>
                                                </div>
                                                
                                                {/* Direct Booking Button */}
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); handleSelectVenue(venue); }} 
                                                    className="shrink-0 bg-[#eab308] hover:bg-[#ca8a04] text-white font-bold tracking-wide py-1.5 px-3 rounded-md text-xs shadow-sm transition-colors ml-1"
                                                >
                                                    ĐẶT LỊCH
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Bottom Nav */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex justify-around items-end pb-[max(env(safe-area-inset-bottom),8px)] pt-2 z-50">
                <button onClick={() => setActiveTab('home')} className={`flex flex-col items-center w-16 group ${activeTab === 'home' ? 'text-[#19b251]' : 'text-gray-400 hover:text-[#19b251]'}`}>
                    <Home className="w-5 h-5 mb-1" />
                    <span className="text-[10px] font-bold">Trang chủ</span>
                </button>
                <button onClick={() => setActiveTab('map')} className={`flex flex-col items-center w-16 group ${activeTab === 'map' ? 'text-[#19b251]' : 'text-gray-400 hover:text-[#19b251]'}`}>
                    <MapPin className="w-5 h-5 mb-1" />
                    <span className="text-[10px] font-bold">Bản đồ</span>
                </button>
                
                {/* Floating Khám phá button */}
                <div className="relative -top-3">
                    <button onClick={() => setActiveTab('explore')} className={`w-[48px] h-[48px] rounded-full flex flex-col items-center justify-center shadow-[0_4px_15px_rgba(25,178,81,0.2)] border-[1.5px] transition-all bg-white ${activeTab === 'explore' ? 'border-[#19b251] text-[#19b251]' : 'border-[#19b251]/20 text-[#19b251]'}`}>
                        <Compass className="w-5 h-5" />
                    </button>
                    <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 text-[10px] font-bold text-[#19b251] whitespace-nowrap">Khám phá</div>
                </div>
                
                <button onClick={() => setActiveTab('explore')} className={`flex flex-col items-center w-16 group ${activeTab === 'explore' && exploreFilter !== 'all' ? 'text-[#19b251]' : 'text-gray-400 hover:text-[#19b251]'}`}>
                    <Flame className="w-5 h-5 mb-1" />
                    <span className="text-[10px] font-bold">Nổi bật</span>
                </button>
                <button onClick={() => setActiveTab('account')} className={`flex flex-col items-center w-16 group ${activeTab === 'account' ? 'text-[#19b251]' : 'text-gray-400 hover:text-[#19b251]'}`}>
                    <User className="w-5 h-5 mb-1" />
                    <span className="text-[10px] font-bold">Tài khoản</span>
                </button>
            </div>

            {/* Map View */}
            {activeTab === 'map' && !selectedVenue && (
                <div className="flex flex-col min-h-[calc(100vh-80px)] pb-24">
                    <div className="flex-1 relative">
                        <iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3826.6404207967107!2d107.60194437592682!3d16.443078629319736!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3141a165ca6ab627%3A0xf296b18480a09d08!2zVHLGsOG7nW5nIMSQ4bqhaSBo4buNYyBLaW5oIHThur8sIMSQ4bqhaSBo4buNYyBIdeG6vw!5e0!3m2!1svi!2s!4v1790410473151!5m2!1svi!2s" width="100%" height="100%" style={{ border: 0, minHeight: '80vh' }} allowFullScreen={true} loading="lazy"></iframe>
                    </div>
                </div>
            )}

            {/* Account View */}
            {activeTab === 'account' && !selectedVenue && (
                <div className="flex flex-col min-h-[calc(100vh-80px)] bg-gray-50 max-w-[1400px] mx-auto w-full pb-24 px-4 pt-6">
                    <h2 className="font-bold text-2xl text-gray-800 mb-6">Tài khoản của tôi</h2>
                    
                    {/* User Profile Card */}
                    <div className="bg-white rounded-2xl p-6 flex items-center gap-4 border border-gray-100 shadow-sm mb-6">
                        <div className="w-16 h-16 bg-[#19b251] rounded-full flex flex-col items-center justify-center text-white font-bold text-3xl shadow-sm">
                            {portalCustomerName !== 'Khách' ? portalCustomerName.charAt(0).toUpperCase() : 'K'}
                        </div>
                        <div className="flex-1">
                            <h3 className="font-bold text-xl text-gray-800">{portalCustomerName}</h3>
                            <p className="text-sm text-gray-500">{portalCustomerName !== 'Khách' ? 'Khách hàng thành viên' : 'Khách vãng lai'}</p>
                        </div>
                    </div>

                    {/* Menu Items */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-6">
                        <button className="w-full flex items-center gap-4 p-4 border-b border-gray-50 hover:bg-gray-50 transition text-left" onClick={() => {
                            const savedPhone = localStorage.getItem('portalUserPhone');
                            if (savedPhone) {
                                setUserPhone(savedPhone);
                            }
                            setActiveTab('history');
                        }}>
                            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                                <CalendarDays className="w-5 h-5" />
                            </div>
                            <div className="flex-1">
                                <h4 className="font-bold text-gray-800">Lịch đã đặt</h4>
                                <p className="text-xs text-gray-500">Quản lý các sân bạn đã đặt</p>
                            </div>
                            <ChevronRight className="w-5 h-5 text-gray-400" />
                        </button>

                        <button className="w-full flex items-center gap-4 p-4 border-b border-gray-50 hover:bg-gray-50 transition text-left" onClick={() => { setActiveTab('explore'); setExploreFilter('news') }}>
                            <div className="w-10 h-10 rounded-full bg-yellow-50 flex items-center justify-center text-yellow-600">
                                <Bell className="w-5 h-5" />
                            </div>
                            <div className="flex-1">
                                <h4 className="font-bold text-gray-800">Thông báo</h4>
                                <p className="text-xs text-gray-500">Cập nhật tin tức mới nhất</p>
                            </div>
                            <ChevronRight className="w-5 h-5 text-gray-400" />
                        </button>

                        <button className="w-full flex items-center gap-4 p-4 border-b border-gray-50 hover:bg-gray-50 transition text-left" onClick={() => { setActiveTab('explore'); setExploreFilter('course') }}>
                            <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center text-purple-600">
                                <BookOpen className="w-5 h-5" />
                            </div>
                            <div className="flex-1">
                                <h4 className="font-bold text-gray-800">Khóa học</h4>
                                <p className="text-xs text-gray-500">Các lớp học cầu lông</p>
                            </div>
                            <ChevronRight className="w-5 h-5 text-gray-400" />
                        </button>

                        <button className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 transition text-left" onClick={() => { setActiveTab('explore'); setExploreFilter('deal') }}>
                            <div className="w-10 h-10 rounded-full bg-pink-50 flex items-center justify-center text-pink-600">
                                <Gift className="w-5 h-5" />
                            </div>
                            <div className="flex-1">
                                <h4 className="font-bold text-gray-800">Ưu đãi của tôi</h4>
                                <p className="text-xs text-gray-500">Voucher và khuyến mãi</p>
                            </div>
                            <ChevronRight className="w-5 h-5 text-gray-400" />
                        </button>
                    </div>

                    {/* Logout Button */}
                    {portalCustomerName !== 'Khách' ? (
                        <button onClick={handleLogout} className="w-full bg-red-50 text-red-600 font-bold py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-red-100 transition border border-red-100">
                            <LogOut className="w-5 h-5" />
                            Đăng xuất
                        </button>
                    ) : (
                        <button onClick={() => navigate('/client-login')} className="w-full bg-[#19b251] text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-[#129b46] transition shadow-md">
                            <User className="w-5 h-5" />
                            Đăng nhập
                        </button>
                    )}
                </div>
            )}

            {/* Explore View */}
            {activeTab === 'explore' && !selectedVenue && (
                <div className="flex flex-col min-h-[calc(100vh-80px)] pb-24 bg-gray-50 px-4 pt-6 max-w-[1400px] mx-auto w-full">
                    <h1 className="font-black text-2xl italic tracking-widest uppercase mb-4 text-gray-800">Khám phá nội dung</h1>
                    
                    {/* Filter chips */}
                    <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide -mx-4 px-4 mb-2">
                        <button
                            onClick={() => setExploreFilter('all')}
                            className={`shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold border transition-all ${
                                exploreFilter === 'all'
                                    ? 'bg-[#19b251] text-white border-[#19b251] shadow-md'
                                    : 'bg-white text-gray-600 border-gray-200 hover:border-[#19b251]'
                            }`}
                        >
                            Tất cả
                        </button>
                        {(['EVENT', 'MEMBERSHIP', 'COURSE', 'NEWS', 'DEAL', 'PASS'] as ExploreContentType[]).map(type => (
                            <button
                                key={type}
                                onClick={() => setExploreFilter(type.toLowerCase())}
                                className={`shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold border transition-all ${
                                    exploreFilter === type.toLowerCase()
                                        ? 'bg-[#19b251] text-white border-[#19b251] shadow-md'
                                        : 'bg-white text-gray-600 border-gray-200 hover:border-[#19b251]'
                                }`}
                            >
                                <span>{TYPE_ICONS[type]}</span>
                                {TYPE_LABELS[type]}
                            </button>
                        ))}
                    </div>

                    <div className="flex-1">
                        {exploreItems.length === 0 ? (
                            <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
                                <p className="text-gray-500 font-medium">Chưa có nội dung cho chuyên mục này</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {exploreItems.map(item => (
                                    <div key={item.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col hover:shadow-md transition-shadow">
                                        <div className="flex items-start justify-between mb-2">
                                            <span className="flex items-center gap-1 text-xs font-bold bg-green-50 text-green-700 px-2.5 py-1 rounded-full">
                                                {TYPE_ICONS[item.type as ExploreContentType]} {TYPE_LABELS[item.type as ExploreContentType]}
                                            </span>
                                            {item.badge && (
                                                <span className="text-xs font-bold bg-[#19b251] text-white px-2 py-1 rounded-full">{item.badge}</span>
                                            )}
                                        </div>
                                        <h3 className="font-bold text-gray-800 text-lg leading-tight mb-2">{item.title}</h3>
                                        {item.description && (
                                            <p className="text-sm text-gray-500 mb-3 flex-1">{item.description}</p>
                                        )}
                                        {item.price && (
                                            <p className="font-black text-[#19b251] text-lg mt-auto">{item.price}</p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* History View */}
            {activeTab === 'history' && !selectedVenue && (
                <div className="flex flex-col min-h-[calc(100vh-80px)] pb-24 bg-gray-50 px-4 pt-6 max-w-[1400px] mx-auto w-full">
                    <div className="flex items-center gap-3 mb-6">
                        <button onClick={() => setActiveTab('account')} className="p-2 bg-white rounded-full shadow-sm">
                            <ChevronLeft className="w-5 h-5 text-gray-800" />
                        </button>
                        <h1 className="font-black text-2xl tracking-tight text-gray-800">Lịch đã đặt</h1>
                    </div>
                    <div className="flex-1">
                        {!userPhone ? (
                            <div className="text-center py-20 bg-white rounded-2xl border border-gray-100 flex flex-col items-center">
                                <User className="w-16 h-16 text-gray-300 mb-4" />
                                <p className="text-gray-500 font-medium mb-4">Vui lòng nhập số điện thoại để tra cứu lịch đặt</p>
                                <div className="flex items-center gap-2 max-w-sm w-full mx-auto">
                                    <input
                                        type="tel"
                                        placeholder="Nhập số điện thoại..."
                                        value={tempPhone}
                                        onChange={(e) => setTempPhone(e.target.value)}
                                        className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-[#19b251]"
                                    />
                                    <button
                                        onClick={() => {
                                            if (tempPhone) {
                                                localStorage.setItem('portalUserPhone', tempPhone);
                                                setUserPhone(tempPhone);
                                            }
                                        }}
                                        className="px-6 py-2 bg-[#19b251] text-white font-bold rounded-full"
                                    >
                                        Tra cứu
                                    </button>
                                </div>
                            </div>
                        ) : isLoadingRequests ? (
                            <div className="flex justify-center py-20">
                                <div className="w-8 h-8 border-4 border-[#19b251] border-t-transparent rounded-full animate-spin"></div>
                            </div>
                        ) : myRequests.length === 0 ? (
                            <div className="text-center py-20 bg-white rounded-2xl border border-gray-100 flex flex-col items-center">
                                <CalendarDays className="w-16 h-16 text-gray-300 mb-4" />
                                <p className="text-gray-500 font-medium">Bạn chưa đặt sân nào</p>
                                <button onClick={() => setActiveTab('home')} className="mt-4 px-6 py-2 bg-[#19b251] text-white font-bold rounded-full text-sm">Đặt sân ngay</button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {myRequests.map((req: any) => (
                                    <div key={req.id} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
                                        <div className="p-4 border-b border-gray-50 flex justify-between items-start">
                                            <div>
                                                <h3 className="font-bold text-gray-800">{req.venue?.name || 'Sân cầu lông'}</h3>
                                                <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                                                    <MapPin className="w-3 h-3" /> {req.venue?.address || 'Đang cập nhật'}
                                                </p>
                                            </div>
                                            <div className={`px-2 py-1 rounded text-xs font-bold ${
                                                req.status === 'PENDING' ? 'bg-orange-100 text-orange-600' :
                                                req.status === 'APPROVED' ? 'bg-green-100 text-green-600' :
                                                req.status === 'REJECTED' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'
                                            }`}>
                                                {req.status === 'PENDING' ? 'Chờ xác nhận' :
                                                 req.status === 'APPROVED' ? 'Đã xác nhận' :
                                                 req.status === 'REJECTED' ? 'Đã hủy' : req.status}
                                            </div>
                                        </div>
                                        <div className="p-4 bg-gray-50/50 space-y-2 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-gray-500">Sân:</span>
                                                <span className="font-semibold text-gray-800">{req.court?.name || 'Chưa xếp sân'}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-500">Ngày đặt:</span>
                                                <span className="font-semibold text-gray-800">{new Date(req.date).toLocaleDateString('vi-VN')}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-500">Thời gian:</span>
                                                <span className="font-semibold text-[#19b251]">{req.startTime} - {req.endTime}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Modal */}
            {viewingVenueDetail && (
                <div className="fixed inset-0 z-[100] bg-[#f3f4f6] flex flex-col animate-in fade-in slide-in-from-bottom-10 duration-300 overflow-y-auto">
                    
                    {/* Banner */}
                    <div className="relative h-[250px] w-full shrink-0">
                        <img src="/court-a1.jpg" alt="Banner" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/20"></div>
                        
                        {/* Top controls */}
                        <div className="absolute top-4 left-4 right-4 flex justify-between items-start">
                            <button onClick={() => setViewingVenueDetail(null)} className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-md hover:bg-gray-100 transition-colors">
                                <ChevronLeft className="w-6 h-6 text-gray-700" />
                            </button>
                            
                            <div className="flex items-center gap-2">
                                <button className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-md hover:bg-gray-100 transition-colors">
                                    <svg className="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                                </button>
                                <button className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-md hover:bg-gray-100 transition-colors">
                                    <Heart className="w-5 h-5 text-gray-700" />
                                </button>
                                <button 
                                    onClick={() => { setSelectedVenue(viewingVenueDetail); setViewingVenueDetail(null); }}
                                    className="px-6 h-10 bg-[#eab308] hover:bg-yellow-500 text-white font-bold rounded-full shadow-md transition-colors ml-2"
                                >
                                    �?t l?ch
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Info Card */}
                    <div className="relative -mt-10 mx-4 bg-white rounded-2xl shadow-sm p-4 flex gap-4 shrink-0 border border-gray-100">
                        <div className="w-16 h-16 rounded-full border border-gray-200 p-2 shrink-0 bg-white shadow-sm flex items-center justify-center">
                            <img src="/court-a1.jpg" className="w-full h-full object-cover rounded-full" />
                        </div>
                        <div className="flex-1">
                            <h2 className="font-bold text-[17px] text-gray-800 uppercase leading-tight mb-1">{viewingVenueDetail.name}</h2>
                            <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border border-[#19b251] text-[#19b251] text-xs font-semibold bg-green-50 mb-3">
                                <MapPin className="w-3 h-3" /> C?u l�ng
                            </div>
                            
                            <div className="flex flex-col gap-2 text-sm text-gray-600">
                                <div className="flex items-start gap-2">
                                    <MapPin className="w-4 h-4 shrink-0 text-[#19b251] mt-0.5" />
                                    <span>{viewingVenueDetail.address}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Clock className="w-4 h-4 shrink-0 text-[#19b251]" />
                                    <span>{viewingVenueDetail.openTime} - {viewingVenueDetail.closeTime}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <svg className="w-4 h-4 shrink-0 text-[#19b251]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                                    <span className="text-[#19b251] font-medium cursor-pointer">Li�n h?</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex overflow-x-auto bg-white border-b border-gray-200 mt-4 px-4 sticky top-0 z-10 scrollbar-hide shrink-0">
                        <button className="whitespace-nowrap px-4 py-3 text-sm font-medium border-b-2 transition-colors border-transparent text-gray-500 hover:text-gray-700">Thông tin</button>
                        <button className="whitespace-nowrap px-4 py-3 text-sm font-medium border-b-2 transition-colors border-transparent text-gray-500 hover:text-gray-700">Gói hội viên</button>
                        <button className="whitespace-nowrap px-4 py-3 text-sm font-medium border-b-2 transition-colors border-[#19b251] text-[#19b251]">Dịch vụ</button>
                        <button className="whitespace-nowrap px-4 py-3 text-sm font-medium border-b-2 transition-colors border-transparent text-gray-500 hover:text-gray-700">Hình ảnh</button>
                        <button className="whitespace-nowrap px-4 py-3 text-sm font-medium border-b-2 transition-colors border-transparent text-gray-500 hover:text-gray-700">Điều khoản & quy định</button>
                        <button className="whitespace-nowrap px-4 py-3 text-sm font-medium border-b-2 transition-colors border-transparent text-gray-500 hover:text-gray-700">Đánh giá</button>
                    </div>

                    {/* Content */}
                    <div className="p-4 bg-white flex-1">
                        <h3 className="font-bold text-gray-800 text-[15px] uppercase mb-4 text-[#19b251]">BᲡNG GIÁ SÂN</h3>
                        
                        <div className="border border-gray-200 rounded-lg overflow-hidden">
                            <div className="bg-white px-4 py-3 border-b border-gray-200 font-bold text-sm text-gray-800 text-center">
                                Sân Cầu Lông
                            </div>
                            <table className="w-full text-sm text-center">
                                <thead className="bg-white border-b border-gray-200 text-gray-800 font-bold">
                                    <tr>
                                        <th className="py-3 px-2 border-r border-gray-200 font-bold">Thứ</th>
                                        <th className="py-3 px-2 border-r border-gray-200 font-bold">Khung giờ</th>
                                        <th className="py-3 px-2 border-b border-gray-200 font-bold">Cố định</th>
                                        <th className="py-3 px-2 font-bold">Vãng lai</th>
                                    </tr>
                                </thead>
                                <tbody className="text-gray-600 bg-white">
                                    <tr className="border-b border-gray-200">
                                        <td className="py-3 px-2 border-r border-gray-200 font-medium" rowSpan={3}>T2 - T6</td>
                                        <td className="py-3 px-2 border-r border-gray-200 border-b border-200">9h - 15h</td>
                                        <td className="py-3 px-2 border-r border-gray-200 border-b border-200">45.000 đ</td>
                                        <td className="py-3 px-2 border-b border-g200">50.000 đ</td>
                                    </tr>
                                    <tr className="border-b border-gray-200">
                                        <td className="py-3 px-2 border-r border-gray-200 border-b border-200">17h - 19h</td>
                                        <td className="py-3 px-2 border-r border-gray-200 border-b border-200">90.000 đ</td>
                                        <td className="py-3 px-2 border-b border-g200">95.000 đ</td>
                                    </tr>
                                    <tr className="border-b border-gray-200">
                                        <td className="py-3 px-2 border-r border-gray-200">19h - 21h30</td>
                                        <td className="py-3 px-2 border-r border-gray-200">85.000 đ</td>
                                        <td className="py-3 px-2">90.000 đ</td>
                                    </tr>
                                </tbody>
                        </table>
                    </div>
                </div>

                {bookingCourt && viewingVenueDetail && (
                    <PortalBookingVisual venue={viewingVenueDetail} onClose={() => setBookingCourt(null)} />
                )}
            </div>
        )}

        {/* Booking Modal (Old List of Courts) */}
            {selectedVenue && (
                <div className="fixed inset-0 z-[100] bg-white flex flex-col animate-in fade-in slide-in-from-bottom-10 duration-300">
                    <div className="flex items-center gap-4 p-4 border-b border-gray-100 bg-white shadow-sm">
                        <button onClick={() => setSelectedVenue(null)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors">
                            <X className="w-6 h-6 text-gray-600" />
                        </button>
                        <div>
                            <h2 className="font-bold text-lg text-gray-800 leading-tight">{selectedVenue.name}</h2>
                            <p className="text-sm text-gray-500">{selectedVenue.address}</p>
                        </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
                        <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <MapPin className="w-5 h-5 text-[#19b251]" />
                            Danh sách sân trống
                        </h3>
                        
                        {loadingCourts ? (
                            <div className="flex justify-center p-10"><div className="w-8 h-8 border-4 border-[#19b251] border-t-transparent rounded-full animate-spin"></div></div>
                        ) : venueCourts.length === 0 ? (
                            <div className="text-center p-10 bg-white rounded-xl shadow-sm border border-gray-100">
                                <p className="text-gray-500">Chưa có dữ liệu sân.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {venueCourts.map(court => (
                                    <div key={court.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex flex-col gap-3 hover:shadow-md transition-shadow overflow-hidden">
                                        <div className="-mt-4 -mx-4 mb-0 h-40 sm:h-36 bg-gray-100 relative">
                                            <img 
                                                src={
                                                    court.name.includes('A1') ? '/court-a1.jpg' : 
                                                    court.name.includes('A2') ? '/court-a2.jpg' : 
                                                    court.name.includes('A3') ? '/court-a3.jpg' : 
                                                    court.name.includes('A4') ? '/court-a4.jpg' : 
                                                    '/court-a1.jpg'
                                                }
                                                alt={court.name}
                                                className="w-full h-full object-cover"
                                            />
                                            <div className="absolute top-3 right-3">
                                                <span className="text-[10px] font-bold px-2.5 py-1.5 bg-green-100/90 backdrop-blur-sm text-[#19b251] rounded-lg border border-green-200">SẴN SÀNG</span>
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-start mt-1">
                                            <div>
                                                <h4 className="font-bold text-gray-800 text-lg">{court.name}</h4>
                                                <p className="text-xs text-gray-500 mt-0.5">{court.description || 'Sân tiêu chuẩn thi đấu'}</p>
                                            </div>
                                        </div>
                                        <button onClick={() => setBookingCourt(court)} className="w-full bg-[#19b251] hover:bg-green-600 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors mt-1 shadow-sm">
                                            Chọn giờ & Đặt sân
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    
                    {bookingCourt && selectedVenue && (
                        <PortalBookingVisual venue={selectedVenue} onClose={() => setBookingCourt(null)} />
                    )}
                </div>
            )}

<ChatBotWidget />
        </div>
    );
}
