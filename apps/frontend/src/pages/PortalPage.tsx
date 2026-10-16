import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
    Search, MapPin, Map, CalendarCheck, Heart, User, Home, Flame, Compass, 
    Settings2, Calendar, ChevronRight, Info, ShieldCheck, Sparkles, Globe, X, ChevronLeft,
    Star, Navigation, Clock, CalendarDays, Bell, BookOpen, Gift, LogOut, Phone
} from 'lucide-react';
import { venueApi, courtApi, Venue, Court } from '@/services/venue.service';
import { ChatBotWidget } from '@/components/chatbot/ChatBotWidget';
import { bookingRequestApi } from '@/services/booking.service';
import { useToast } from '@/hooks/use-toast';
import { exploreContentPublicApi, ExploreContent, ExploreContentType, TYPE_LABELS, TYPE_ICONS } from '@/services/explore-content.service';
import { venueReviewApi } from '@/services/venue-review.service';

const TIME_SLOTS: string[] = [];
for (let h = 6; h <= 23; h++) {
    const hour = h.toString().padStart(2, '0');
    TIME_SLOTS.push(`${hour}:00`);
    if (h !== 23) {
        TIME_SLOTS.push(`${hour}:30`);
    }
}

const formatVnd = (amount: number) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

const readReviewImage = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Không thể đọc ảnh ${file.name}`));
    reader.onload = () => {
        const image = new Image();
        image.onerror = () => reject(new Error(`Ảnh ${file.name} không hợp lệ`));
        image.onload = () => {
            const maxSize = 1200;
            const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(image.width * scale);
            canvas.height = Math.round(image.height * scale);
            const context = canvas.getContext('2d');
            if (!context) {
                reject(new Error('Trình duyệt không hỗ trợ xử lý ảnh'));
                return;
            }
            context.drawImage(image, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/jpeg', 0.78));
        };
        image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
});


const getOperatingStatus = (venue: any) => {
    if (!venue.operatingHours || venue.operatingHours.length === 0) {
        return { text: "Chưa cập nhật giờ", isOpen: false };
    }
    let minH = 24, minM = 59;
    let maxH = 0, maxM = 0;
    
    venue.operatingHours.forEach((oh: any) => {
        const [sH, sM] = oh.startTime.split(':').map(Number);
        const [eH, eM] = oh.endTime.split(':').map(Number);
        
        if (sH < minH || (sH === minH && sM < minM)) { minH = sH; minM = sM; }
        if (eH > maxH || (eH === maxH && eM > maxM)) { maxH = eH; maxM = eM; }
    });
    
    const now = new Date();
    const currH = now.getHours();
    const currM = now.getMinutes();
    
    const startMins = minH * 60 + minM;
    const endMins = maxH * 60 + maxM;
    const currMins = currH * 60 + currM;
    
    const isOpen = currMins >= startMins && currMins <= endMins;
    
    const pad = (n: number) => n.toString().padStart(2, '0');
    return {
        text: `${pad(minH)}:${pad(minM)} - ${pad(maxH)}:${pad(maxM)}`,
        isOpen
    };
};

export default function PortalPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = (searchParams.get('tab') as 'home' | 'account' | 'map' | 'explore' | 'history' | 'featured_courts') || 'home';
    const navigate = useNavigate();

    const setActiveTab = (tab: string) => {
        navigate(`/trang-chu?tab=${tab}`);
    };
    const [exploreFilter, setExploreFilter] = useState<string>('all');
    
    const [venues, setVenues] = useState<Venue[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterMode, setFilterMode] = useState<'all' | 'booked' | 'favorite'>('all');
    const [selectedVenueDetail, setSelectedVenueDetail] = useState<Venue | null>(null);
    const [activeModalTab, setActiveModalTab] = useState<'info' | 'services' | 'images' | 'reviews'>('info');
    const [venueDetailLoading, setVenueDetailLoading] = useState(false);
    const [reviewName, setReviewName] = useState(() => {
        try { return JSON.parse(localStorage.getItem('portalUser') || '{}').name || ''; } catch { return ''; }
    });
    const [reviewPhone, setReviewPhone] = useState(() => localStorage.getItem('portalUserPhone') || '');
    const [reviewRating, setReviewRating] = useState(5);
    const [reviewContent, setReviewContent] = useState('');
    const [reviewImages, setReviewImages] = useState<string[]>([]);
    const [reviewSubmitting, setReviewSubmitting] = useState(false);

    
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
            const timer = setTimeout(() => setFavToast(prev => ({...prev, show: false})), 3005);
            return () => clearTimeout(timer);
        }
    }, [favToast.id, favToast.show]);
    
    
    const { toast } = useToast();
    
    useEffect(() => {
        const paymentStatus = searchParams.get('payment');
        if (paymentStatus === 'success') {
            setTimeout(() => toast({
                title: 'Thanh toán VNPAY thành công!',
                description: 'Cảm ơn bạn. Đơn đặt sân đã được xác nhận.',
                variant: 'success',
            }), 300);
        } else if (paymentStatus === 'failed') {
            setTimeout(() => toast({ title: 'Thanh toán VNPay thất bại hoặc bị hủy.', variant: 'error' }), 300);
        } else {
            return;
        }

        const nextSearchParams = new URLSearchParams(searchParams);
        nextSearchParams.delete('payment');
        setSearchParams(nextSearchParams, { replace: true });
    }, [searchParams, setSearchParams, toast]);
    
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
        queryFn: () => bookingRequestApi.getMyRequests(userPhone).then(data => data.filter((b: any) => !b.notes?.includes("Zalo"))),
        enabled: activeTab === 'history' && !!userPhone,
    });
    const { data: venueReviews = [], isLoading: isLoadingReviews } = useQuery({
        queryKey: ['venue-reviews-public', selectedVenueDetail?.id],
        queryFn: () => venueReviewApi.getPublic(selectedVenueDetail!.id),
        enabled: !!selectedVenueDetail && activeModalTab === 'reviews',
    });

    const getByType = (type: ExploreContentType) => exploreItems.filter(item => item.type === type);


    const handleSelectVenue = (venue: Venue) => {
        navigate(`/dat-lich/${venue.id}`);
    };

    const openVenueDetail = async (venue: Venue) => {
        setSelectedVenueDetail(venue);
        setActiveModalTab('info');
        setVenueDetailLoading(true);
        try {
            setSelectedVenueDetail(await venueApi.getById(venue.id));
        } catch (error: any) {
            toast({
                title: 'Không thể tải thông tin sân',
                description: error?.response?.data?.message || 'Vui lòng thử lại sau.',
                variant: 'error',
            });
        } finally {
            setVenueDetailLoading(false);
        }
    };

    const handleReviewImageChange = async (files: FileList | null) => {
        if (!files?.length) return;
        const selectedFiles = Array.from(files);
        if (reviewImages.length + selectedFiles.length > 5) {
            toast({ title: 'Chỉ được tải tối đa 5 hình ảnh', variant: 'error' });
            return;
        }
        if (selectedFiles.some((file) => !file.type.startsWith('image/'))) {
            toast({ title: 'Vui lòng chỉ chọn tệp hình ảnh', variant: 'error' });
            return;
        }
        try {
            const encodedImages = await Promise.all(selectedFiles.map(readReviewImage));
            setReviewImages((current) => [...current, ...encodedImages]);
        } catch (error) {
            toast({
                title: 'Không thể tải hình ảnh',
                description: error instanceof Error ? error.message : 'Vui lòng thử lại.',
                variant: 'error',
            });
        }
    };

    const submitVenueReview = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!selectedVenueDetail) return;
        if (!reviewName.trim() || !reviewPhone.trim() || !reviewContent.trim()) {
            toast({ title: 'Vui lòng nhập tên, số điện thoại và nội dung đánh giá', variant: 'error' });
            return;
        }
        setReviewSubmitting(true);
        try {
            await venueReviewApi.createPublic({
                venueId: selectedVenueDetail.id,
                customerName: reviewName.trim(),
                customerPhone: reviewPhone.trim(),
                rating: reviewRating,
                content: reviewContent.trim(),
                images: reviewImages,
            });
            toast({
                title: 'Đã gửi đánh giá',
                variant: 'success',
            });
            setReviewContent('');
            setReviewImages([]);
            queryClient.invalidateQueries({ queryKey: ['venue-reviews-public', selectedVenueDetail.id] });
            setActiveModalTab('info');
            setSelectedVenueDetail(null);
        } catch (error: any) {
            toast({
                title: 'Không thể gửi đánh giá',
                description: error?.response?.data?.message || 'Vui lòng thử lại sau.',
                variant: 'error',
            });
        } finally {
            setReviewSubmitting(false);
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
                const venueList = res.data || [];
                setVenues(venueList);

                const venueIds = venueList.map((venue) => venue.id);
                try {
                    let summaries;
                    try {
                        summaries = await venueReviewApi.getPublicSummaries(venueIds);
                    } catch (summaryError) {
                        console.warn('Unable to load venue review summaries; falling back to public reviews', summaryError);
                        const reviewResults = await Promise.allSettled(
                            venueList.map((venue) => venueReviewApi.getPublic(venue.id)),
                        );
                        summaries = reviewResults.flatMap((result, index) => {
                            if (result.status === 'rejected') {
                                console.warn(`Unable to load public reviews for venue ${venueIds[index]}`, result.reason);
                                return [];
                            }
                            if (result.value.length === 0) return [];
                            const ratingAverage = result.value.reduce((total, review) => total + review.rating, 0) / result.value.length;
                            return [{ venueId: venueIds[index], ratingAverage, reviewCount: result.value.length }];
                        });
                    }

                    const summariesByVenueId = new Map(summaries.map((summary) => [summary.venueId, summary]));
                    setVenues(venueList.map((venue) => {
                        const summary = summariesByVenueId.get(venue.id);
                        return {
                            ...venue,
                            ratingAverage: summary?.ratingAverage ?? null,
                            reviewCount: summary?.reviewCount ?? 0,
                        };
                    }));
                } catch (summaryError) {
                    console.warn('Unable to update venue ratings; keeping the venue list visible', summaryError);
                }
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

    const filteredCourts = venues.flatMap(v => {
        return (v.courts || []).map((c: any) => ({
            ...c,
            venue: v
        }));
    }).filter((c: any) => {
        const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
            (c.venue.name && c.venue.name.toLowerCase().includes(searchQuery.toLowerCase()));
        if (!matchesSearch) return false;
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
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-100 to-slate-200 flex flex-col font-sans selection:bg-[#19b251]/30">
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
                            <button onClick={() => {
                                const savedPhone = localStorage.getItem('portalUserPhone');
                                if (savedPhone) setUserPhone(savedPhone);
                                setActiveTab('history');
                            }} className="flex items-center gap-1.5 hover:text-[#19b251] transition-colors whitespace-nowrap">
                                <CalendarCheck className="w-4 h-4" />
                                <span>Sân đã đặt</span>
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
                                    return (
                                        <div key={venue.id} className="group bg-white rounded-xl overflow-hidden border border-gray-200 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col">
                                            {/* Image Section */}
                                            <div className="h-40 relative bg-gray-100 cursor-pointer overflow-hidden border-b border-gray-100" onClick={() => void openVenueDetail(venue)}>
                                                <img 
                                                    src={venue.logo || "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?q=80&w=800&auto=format&fit=crop"} 
                                                    alt={venue.name} 
                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                                                />
                                                {!!venue.reviewCount && (
                                                    <div className="absolute top-3 right-3 flex items-center gap-1.5 rounded-full bg-black/75 px-2.5 py-1.5 text-white shadow-md backdrop-blur-sm">
                                                        <div className="flex items-center" aria-label={`Đánh giá ${venue.ratingAverage?.toFixed(1)} trên 5 sao`}>
                                                            {[1, 2, 3, 4, 5].map((star) => (
                                                                <Star
                                                                    key={star}
                                                                    className={`h-3.5 w-3.5 ${star <= Math.round(venue.ratingAverage || 0) ? 'fill-yellow-400 text-yellow-400' : 'text-white/60'}`}
                                                                />
                                                            ))}
                                                        </div>
                                                        <span className="text-xs font-bold">{venue.ratingAverage?.toFixed(1)}</span>
                                                    </div>
                                                )}
                                            </div>
                                            
                                            {/* Info Section */}
                                            <div className="flex items-center gap-3 p-3.5">
                                                {/* Logo icon */}
                                                <div className="w-10 h-10 shrink-0 bg-white rounded-full border border-gray-100 p-1 flex items-center justify-center overflow-hidden">
                                                    <img src="https://cdn-icons-png.flaticon.com/512/7576/7576974.png" alt="logo" className="w-full h-full object-contain" />
                                                </div>
                                                
                                                {/* Info Text */}
                                                <div className="flex-1 min-w-0 flex flex-col justify-center">
                                                    <h4 className="font-bold text-[#064e3b] text-sm line-clamp-1 cursor-pointer hover:text-[#19b251] transition-colors" onClick={() => void openVenueDetail(venue)}>
                                                        {venue.name.toUpperCase()}
                                                    </h4>
                                                    <div className="flex items-center gap-1 mt-0.5 text-[11px]">
                                                        <span className="font-medium text-[#f97316] shrink-0">(74.0km)</span>
                                                        <span className="text-gray-500 line-clamp-1">{venue.address}</span>
                                                    </div>
                                                    
                                                    {(() => {
                                                        const status = getOperatingStatus(venue);
                                                        return (
                                                            <div className="flex items-center gap-1.5 mt-0.5 text-[11px] font-medium">
                                                                <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${status.isOpen ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                                    <div className={`w-1.5 h-1.5 rounded-full ${status.isOpen ? 'bg-green-500' : 'bg-red-500'}`} />
                                                                    <span>{status.isOpen ? 'Đang mở cửa' : 'Đóng cửa'}</span>
                                                                </div>
                                                                <div className="flex items-center gap-1 text-gray-500">
                                                                    <Clock className="w-3 h-3" />
                                                                    <span>{status.text}</span>
                                                                </div>
                                                            </div>
                                                        );
                                                    })()}

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

            {/* Map View */}
            {activeTab === 'map' && (
                <div className="flex flex-col min-h-[calc(100vh-80px)] pb-24">
                    <div className="flex-1 relative">
                        <iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3826.6404207967107!2d107.60194437592682!3d16.443078629319736!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3141a165ca6ab627%3A0xf296b18480a09d08!2zVHLGsOG7nW5nIMSQ4bqhaSBo4buNYyBLaW5oIHThur8sIMSQ4bqhaSBo4buNYyBIdeG6vw!5e0!3m2!1svi!2s!4v1790410473151!5m2!1svi!2s" width="100%" height="100%" style={{ border: 0, minHeight: '80vh' }} allowFullScreen={true} loading="lazy"></iframe>
                    </div>
                </div>
            )}

            {/* Account View */}
            {activeTab === 'account' && (
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

                        
                    </div>

                </div>
            )}

            {/* Explore View */}
            {activeTab === 'explore' && (
                <div className="flex flex-col min-h-[calc(100vh-80px)] pb-24 bg-gray-50 px-4 pt-6 max-w-[1400px] mx-auto w-full">
                    <div className="flex items-center gap-3 mb-4">
                        <button onClick={() => setActiveTab('account')} className="p-2 bg-white rounded-full shadow-sm shrink-0">
                            <ChevronLeft className="w-5 h-5 text-gray-800" />
                        </button>
                        <h1 className="font-black text-2xl italic tracking-widest uppercase text-gray-800">Khám phá nội dung</h1>
                    </div>
                    
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
                        {(['EVENT', 'COURSE', 'NEWS', 'DEAL', 'PASS'] as ExploreContentType[]).map(type => (
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
                                        <div className="mt-auto pt-3 flex items-center justify-between">
                                            {item.price ? (
                                                <p className="font-black text-[#19b251] text-lg">{item.price}</p>
                                            ) : <div />}
                                            {(() => {
                                                if (!item.metadata) return null;
                                                try {
                                                    const meta = JSON.parse(item.metadata);
                                                    if (meta.actionUrl) {
                                                        return (
                                                            <a href={meta.actionUrl} target="_blank" rel="noopener noreferrer" className="px-4 py-1.5 bg-[#19b251] text-white text-sm font-bold rounded-full hover:bg-[#159a45] transition-colors">
                                                                {meta.actionText || 'Xem chi tiết'}
                                                            </a>
                                                        );
                                                    }
                                                } catch(e) {}
                                                return null;
                                            })()}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            
            {/* Featured Courts View */}
            {activeTab === 'featured_courts' && (
                <div className="flex flex-col min-h-[calc(100vh-80px)] pb-24 bg-gray-50 px-4 pt-6 max-w-[1400px] mx-auto w-full">
                    <div className="flex items-center gap-3 mb-6">
                        <button onClick={() => setActiveTab('home')} className="p-2 bg-white rounded-full shadow-sm">
                            <ChevronLeft className="w-5 h-5 text-gray-800" />
                        </button>
                        <h1 className="font-black text-2xl tracking-tight text-gray-800">Sân Nổi Bật</h1>
                    </div>
                    
                    <div className="flex-1">
                        {loading ? (
                            <div className="flex justify-center py-20">
                                <div className="w-8 h-8 border-4 border-[#19b251] border-t-transparent rounded-full animate-spin"></div>
                            </div>
                        ) : filteredCourts.length === 0 ? (
                            <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
                                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <Flame className="w-6 h-6 text-gray-400" />
                                </div>
                                <p className="text-gray-500 font-medium">Chưa có sân nào</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                                {filteredCourts.map((court) => {
                                    return (
                                        <div key={court.id} className="group bg-white rounded-xl overflow-hidden border border-gray-200 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col">
                                            <div className="h-40 relative bg-gray-100 cursor-pointer overflow-hidden border-b border-gray-100" onClick={() => handleSelectVenue(court.venue)}>
                                                <img 
                                                    src={court.venue.logo || "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&q=80&w=800"} 
                                                    alt={court.name} 
                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                                                />
                                                <div className="absolute top-3 left-3 bg-[#ff4757] text-white text-[10px] font-black px-2 py-1 rounded shadow-sm uppercase">HOT</div>
                                            </div>
                                            
                                            <div className="flex items-center gap-3 p-3.5">
                                                <div className="w-10 h-10 shrink-0 bg-white rounded-full border border-gray-100 flex items-center justify-center overflow-hidden text-2xl">
                                                    🏸
                                                </div>
                                                
                                                <div className="flex-1 min-w-0 flex flex-col justify-center">
                                                    <h4 className="font-bold text-[#064e3b] text-base line-clamp-1 cursor-pointer hover:text-[#19b251] transition-colors" onClick={() => handleSelectVenue(court.venue)}>
                                                        {court.name}
                                                    </h4>
                                                    <div className="flex items-center gap-1 mt-0.5 text-[11px]">
                                                        <span className="text-gray-500 font-bold line-clamp-1">{court.venue.name}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1 mt-0.5 text-[#064e3b] text-[11px] font-medium">
                                                        <MapPin className="w-3 h-3 shrink-0" />
                                                        <span className="line-clamp-1">{court.venue.address}</span>
                                                    </div>
                                                </div>
                                                
                                                <div className="shrink-0">
                                                    <button onClick={() => handleSelectVenue(court.venue)} className="w-10 h-10 rounded-full bg-[#f0fdf4] text-[#19b251] flex items-center justify-center hover:bg-[#19b251] hover:text-white transition-colors">
                                                        <ChevronRight className="w-5 h-5" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}


            {/* History View */}
            {activeTab === 'history' && (
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
                                            <div className="flex justify-between">
                                                <span className="text-gray-500">Thanh toán:</span>
                                                <span className={`font-semibold ${req.paymentStatus === 'PAID' ? 'text-green-600' : 'text-orange-500'}`}>
                                                    {req.paymentStatus === 'PAID' ? 'Đã thanh toán' : 'Chưa thanh toán'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Modal Chi tiết cơ sở sân - ALO Booking Style */}
            {selectedVenueDetail && (
                <div
                    className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
                    onClick={() => {
                        setSelectedVenueDetail(null);
                        setActiveModalTab('info');
                    }}
                >
                    <div
                        className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden border border-gray-100 flex flex-col relative animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* 1. Phần Đầu: Ảnh bìa (Cover Image) & Nút đóng X */}
                        <div className="relative h-48 sm:h-56 w-full bg-gray-100 overflow-hidden">
                            <img
                                src={selectedVenueDetail.logo || "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?q=80&w=800&auto=format&fit=crop"}
                                alt={selectedVenueDetail.name}
                                className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/30" />

                            {/* Nút (X) Close tròn mờ góc phải */}
                            <button
                                onClick={() => {
                                    setSelectedVenueDetail(null);
                                    setActiveModalTab('info');
                                }}
                                className="absolute top-4 right-4 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-black/50 hover:bg-black/75 text-white flex items-center justify-center transition-all backdrop-blur-md cursor-pointer shadow-md"
                                aria-label="Đóng"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* 2. Phần Profile & Nội dung với padding rộng rãi */}
                        <div className="p-6 sm:p-8 pt-0 sm:pt-0">
                            {/* Thẻ div bọc chung Logo và Tên sân */}
                            <div className="flex flex-row items-start gap-4 -mt-12 mb-5">
                                {/* Logo to trồi lên ảnh bìa */}
                                <div className="w-24 h-24 rounded-full border-4 border-white bg-white shadow-lg p-1.5 overflow-hidden shrink-0 flex items-center justify-center relative z-10">
                                    <img src="/images/courts/logo.jpg" alt="Logo HCE" className="w-full h-full object-contain p-1" />
                                </div>
                                {/* Tên sân & Tag đẩy xuống hẳn nền trắng */}
                                <div className="flex-1 min-w-0 pt-12 sm:pt-14">
                                    <h3 className="text-2xl font-black text-gray-900 break-words leading-tight">
                                        {selectedVenueDetail.name}
                                    </h3>
                                    <div className="flex items-center gap-2 mt-1.5">
                                        <span className="text-xs font-semibold text-[#19b251] bg-green-50 border border-green-200 px-3 py-0.5 rounded-full inline-block">
                                            Cơ sở thể thao
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* 3. Phần Menu: Tabs Thông tin, Dịch vụ, Hình ảnh, Đánh giá */}
                            <div className="flex items-center border-b border-gray-200 text-sm font-medium mb-6">
                                <button
                                    type="button"
                                    onClick={() => setActiveModalTab('info')}
                                    className={`pb-2.5 px-4 transition-colors cursor-pointer ${
                                        activeModalTab === 'info'
                                            ? 'text-[#19b251] border-b-2 border-[#19b251] font-bold'
                                            : 'text-gray-500 hover:text-gray-800'
                                    }`}
                                >
                                    Thông tin
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveModalTab('services')}
                                    className={`pb-2.5 px-4 transition-colors cursor-pointer ${
                                        activeModalTab === 'services'
                                            ? 'text-[#19b251] border-b-2 border-[#19b251] font-bold'
                                            : 'text-gray-500 hover:text-gray-800'
                                    }`}
                                >
                                    Bảng giá & Dịch vụ
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveModalTab('images')}
                                    className={`pb-2.5 px-4 transition-colors cursor-pointer ${
                                        activeModalTab === 'images'
                                            ? 'text-[#19b251] border-b-2 border-[#19b251] font-bold'
                                            : 'text-gray-500 hover:text-gray-800'
                                    }`}
                                >
                                    Hình ảnh
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveModalTab('reviews')}
                                    className={`pb-2.5 px-4 transition-colors cursor-pointer ${
                                        activeModalTab === 'reviews'
                                            ? 'text-[#19b251] border-b-2 border-[#19b251] font-bold'
                                            : 'text-gray-500 hover:text-gray-800'
                                    }`}
                                >
                                    Đánh giá
                                </button>
                            </div>

                            {/* 4. Nội dung hiển thị theo Tab */}
                            {activeModalTab === 'info' && (
                                <div className="space-y-4">
                                    {/* Giờ hoạt động & Trạng thái */}
                                    <div className="flex items-center justify-between text-sm bg-gray-50/90 p-3.5 rounded-xl border border-gray-100">
                                        <div className="flex items-center gap-2.5 text-gray-700 font-medium">
                                            <Clock className="w-4 h-4 text-[#19b251] shrink-0" />
                                            <span>
                                                Giờ hoạt động: {selectedVenueDetail.openTime || '06:00'} - {selectedVenueDetail.closeTime || '23:30'}
                                            </span>
                                        </div>
                                        {(() => {
                                            const status = getOperatingStatus(selectedVenueDetail);
                                            return (
                                                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${status.isOpen ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${status.isOpen ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                                                    <span>{status.isOpen ? 'Đang mở' : 'Đóng cửa'}</span>
                                                </div>
                                            );
                                        })()}
                                    </div>

                                    {/* Địa chỉ */}
                                    <div className="flex items-start gap-2.5 text-sm text-gray-600 px-1">
                                        <MapPin className="w-4 h-4 text-[#f97316] shrink-0 mt-0.5" />
                                        <span className="leading-relaxed">{selectedVenueDetail.address || 'Chưa cập nhật địa chỉ'}</span>
                                    </div>

                                    {/* Số điện thoại */}
                                    {selectedVenueDetail.phone && (
                                        <div className="flex items-center gap-2.5 text-sm text-gray-600 px-1">
                                            <Phone className="w-4 h-4 text-blue-500 shrink-0" />
                                            <span>Hotline: <strong className="text-gray-800">{selectedVenueDetail.phone}</strong></span>
                                        </div>
                                    )}

                                    {/* Mô tả cơ sở */}
                                    {selectedVenueDetail.description && (
                                        <div className="bg-gray-50 rounded-xl p-3.5 text-sm text-gray-600 border border-gray-100 leading-relaxed max-h-24 overflow-y-auto">
                                            {selectedVenueDetail.description}
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeModalTab === 'images' && (
                                !selectedVenueDetail.images?.length ? (
                                    <div className="py-10 text-center text-sm text-gray-500 bg-gray-50/70 rounded-xl border border-gray-100">
                                        Chưa có hình ảnh nào được tải lên
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-64 overflow-y-auto p-1">
                                        {selectedVenueDetail.images?.map((img, index) => (
                                            <img
                                                key={index}
                                                src={img}
                                                alt={`${selectedVenueDetail.name} - ${index + 1}`}
                                                className="w-full aspect-square object-cover rounded-xl shadow-sm border border-gray-100"
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&q=80&w=600';
                                                }}
                                            />
                                        ))}
                                    </div>
                                )
                            )}

                            {activeModalTab === 'services' && (
                                <div className="space-y-5 max-h-[52vh] overflow-y-auto pr-1">
                                    {venueDetailLoading ? (
                                        <div className="py-10 text-center text-sm text-gray-500">Đang tải thông tin...</div>
                                    ) : (
                                        <>
                                            <section>
                                                <h4 className="font-bold text-gray-800 mb-3">Bảng giá sân</h4>
                                                {selectedVenueDetail.pricingRules?.length ? (
                                                    <div className="space-y-2">
                                                        {selectedVenueDetail.pricingRules.map((rule) => (
                                                            <div key={rule.id} className="rounded-xl border border-gray-100 bg-gray-50 p-3 flex flex-wrap items-center justify-between gap-2">
                                                                <div>
                                                                    <p className="font-semibold text-gray-800">{rule.name}</p>
                                                                    <p className="text-xs text-gray-500">
                                                                        {[rule.dayOfWeek, rule.startTime && rule.endTime ? `${rule.startTime} - ${rule.endTime}` : null].filter(Boolean).join(' · ') || 'Tất cả các ngày, cả ngày'}
                                                                    </p>
                                                                    {rule.description && <p className="text-xs text-gray-500 mt-1">{rule.description}</p>}
                                                                </div>
                                                                <span className="font-bold text-[#19b251]">{formatVnd(rule.pricePerHour)}/giờ</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="text-sm text-gray-500 rounded-xl bg-gray-50 p-4">Cơ sở chưa cập nhật bảng giá.</p>
                                                )}
                                            </section>
                                            <section>
                                                <h4 className="font-bold text-gray-800 mb-3">Kho & Dịch vụ</h4>
                                                <div className="space-y-2">
                                                    {selectedVenueDetail.products?.map((product) => (
                                                        <div key={product.id} className="rounded-xl border border-gray-100 p-3 flex items-center justify-between gap-3">
                                                            <div>
                                                                <p className="font-medium text-gray-800">{product.name}</p>
                                                                <p className="text-xs text-gray-500">Còn {product.stock} {product.unit}</p>
                                                                {product.description && <p className="text-xs text-gray-500 mt-1">{product.description}</p>}
                                                            </div>
                                                            <span className="font-semibold text-gray-800">{formatVnd(product.price)}</span>
                                                        </div>
                                                    ))}
                                                    {selectedVenueDetail.services?.map((service) => (
                                                        <div key={service.id} className="rounded-xl border border-gray-100 p-3 flex items-center justify-between gap-3">
                                                            <div>
                                                                <p className="font-medium text-gray-800">{service.name}</p>
                                                                <p className="text-xs text-gray-500">Dịch vụ · {service.unit}</p>
                                                                {service.description && <p className="text-xs text-gray-500 mt-1">{service.description}</p>}
                                                            </div>
                                                            <span className="font-semibold text-gray-800">{formatVnd(service.price)}</span>
                                                        </div>
                                                    ))}
                                                    {!selectedVenueDetail.products?.length && !selectedVenueDetail.services?.length && (
                                                        <p className="text-sm text-gray-500 rounded-xl bg-gray-50 p-4">Cơ sở chưa cập nhật sản phẩm hoặc dịch vụ.</p>
                                                    )}
                                                </div>
                                            </section>
                                        </>
                                    )}
                                </div>
                            )}

                            {activeModalTab === 'reviews' && (
                                <div className="space-y-3 max-h-[44vh] overflow-y-auto pr-1">
                                    <form onSubmit={submitVenueReview} className="rounded-xl border border-green-100 bg-green-50/60 p-2.5 space-y-2">
                                        <h4 className="text-sm font-bold text-gray-800">Gửi đánh giá của bạn</h4>
                                        <div className="flex items-center gap-0.5" role="group" aria-label="Chọn số sao">
                                            {[1, 2, 3, 4, 5].map((rating) => (
                                                <button key={rating} type="button" onClick={() => setReviewRating(rating)} aria-label={`${rating} sao`}>
                                                    <Star className={`w-4 h-4 ${rating <= reviewRating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
                                                </button>
                                            ))}
                                            <span className="ml-1.5 text-xs text-gray-600">{reviewRating}/5</span>
                                        </div>
                                        <div className="grid sm:grid-cols-2 gap-2">
                                            <input value={reviewName} onChange={(event) => setReviewName(event.target.value)} maxLength={100} placeholder="Tên của bạn" className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-900 placeholder:text-gray-500 outline-none focus:border-[#19b251]" />
                                            <input value={reviewPhone} onChange={(event) => setReviewPhone(event.target.value)} maxLength={30} placeholder="Số điện thoại" className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-900 placeholder:text-gray-500 outline-none focus:border-[#19b251]" />
                                        </div>
                                        <textarea value={reviewContent} onChange={(event) => setReviewContent(event.target.value)} maxLength={2000} rows={2} placeholder="Chia sẻ trải nghiệm của bạn..." className="w-full resize-y rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-900 placeholder:text-gray-500 outline-none focus:border-[#19b251]" />
                                        <div>
                                            <label className="inline-flex cursor-pointer items-center rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
                                                Chọn hình ảnh (tối đa 5)
                                                <input type="file" accept="image/*" multiple className="sr-only" onChange={(event) => {
                                                    void handleReviewImageChange(event.target.files);
                                                    event.currentTarget.value = '';
                                                }} />
                                            </label>
                                            {!!reviewImages.length && (
                                                <div className="mt-2 flex flex-wrap gap-1.5">
                                                    {reviewImages.map((image, index) => (
                                                        <div key={`${image.slice(-20)}-${index}`} className="relative">
                                                            <img src={image} alt={`Ảnh đánh giá ${index + 1}`} className="h-12 w-12 rounded-lg object-cover" />
                                                            <button type="button" onClick={() => setReviewImages((current) => current.filter((_, imageIndex) => imageIndex !== index))} className="absolute -right-2 -top-2 rounded-full bg-gray-900 p-1 text-white" aria-label="Xóa ảnh">
                                                                <X className="h-3 w-3" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <button type="submit" disabled={reviewSubmitting} className="rounded-lg bg-[#19b251] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#159a45] disabled:opacity-60">
                                            {reviewSubmitting ? 'Đang gửi...' : 'Gửi đánh giá'}
                                        </button>
                                        <p className="text-[11px] text-gray-500">Đánh giá và hình ảnh sẽ được admin duyệt trước khi hiển thị công khai.</p>
                                    </form>

                                    <section className="space-y-2">
                                        <h4 className="text-xs font-bold text-gray-800">Đánh giá từ khách hàng</h4>
                                        {isLoadingReviews ? (
                                            <p className="py-4 text-center text-xs text-gray-500">Đang tải đánh giá...</p>
                                        ) : venueReviews.length === 0 ? (
                                            <p className="rounded-xl bg-gray-50 p-3 text-center text-xs text-gray-500">Chưa có đánh giá được duyệt.</p>
                                        ) : venueReviews.map((review) => (
                                            <article key={review.id} className="rounded-xl border border-gray-100 p-2.5">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div>
                                                        <p className="text-sm font-semibold text-gray-800">{review.customerName}</p>
                                                        <div className="mt-0.5 flex items-center gap-0.5">
                                                            {[1, 2, 3, 4, 5].map((rating) => <Star key={rating} className={`h-3 w-3 ${rating <= review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />)}
                                                        </div>
                                                    </div>
                                                    <time className="text-[11px] text-gray-400">{new Date(review.createdAt).toLocaleDateString('vi-VN')}</time>
                                                </div>
                                                <p className="mt-1.5 whitespace-pre-wrap text-xs text-gray-700">{review.content}</p>
                                                {!!review.images.length && (
                                                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                                                        {review.images.map((image, index) => <img key={index} src={image} alt={`Ảnh đánh giá ${index + 1}`} className="h-14 w-14 rounded-lg object-cover" />)}
                                                    </div>
                                                )}
                                            </article>
                                        ))}
                                    </section>
                                </div>
                            )}

                            {/* 5. Phần Nút: Nút ĐẶT LỊCH lớn màu vàng */}
                            <button
                                onClick={() => {
                                    const venue = selectedVenueDetail;
                                    setSelectedVenueDetail(null);
                                    handleSelectVenue(venue);
                                }}
                                className="w-full mt-6 bg-[#eab308] hover:bg-[#ca8a04] active:scale-[0.99] text-white font-bold py-3.5 px-6 rounded-xl text-base shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 tracking-wide cursor-pointer"
                            >
                                <CalendarCheck className="w-5 h-5" />
                                ĐẶT LỊCH
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ChatBotWidget />
        </div>
    );
}
