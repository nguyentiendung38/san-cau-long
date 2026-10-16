import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
    Search, MapPin, Map as MapIcon, CalendarCheck, Heart, User, Home, Flame, Compass,
    Settings2, Calendar, ChevronRight, Info, ShieldCheck, Sparkles, Globe, X, ChevronLeft,
    Star, Navigation, Clock, CalendarDays, Bell, BookOpen, Gift, LogOut, Phone
} from 'lucide-react';
import { venueApi, courtApi, Venue, Court } from '@/services/venue.service';
import { ChatBotWidget } from '@/components/chatbot/ChatBotWidget';
import { bookingRequestApi, getBookingRequestTotal } from '@/services/booking.service';
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
    const [venuesError, setVenuesError] = useState(false);
    const [venueReloadKey, setVenueReloadKey] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterMode, setFilterMode] = useState<'all' | 'favorite' | 'open' | 'rated'>('all');
    const [venueSort, setVenueSort] = useState<'recommended' | 'rating' | 'courts' | 'name'>('recommended');
    const [selectedVenueDetail, setSelectedVenueDetail] = useState<Venue | null>(null);
    const [activeModalTab, setActiveModalTab] = useState<'info' | 'services' | 'images' | 'reviews' | 'terms'>('info');
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
        enabled: activeTab === 'explore' || activeTab === 'home',
    });

    const [userPhone, setUserPhone] = useState(localStorage.getItem('portalUserPhone') || '');
    const [tempPhone, setTempPhone] = useState('');
    const [historyFilter, setHistoryFilter] = useState<'upcoming' | 'past' | 'all'>('upcoming');
    const { data: myRequests = [], isLoading: isLoadingRequests, isError: requestsError, refetch: refetchRequests } = useQuery<any[]>({
        queryKey: ['my-requests', userPhone],
        queryFn: () => bookingRequestApi.getMyRequests(userPhone).then(data => data.filter((b: any) => !b.notes?.includes("Zalo"))),
        enabled: activeTab === 'history' && !!userPhone,
    });
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const filteredRequests = myRequests.filter((request: any) => {
        if (historyFilter === 'all') return true;
        const requestDate = new Date(request.date);
        requestDate.setHours(0, 0, 0, 0);
        return historyFilter === 'upcoming' ? requestDate >= today : requestDate < today;
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

    const handleSelectCourt = (venue: Venue, courtId: string) => {
        navigate(`/dat-lich/${venue.id}/${courtId}`);
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
    }, [venueReloadKey]);

    useEffect(() => {
        const fetchVenues = async () => {
            setLoading(true);
            setVenuesError(false);
            try {
                const res = await venueApi.getAll({ isActive: true });
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
                setVenuesError(true);
            } finally {
                setLoading(false);
            }
        };
        fetchVenues();
    }, []);

    const filteredVenues = venues.filter(venue => {
        const normalizedQuery = searchQuery.trim().toLowerCase();
        const matchesSearch = venue.name.toLowerCase().includes(normalizedQuery) || (venue.address && venue.address.toLowerCase().includes(normalizedQuery));
        if (!matchesSearch) return false;
        if (filterMode === 'favorite') return favoriteVenueIds.includes(venue.id);
        if (filterMode === 'open') return getOperatingStatus(venue).isOpen;
        if (filterMode === 'rated') return (venue.reviewCount || 0) > 0;
        return true;
    }).sort((first, second) => {
        if (venueSort === 'rating') return (second.ratingAverage || 0) - (first.ratingAverage || 0);
        if (venueSort === 'courts') return (second._count?.courts || second.courts?.length || 0) - (first._count?.courts || first.courts?.length || 0);
        if (venueSort === 'name') return first.name.localeCompare(second.name, 'vi');
        return 0;
    });

    const homeHighlights = exploreItems.filter(item => item.type === 'EVENT' || item.type === 'DEAL').slice(0, 3);

    const openVenueDirections = (venue: Venue) => {
        const destination = encodeURIComponent([venue.name, venue.address].filter(Boolean).join(', '));
        window.open(`https://www.google.com/maps/dir/?api=1&destination=${destination}`, '_blank', 'noopener,noreferrer');
    };

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
                <div className="flex flex-col flex-1 gap-6 pb-24 px-4 py-6 max-w-[1240px] mx-auto w-full">
                    <section className="relative isolate overflow-hidden rounded-[28px] bg-gradient-to-br from-[#063d2c] via-[#087a4c] to-[#16a36a] px-6 py-8 text-white shadow-[0_24px_60px_-28px_rgba(6,61,44,0.65)] sm:px-10 sm:py-10 lg:min-h-[300px] lg:px-14">
                        <div className="absolute -right-16 -top-24 -z-10 h-72 w-72 rounded-full border-[36px] border-white/5" />
                        <div className="absolute -bottom-40 right-24 -z-10 h-80 w-80 rounded-full bg-lime-300/10 blur-2xl" />
                        <div className="absolute right-8 top-8 hidden h-20 w-20 rotate-12 items-center justify-center rounded-3xl border border-white/20 bg-white/10 text-4xl shadow-xl backdrop-blur-sm sm:flex">
                            🏸
                        </div>

                        <div className="max-w-2xl">
                            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold tracking-wide text-emerald-50 backdrop-blur-sm">
                                <Sparkles className="h-3.5 w-3.5 text-lime-300" />
                                SÂN THỂ THAO GẦN BẠN
                            </span>
                            <h1 className="mt-5 text-3xl font-black leading-tight tracking-tight sm:text-4xl lg:text-[42px]">
                                Sẵn sàng cho một
                                <span className="block text-lime-300">trận đấu thật hay?</span>
                            </h1>
                            <p className="mt-3 max-w-xl text-sm leading-6 text-emerald-50/85 sm:text-base">
                                Tìm sân phù hợp, xem thông tin và đặt lịch nhanh chóng ngay trên điện thoại.
                            </p>
                            <div className="mt-6 flex flex-wrap items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => document.getElementById('venue-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                                    className="inline-flex items-center gap-2 rounded-xl bg-lime-300 px-5 py-3 text-sm font-bold text-emerald-950 shadow-lg shadow-black/10 transition hover:bg-lime-200"
                                >
                                    Tìm sân ngay
                                    <ChevronRight className="h-4 w-4" />
                                </button>
                                <span className="inline-flex items-center gap-2 text-sm font-medium text-white/80">
                                    <ShieldCheck className="h-4 w-4 text-lime-300" />
                                    Đặt sân tiện lợi, xác nhận nhanh
                                </span>
                            </div>
                        </div>
                    </section>

                    {homeHighlights.length > 0 && (
                        <section aria-label="Ưu đãi và sự kiện" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {homeHighlights.map(item => (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => {
                                        setExploreFilter(item.type.toLowerCase());
                                        setActiveTab('explore');
                                    }}
                                    className="group relative flex min-h-28 items-end overflow-hidden rounded-2xl border border-gray-100 bg-gray-900 p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                                >
                                    {item.imageUrl && (
                                        <img src={item.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-45 transition duration-500 group-hover:scale-105" />
                                    )}
                                    <span className="absolute inset-0 bg-gradient-to-t from-gray-950/80 via-gray-900/20 to-transparent" />
                                    <span className="relative z-10">
                                        <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur">
                                            {TYPE_ICONS[item.type]} {TYPE_LABELS[item.type]}
                                            {item.badge && <span className="ml-1 text-lime-200">{item.badge}</span>}
                                        </span>
                                        <span className="block line-clamp-1 text-sm font-bold text-white">{item.title}</span>
                                        {item.price && <span className="mt-0.5 block text-xs font-semibold text-lime-200">{item.price}</span>}
                                    </span>
                                </button>
                            ))}
                        </section>
                    )}

                    <section className="rounded-2xl border border-gray-100 bg-white p-3 shadow-[0_12px_36px_-28px_rgba(15,23,42,0.35)] sm:p-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                            <label className="flex min-h-12 flex-1 items-center gap-3 rounded-xl bg-gray-50 px-4 ring-1 ring-inset ring-gray-100 transition focus-within:bg-white focus-within:ring-2 focus-within:ring-emerald-500/30">
                                <Search className="h-5 w-5 shrink-0 text-emerald-700" />
                                <input
                                    type="search"
                                    placeholder="Tìm theo tên sân hoặc địa chỉ..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="w-full bg-transparent py-3 text-sm text-gray-800 outline-none placeholder:text-gray-400"
                                />
                            </label>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('map')}
                                    className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 text-sm font-semibold text-gray-700 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800 sm:flex-none"
                                >
                                    <MapIcon className="h-4 w-4" />
                                    Bản đồ
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const savedPhone = localStorage.getItem('portalUserPhone');
                                        if (savedPhone) setUserPhone(savedPhone);
                                        setActiveTab('history');
                                    }}
                                    className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 text-sm font-semibold text-gray-700 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800 sm:flex-none"
                                >
                                    <CalendarCheck className="h-4 w-4" />
                                    Lịch đã đặt
                                </button>
                            </div>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
                            <span className="mr-1 inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500">
                                <Settings2 className="h-3.5 w-3.5" />
                                Lọc sân
                            </span>
                            {([
                                { value: 'all', label: 'Tất cả sân', count: venues.length },
                                { value: 'favorite', label: 'Yêu thích', count: favoriteVenueIds.length },
                                { value: 'open', label: 'Đang mở', count: venues.filter(venue => getOperatingStatus(venue).isOpen).length },
                                { value: 'rated', label: 'Có đánh giá', count: venues.filter(venue => (venue.reviewCount || 0) > 0).length },
                            ] as const).map(option => (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => setFilterMode(option.value)}
                                    className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition ${
                                        filterMode === option.value
                                            ? 'bg-emerald-700 text-white shadow-sm'
                                            : 'bg-gray-100 text-gray-600 hover:bg-emerald-50 hover:text-emerald-800'
                                    }`}
                                >
                                    {option.value === 'favorite' && <Heart className="h-3.5 w-3.5" />}
                                    {option.value === 'open' && <Clock className="h-3.5 w-3.5" />}
                                    {option.value === 'rated' && <Star className="h-3.5 w-3.5" />}
                                    {option.label}
                                    <span className={filterMode === option.value ? 'text-emerald-100' : 'text-gray-400'}>{option.count}</span>
                                </button>
                            ))}
                        </div>
                    </section>

                    <section id="venue-list" className="scroll-mt-6">
                        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">Khám phá địa điểm</p>
                                <h2 className="mt-1 text-2xl font-black tracking-tight text-gray-900 sm:text-[28px]">Chọn sân phù hợp</h2>
                            </div>
                            {!loading && (
                                <div className="flex items-center gap-2">
                                    <label htmlFor="venue-sort" className="text-xs font-medium text-gray-500">Sắp xếp</label>
                                    <select
                                        id="venue-sort"
                                        value={venueSort}
                                        onChange={event => setVenueSort(event.target.value as typeof venueSort)}
                                        className="rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-xs font-semibold text-gray-700 outline-none focus:border-emerald-500"
                                    >
                                        <option value="recommended">Gợi ý</option>
                                        <option value="rating">Đánh giá cao</option>
                                        <option value="courts">Nhiều sân</option>
                                        <option value="name">Tên A–Z</option>
                                    </select>
                                    <p className="hidden text-sm text-gray-500 sm:block">
                                        {filteredVenues.length} địa điểm
                                    </p>
                                </div>
                            )}
                        </div>

                        {loading ? (
                            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="overflow-hidden rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
                                        <div className="animate-pulse">
                                            <div className="h-48 rounded-xl bg-gray-200" />
                                            <div className="mt-4 h-5 w-3/4 rounded bg-gray-200" />
                                            <div className="mt-3 h-4 w-1/2 rounded bg-gray-100" />
                                            <div className="mt-5 h-10 rounded-xl bg-gray-100" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : venuesError ? (
                            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-12 text-center">
                                <p className="font-semibold text-amber-900">Không thể tải danh sách cơ sở</p>
                                <p className="mt-1 text-sm text-amber-800">Kiểm tra kết nối rồi thử tải lại.</p>
                                <button
                                    type="button"
                                    onClick={() => setVenueReloadKey(key => key + 1)}
                                    className="mt-4 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-800"
                                >
                                    Thử lại
                                </button>
                            </div>
                        ) : filteredVenues.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-5 py-16 text-center">
                                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                                    {filterMode === 'favorite' ? <Heart className="h-6 w-6" /> : <Search className="h-6 w-6" />}
                                </div>
                                <p className="mt-4 font-semibold text-gray-800">
                                    {filterMode === 'favorite' && !searchQuery ? 'Bạn chưa có sân yêu thích' : 'Không tìm thấy sân phù hợp'}
                                </p>
                                <p className="mt-1 text-sm text-gray-500">
                                    {filterMode === 'favorite' && !searchQuery
                                        ? 'Chạm vào biểu tượng trái tim trên sân để lưu lại nhé.'
                                        : 'Thử đổi từ khóa tìm kiếm hoặc chọn bộ lọc khác.'}
                                </p>
                                {filterMode !== 'all' && (
                                    <button
                                        type="button"
                                        onClick={() => setFilterMode('all')}
                                        className="mt-4 rounded-lg px-4 py-2 text-sm font-bold text-emerald-700 hover:bg-emerald-50"
                                    >
                                        Xem tất cả sân
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                                {filteredVenues.map(venue => {
                                    const status = getOperatingStatus(venue);
                                    const isFavorite = favoriteVenueIds.includes(venue.id);
                                    return (
                                        <article key={venue.id} className="group flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-[0_8px_26px_-18px_rgba(15,23,42,0.35)] transition duration-300 hover:-translate-y-1 hover:border-emerald-100 hover:shadow-[0_20px_40px_-24px_rgba(6,95,70,0.35)]">
                                            <div className="relative h-48 cursor-pointer overflow-hidden bg-emerald-50" onClick={() => void openVenueDetail(venue)}>
                                                <img
                                                    src={venue.logo || "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?q=80&w=1000&auto=format&fit=crop"}
                                                    alt={venue.name}
                                                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                                                />
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/10" />
                                                <span className={`absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold shadow-sm backdrop-blur-md ${
                                                    status.isOpen ? 'bg-white/95 text-emerald-800' : 'bg-white/90 text-gray-600'
                                                }`}>
                                                    <span className={`h-1.5 w-1.5 rounded-full ${status.isOpen ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                                                    {status.isOpen ? 'Đang mở cửa' : status.text === 'Chưa cập nhật giờ' ? 'Chưa cập nhật giờ' : 'Đang đóng cửa'}
                                                </span>
                                                <button
                                                    type="button"
                                                    aria-label={isFavorite ? `Bỏ yêu thích ${venue.name}` : `Thêm ${venue.name} vào yêu thích`}
                                                    onClick={e => toggleFavorite(venue.id, e)}
                                                    className={`absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full shadow-md backdrop-blur-md transition ${
                                                        isFavorite ? 'bg-white text-rose-500' : 'bg-black/25 text-white hover:bg-white hover:text-rose-500'
                                                    }`}
                                                >
                                                    <Heart className={`h-5 w-5 ${isFavorite ? 'fill-current' : ''}`} />
                                                </button>
                                                {!!venue.reviewCount && (
                                                    <div className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-lg bg-black/45 px-2.5 py-1.5 text-white backdrop-blur-md">
                                                        <Star className="h-4 w-4 fill-amber-300 text-amber-300" />
                                                        <span className="text-xs font-bold">{venue.ratingAverage?.toFixed(1)}</span>
                                                        <span className="text-[11px] text-white/80">({venue.reviewCount} đánh giá)</span>
                                                    </div>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={event => {
                                                        event.stopPropagation();
                                                        openVenueDirections(venue);
                                                    }}
                                                    aria-label={`Chỉ đường đến ${venue.name}`}
                                                    className="absolute right-3 top-[60px] flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-emerald-800 shadow-md transition hover:scale-105 hover:bg-lime-200"
                                                >
                                                    <Navigation className="h-4 w-4" />
                                                </button>
                                            </div>

                                            <div className="flex flex-1 flex-col p-4">
                                                <div className="flex items-start justify-between gap-3">
                                                    <button type="button" onClick={() => void openVenueDetail(venue)} className="text-left">
                                                        <h3 className="line-clamp-1 text-base font-bold text-gray-900 transition-colors group-hover:text-emerald-800">{venue.name}</h3>
                                                    </button>
                                                    {!!venue.courts?.length && (
                                                        <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800">
                                                            {venue.courts.length} sân khả dụng
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="mt-2 flex items-start gap-2 text-sm text-gray-500">
                                                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                                                    <span className="line-clamp-2 leading-5">{venue.address}</span>
                                                </div>
                                                {!!venue.courts?.length && (
                                                    <div className="mt-4">
                                                        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-gray-500">Chọn sân để đặt</p>
                                                        <div className="flex flex-wrap gap-2">
                                                            {venue.courts.map(court => (
                                                                <button
                                                                    key={court.id}
                                                                    type="button"
                                                                    onClick={() => handleSelectCourt(venue, court.id)}
                                                                    className="rounded-lg border border-emerald-100 bg-emerald-50/70 px-3 py-2 text-xs font-semibold text-emerald-800 transition hover:border-emerald-500 hover:bg-emerald-700 hover:text-white"
                                                                >
                                                                    {court.name}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
                                                    <Clock className="h-3.5 w-3.5 text-gray-400" />
                                                    <span>{status.text}</span>
                                                </div>
                                                <div className="mt-auto flex items-center justify-between gap-3 border-t border-gray-100 pt-4 mt-4">
                                                    <button
                                                        type="button"
                                                        onClick={() => void openVenueDetail(venue)}
                                                        className="text-sm font-semibold text-gray-600 transition hover:text-emerald-800"
                                                    >
                                                        Xem chi tiết
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleSelectVenue(venue)}
                                                        className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
                                                    >
                                                        Đặt sân
                                                        <ChevronRight className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                        )}
                    </section>
                </div>
            )}

            {/* Map View */}
            {activeTab === 'map' && (
                <div className="hidden">
                    <div className="flex-1 relative">
                        <iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3826.6404207967107!2d107.60194437592682!3d16.443078629319736!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3141a165ca6ab627%3A0xf296b18480a09d08!2zVHLGsOG7nW5nIMSQ4bqhaSBo4buNYyBLaW5oIHThur8sIMSQ4bqhaSBo4buNYyBIdeG6vw!5e0!3m2!1svi!2s!4v1790410473151!5m2!1svi!2s" width="100%" height="100%" style={{ border: 0, minHeight: '80vh' }} allowFullScreen={true} loading="lazy"></iframe>
                    </div>
                </div>
            )}

            {activeTab === 'map' && (
                <div className="min-h-[calc(100vh-80px)] bg-gray-50 px-4 pb-28 pt-6">
                    <div className="mx-auto max-w-5xl">
                        <h1 className="text-2xl font-black text-gray-900">Cơ sở & chỉ đường</h1>
                        <p className="mt-1 text-sm text-gray-600">Mở chỉ đường đến địa chỉ cơ sở do quản trị viên cập nhật.</p>
                        {loading ? (
                            <div className="mt-6 rounded-2xl bg-white p-8 text-center text-gray-500">Đang tải danh sách cơ sở...</div>
                        ) : venuesError ? (
                            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center">
                                <p className="font-semibold text-amber-900">Không thể tải danh sách cơ sở.</p>
                                <button onClick={() => setVenueReloadKey(key => key + 1)} className="mt-3 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white">Thử lại</button>
                            </div>
                        ) : venues.length === 0 ? (
                            <div className="mt-6 rounded-2xl bg-white p-8 text-center text-gray-500">Chưa có cơ sở nào để hiển thị.</div>
                        ) : (
                            <div className="mt-5 grid gap-3 sm:grid-cols-2">
                                {venues.map(venue => (
                                    <article key={venue.id} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                                        <h2 className="font-bold text-gray-900">{venue.name}</h2>
                                        <p className="mt-2 flex items-start gap-2 text-sm text-gray-600">
                                            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                                            <span>{venue.address || 'Chưa cập nhật địa chỉ'}</span>
                                        </p>
                                        {venue.phone && <p className="mt-2 text-sm text-gray-600">Điện thoại: {venue.phone}</p>}
                                        <div className="mt-4 flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => openVenueDirections(venue)}
                                                className="flex-1 rounded-xl border border-emerald-700 px-3 py-2 text-sm font-bold text-emerald-800 hover:bg-emerald-50"
                                            >
                                                Chỉ đường
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleSelectVenue(venue)}
                                                className="flex-1 rounded-xl bg-emerald-700 px-3 py-2 text-sm font-bold text-white hover:bg-emerald-800"
                                            >
                                                Đặt sân
                                            </button>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        )}
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
                        ) : requestsError ? (
                            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center">
                                <p className="font-semibold text-amber-900">Không thể tải lịch đặt của bạn.</p>
                                <button onClick={() => void refetchRequests()} className="mt-3 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white">Thử lại</button>
                            </div>
                        ) : myRequests.length === 0 ? (
                            <div className="text-center py-20 bg-white rounded-2xl border border-gray-100 flex flex-col items-center">
                                <CalendarDays className="w-16 h-16 text-gray-300 mb-4" />
                                <p className="text-gray-500 font-medium">Bạn chưa đặt sân nào</p>
                                <button onClick={() => setActiveTab('home')} className="mt-4 px-6 py-2 bg-[#19b251] text-white font-bold rounded-full text-sm">Đặt sân ngay</button>
                            </div>
                        ) : (
                            <>
                                <div className="mb-4 flex gap-2 overflow-x-auto">
                                    {([
                                        { value: 'upcoming', label: 'Sắp tới' },
                                        { value: 'past', label: 'Đã qua' },
                                        { value: 'all', label: 'Tất cả' },
                                    ] as const).map(option => (
                                        <button
                                            key={option.value}
                                            onClick={() => setHistoryFilter(option.value)}
                                            className={`shrink-0 rounded-full border px-4 py-2 text-sm font-bold ${historyFilter === option.value ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-gray-200 bg-white text-gray-600'}`}
                                        >
                                            {option.label}
                                        </button>
                                    ))}
                                </div>
                                {filteredRequests.length === 0 ? (
                                    <div className="rounded-2xl border border-gray-100 bg-white py-16 text-center text-gray-500">
                                        Không có lịch đặt trong mục này.
                                    </div>
                                ) : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {filteredRequests.map((req: any) => (
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
                                                <span className={`text-right font-semibold ${req.paymentStatus === 'PAID' ? 'text-green-600' : 'text-orange-500'}`}>
                                                    {req.paymentMethod === 'VNPAY' ? 'VNPay' : 'Chuyển khoản'} · {req.paymentStatus === 'PAID' ? 'Đã xác nhận tiền nhận' : 'Chờ xác nhận'}
                                                    {getBookingRequestTotal(req) > 0 && <span className="block text-xs">Tổng: {formatVnd(getBookingRequestTotal(req))}</span>}
                                                    {req.paymentStatus === 'PAID' && <span className="block text-xs">Đã nhận: {formatVnd(req.paymentAmount || 0)}</span>}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                </div>}
                            </>
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

                            {/* 3. Phần Menu: Thông tin cơ sở, dịch vụ, hình ảnh, đánh giá và điều khoản */}
                            <div className="mb-6 flex items-center gap-1 overflow-x-auto border-b border-gray-200 text-sm font-medium">
                                <button
                                    type="button"
                                    onClick={() => setActiveModalTab('info')}
                                    className={`shrink-0 whitespace-nowrap px-4 pb-2.5 transition-colors cursor-pointer ${
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
                                    className={`shrink-0 whitespace-nowrap px-4 pb-2.5 transition-colors cursor-pointer ${
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
                                    className={`shrink-0 whitespace-nowrap px-4 pb-2.5 transition-colors cursor-pointer ${
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
                                    className={`shrink-0 whitespace-nowrap px-4 pb-2.5 transition-colors cursor-pointer ${
                                        activeModalTab === 'reviews'
                                            ? 'text-[#19b251] border-b-2 border-[#19b251] font-bold'
                                            : 'text-gray-500 hover:text-gray-800'
                                    }`}
                                >
                                    Đánh giá
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveModalTab('terms')}
                                    className={`shrink-0 whitespace-nowrap px-4 pb-2.5 transition-colors cursor-pointer ${
                                        activeModalTab === 'terms'
                                            ? 'text-[#19b251] border-b-2 border-[#19b251] font-bold'
                                            : 'text-gray-500 hover:text-gray-800'
                                    }`}
                                >
                                    Điều khoản & dịch vụ
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

                            {activeModalTab === 'terms' && (
                                <section className="max-h-[52vh] overflow-y-auto rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4 sm:p-5">
                                    <div className="mb-3 flex items-center gap-2">
                                        <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-700" />
                                        <h4 className="font-bold text-gray-900">Điều khoản & dịch vụ</h4>
                                    </div>
                                    {venueDetailLoading ? (
                                        <p className="py-6 text-center text-sm text-gray-500">Đang tải thông tin...</p>
                                    ) : selectedVenueDetail.termsAndServices?.trim() ? (
                                        <div className="whitespace-pre-wrap break-words text-sm leading-7 text-gray-700">
                                            {selectedVenueDetail.termsAndServices}
                                        </div>
                                    ) : (
                                        <p className="rounded-xl border border-dashed border-emerald-200 bg-white/70 px-4 py-6 text-center text-sm leading-6 text-gray-500">
                                            Cơ sở chưa cập nhật điều khoản và dịch vụ. Vui lòng liên hệ cơ sở nếu bạn cần thêm thông tin.
                                        </p>
                                    )}
                                </section>
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
