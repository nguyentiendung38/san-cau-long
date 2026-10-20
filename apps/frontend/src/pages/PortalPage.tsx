import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { 
    Search, MapPin, Map as MapIcon, CalendarCheck, Heart, User, Home, Flame, Compass,
    Settings2, Calendar, ChevronRight, ChevronDown, ChevronUp, Info, ShieldCheck, Sparkles, Globe, X, ChevronLeft,
    Star, Navigation, Clock, CalendarDays, Bell, BookOpen, Gift, LogOut, Phone,
    ArrowUpRight, CalendarRange, RefreshCw
} from 'lucide-react';
import { venueApi, courtApi, Venue, Court } from '@/services/venue.service';
import { ChatBotWidget } from '@/components/chatbot/ChatBotWidget';
import { bookingRequestApi, getBookingRequestTotal } from '@/services/booking.service';
import { useToast } from '@/hooks/use-toast';
import { exploreContentPublicApi, ExploreContent, ExploreContentType, TYPE_LABELS, TYPE_ICONS } from '@/services/explore-content.service';
import { venueReviewApi } from '@/services/venue-review.service';
import { portalAuthApi } from '@/services/portal-auth.service';
import BookingCheckInQr from '@/components/booking/BookingCheckInQr';
import { HueStudentVerifyModal } from '@/components/portal/HueStudentVerifyModal';

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

function getBookingEndTime(request: { date: string; endTime: string }) {
    const bookingDate = new Date(request.date);
    if (typeof request.endTime !== 'string') return null;
    const [hours, minutes] = request.endTime.split(':').map(Number);
    if (
        Number.isNaN(bookingDate.getTime()) ||
        !Number.isFinite(hours) ||
        !Number.isFinite(minutes) ||
        !Number.isInteger(hours) ||
        !Number.isInteger(minutes) ||
        hours < 0 || hours > 23 ||
        minutes < 0 || minutes > 59
    ) {
        return null;
    }
    return new Date(Date.UTC(
        bookingDate.getUTCFullYear(),
        bookingDate.getUTCMonth(),
        bookingDate.getUTCDate(),
        hours - 7,
        minutes,
    ));
}

const pricingDayLabels: Record<string, string> = {
    MONDAY: 'Thứ Hai',
    TUESDAY: 'Thứ Ba',
    WEDNESDAY: 'Thứ Tư',
    THURSDAY: 'Thứ Năm',
    FRIDAY: 'Thứ Sáu',
    SATURDAY: 'Thứ Bảy',
    SUNDAY: 'Chủ Nhật',
};

const exploreTypeBackgrounds: Record<ExploreContentType, string> = {
    EVENT: 'from-violet-900 via-purple-800 to-fuchsia-600',
    COURSE: 'from-blue-950 via-blue-800 to-cyan-600',
    NEWS: 'from-slate-900 via-slate-700 to-slate-500',
    DEAL: 'from-emerald-950 via-emerald-800 to-teal-500',
    PASS: 'from-amber-950 via-orange-800 to-amber-500',
};

function getExploreAction(item: ExploreContent) {
    if (!item.metadata) return null;
    try {
        const metadata: unknown = JSON.parse(item.metadata);
        if (!metadata || typeof metadata !== 'object' || !('actionUrl' in metadata)) return null;
        const actionUrl = metadata.actionUrl;
        if (typeof actionUrl !== 'string' || !actionUrl.trim()) return null;
        const url = new URL(actionUrl, window.location.origin);
        if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
        return {
            href: url.href,
            external: url.origin !== window.location.origin,
            text: 'actionText' in metadata && typeof metadata.actionText === 'string' && metadata.actionText.trim()
                ? metadata.actionText
                : 'Tìm hiểu thêm',
        };
    } catch {
        return null;
    }
}

function formatExploreDate(value?: string) {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('vi-VN').format(date);
}

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


const getOperatingStatus = (venue: any, targetDate = new Date()) => {
    const dayOfWeek = targetDate.getDay(); // 0 = Chủ nhật, 1-6 = Thứ 2 - Thứ 7
    const dayNames = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
    const dayName = dayNames[dayOfWeek];

    const parseDays = (d: any): number[] => {
        if (!d) return [];
        if (Array.isArray(d)) return d;
        try { return JSON.parse(d); } catch { return []; }
    };

    const allHours = venue.operatingHours || [];
    
    // Booking validation requires configured operating-hour rules, so don't imply availability.
    if (allHours.length === 0) {
        return {
            isOpen: false,
            text: 'Chưa cập nhật giờ hoạt động',
            statusLabel: 'Chưa cập nhật giờ',
            dayName,
        };
    }

    // Filter operating hours for the specific day of week
    const todayHours = allHours
        .filter((oh: any) => {
            if (oh.isActive === false) return false;
            const days = parseDays(oh.daysOfWeek);
            return days.includes(dayOfWeek);
        })
        .sort((a: any, b: any) => a.startTime.localeCompare(b.startTime));

    // If venue has rules configured, but none for today -> Closed today
    if (todayHours.length === 0) {
        return {
            isOpen: false,
            text: 'Nghỉ hôm nay',
            statusLabel: 'Đóng cửa hôm nay',
            dayName
        };
    }

    // Current time in minutes
    const currMins = targetDate.getHours() * 60 + targetDate.getMinutes();

    let isOpen = false;
    let nextOpenTime = '';
    let isDuringBreak = false;

    for (let i = 0; i < todayHours.length; i++) {
        const oh = todayHours[i];
        const [sH, sM] = oh.startTime.split(':').map(Number);
        const [eH, eM] = oh.endTime.split(':').map(Number);
        const startM = sH * 60 + sM;
        const endM = eH * 60 + eM;

        if (currMins >= startM && currMins < endM) {
            isOpen = true;
            break;
        }

        if (currMins < startM && !nextOpenTime) {
            nextOpenTime = oh.startTime;
            if (i > 0) {
                isDuringBreak = true;
            }
        }
    }

    const hoursText = todayHours.map((oh: any) => `${oh.startTime} - ${oh.endTime}`).join(', ');

    let statusLabel = 'Đã đóng cửa';
    if (isOpen) {
        statusLabel = 'Đang mở cửa';
    } else if (isDuringBreak && nextOpenTime) {
        statusLabel = `Nghỉ trưa (mở lại ${nextOpenTime})`;
    } else if (nextOpenTime) {
        statusLabel = `Mở cửa lúc ${nextOpenTime}`;
    }

    return {
        isOpen,
        text: hoursText,
        statusLabel,
        dayName
    };
};

export default function PortalPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = (searchParams.get('tab') as 'home' | 'account' | 'map' | 'explore' | 'history' | 'featured_courts') || 'home';
    const navigate = useNavigate();

    const setActiveTab = (tab: string) => {
        navigate(`/trang-chu?tab=${tab}`);
    };
    const [exploreFilter, setExploreFilter] = useState<'all' | ExploreContentType>('all');
    
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
    const [reviewRating, setReviewRating] = useState(5);
    const [reviewContent, setReviewContent] = useState('');
    const [reviewImages, setReviewImages] = useState<string[]>([]);
    const [reviewSubmitting, setReviewSubmitting] = useState(false);
    const [reviewBookingId, setReviewBookingId] = useState('');

    
    const [favToast, setFavToast] = useState<{show: boolean, isAdd: boolean, id: number}>({ show: false, isAdd: true, id: 0 });

    const [favoriteVenueIds, setFavoriteVenueIds] = useState<string[]>(() => {
        if (localStorage.getItem('portalUserToken')) return [];
        try { return JSON.parse(localStorage.getItem('portal_favorites') || '[]'); } catch { return []; }
    });
    const [bookedVenueIds, setBookedVenueIds] = useState<string[]>(() => {
        try { return JSON.parse(localStorage.getItem('portal_booked') || '[]'); } catch { return []; }
    });

        const toggleFavorite = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
            const isRemoving = favoriteVenueIds.includes(id);
            const currentPortalToken = localStorage.getItem('portalUserToken') || '';
            if (currentPortalToken) {
                if (currentPortalToken !== portalToken) setPortalToken(currentPortalToken);
                portalAuthApi.setFavoriteVenue(id, !isRemoving, currentPortalToken).then((favorites) => {
                    setFavoriteVenueIds(favorites.venueIds);
                    setFavToast({ show: true, isAdd: !isRemoving, id: Date.now() });
                }).catch((error: any) => toast({
                    title: 'Không thể cập nhật yêu thích',
                    description: error?.response?.data?.message || 'Vui lòng thử lại.',
                    variant: 'error',
                }));
                return;
            }
            if (portalToken) setPortalToken('');
            setFavoriteVenueIds(prev => {
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
    const handledPaymentStatus = useRef<string | null>(null);
    
    useEffect(() => {
        const paymentStatus = searchParams.get('payment');
        if (paymentStatus !== 'success' && paymentStatus !== 'failed') {
            handledPaymentStatus.current = null;
            return;
        }

        if (handledPaymentStatus.current === paymentStatus) return;
        handledPaymentStatus.current = paymentStatus;

        if (paymentStatus === 'success') {
            toast({
                title: 'Thanh toán VNPAY thành công!',
                description: 'Cảm ơn bạn. Đơn đặt sân đã được xác nhận.',
                variant: 'success',
            });
        } else if (paymentStatus === 'failed') {
            toast({ title: 'Thanh toán VNPay thất bại hoặc bị hủy.', variant: 'error' });
        }

        const nextSearchParams = new URLSearchParams(searchParams);
        nextSearchParams.delete('payment');
        setSearchParams(nextSearchParams, { replace: true });
    }, [searchParams, setSearchParams, toast]);
    
    const queryClient = useQueryClient();

    const {
        data: exploreItems = [],
        isLoading: isLoadingExploreItems,
        isError: isExploreItemsError,
        refetch: refetchExploreItems,
    } = useQuery<ExploreContent[]>({
        queryKey: ['explore-contents-public'],
        queryFn: () => exploreContentPublicApi.getAll(),
        enabled: activeTab === 'explore' || activeTab === 'home',
    });
    const filteredExploreItems = exploreFilter === 'all'
        ? exploreItems
        : exploreItems.filter((item) => item.type === exploreFilter);
    const [userPhone, setUserPhone] = useState(localStorage.getItem('portalUserPhone') || '');
    const [portalToken, setPortalToken] = useState(localStorage.getItem('portalUserToken') || '');
    const [portalCustomerId, setPortalCustomerId] = useState(localStorage.getItem('portalUserId') || '');
    const [showHueModal, setShowHueModal] = useState(false);
    const [hueStudentIdInput, setHueStudentIdInput] = useState('');
    const [hueFacultyInput, setHueFacultyInput] = useState('Khoa Quản trị kinh doanh');
    const [isVerifyingHue, setIsVerifyingHue] = useState(false);
    useEffect(() => {
        const syncPortalSession = () => {
            setPortalToken(localStorage.getItem('portalUserToken') || '');
            setPortalCustomerId(localStorage.getItem('portalUserId') || '');
            setUserPhone(localStorage.getItem('portalUserPhone') || '');
        };
        window.addEventListener('storage', syncPortalSession);
        return () => window.removeEventListener('storage', syncPortalSession);
    }, []);
    const {
        data: loyaltyAccount,
        isLoading: isLoadingLoyalty,
        isError: isLoyaltyError,
        refetch: refetchLoyalty,
    } = useQuery<{
        points: number;
        reservedPoints: number;
        studentId?: string | null;
        faculty?: string | null;
        customerType?: string;
        isVerifiedHue?: boolean;
        pointsTransactions: Array<{ id: string; type: string; points: number; reason: string; createdAt: string }>;
    }>({
        queryKey: ['portal-loyalty', portalCustomerId],
        queryFn: portalAuthApi.getMe,
        enabled: (activeTab === 'account' || activeTab === 'home') && !!portalToken,
    });
    const [isLoyaltyExpanded, setIsLoyaltyExpanded] = useState(false);
    const [historyFilter, setHistoryFilter] = useState<'upcoming' | 'past' | 'all'>('upcoming');
    const [historyNow, setHistoryNow] = useState(() => new Date());
    useEffect(() => {
        if (activeTab !== 'history') return;
        const timer = window.setInterval(() => setHistoryNow(new Date()), 30_000);
        return () => window.clearInterval(timer);
    }, [activeTab]);

    const { data: accountFavorites } = useQuery({
        queryKey: ['portal-favorites', portalCustomerId],
        queryFn: portalAuthApi.getFavorites,
        enabled: !!portalToken && !!portalCustomerId,
    });
    useEffect(() => {
        if (!accountFavorites) return;
        setFavoriteVenueIds(accountFavorites.venueIds);
        localStorage.removeItem('portal_favorites');
    }, [accountFavorites]);

    // Customer cancellation / rescheduling state
    
    const handleVerifyHue = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!hueStudentIdInput.trim()) {
            toast({
                title: 'Thiếu thông tin',
                description: 'Vui lòng nhập Mã số sinh viên (MSSV)',
                variant: 'error',
            });
            return;
        }
        setIsVerifyingHue(true);
        try {
            await portalAuthApi.verifyHue({
                studentId: hueStudentIdInput.trim(),
                faculty: hueFacultyInput,
                customerType: 'STUDENT',
            });
            setShowHueModal(false);
            await refetchLoyalty();
            toast({
                title: 'Xác thực thành công!',
                description: 'Xác thực Sinh viên HUE thành công! Ưu đãi -20% tiền sân đã được kích hoạt.',
                variant: 'success',
            });
        } catch (err: any) {
            toast({
                title: 'Xác thực thất bại',
                description: err?.response?.data?.message || 'Không thể xác thực, vui lòng thử lại',
                variant: 'error',
            });
        } finally {
            setIsVerifyingHue(false);
        }
    };

    const [customerCancelModal, setCustomerCancelModal] = useState<{ isOpen: boolean; request: any | null }>({
        isOpen: false,
        request: null,
    });
    const [customerCancelReason, setCustomerCancelReason] = useState('');
    const [customerChangeType, setCustomerChangeType] = useState<'CANCELLATION' | 'RESCHEDULE'>('CANCELLATION');
    const [customerRequestedDate, setCustomerRequestedDate] = useState('');
    const [customerRequestedStart, setCustomerRequestedStart] = useState('');
    const [customerRequestedEnd, setCustomerRequestedEnd] = useState('');

    const cancelMutation = useMutation({
        mutationFn: ({ id, reason }: { id: string; reason: string }) =>
            bookingRequestApi.requestCancellation(id, reason),
        onSuccess: () => {
            toast({ title: 'Đã gửi yêu cầu hủy', description: 'Cơ sở sẽ xác nhận trước khi lịch được hủy.', variant: 'success' });
            refetchRequests();
            setCustomerCancelModal({ isOpen: false, request: null });
        },
        onError: (err: any) => {
            toast({
                title: 'Không thể hủy',
                description: err?.response?.data?.message || 'Có lỗi xảy ra khi hủy yêu cầu',
                variant: 'error'
            });
        }
    });
    const rescheduleMutation = useMutation({
        mutationFn: ({ id, reason, date, startTime, endTime }: { id: string; reason: string; date: string; startTime: string; endTime: string }) =>
            bookingRequestApi.requestReschedule(id, { reason, date, startTime, endTime }),
        onSuccess: () => {
            toast({ title: 'Đã gửi yêu cầu đổi lịch', description: 'Lịch cũ vẫn giữ nguyên đến khi cơ sở duyệt.', variant: 'success' });
            refetchRequests();
            setCustomerCancelModal({ isOpen: false, request: null });
        },
        onError: (err: any) => toast({
            title: 'Không thể đổi lịch',
            description: err?.response?.data?.message || 'Có lỗi xảy ra khi gửi yêu cầu',
            variant: 'error',
        }),
    });

    // Map selection and advanced search filters
    const [selectedMapVenueId, setSelectedMapVenueId] = useState<string>('');
    const [areaFilter, setAreaFilter] = useState<string>('all');
    const [minCourtsFilter, setMinCourtsFilter] = useState<number>(0);

    const { data: myRequests = [], isLoading: isLoadingRequests, isError: requestsError, refetch: refetchRequests } = useQuery<any[]>({
        queryKey: ['my-requests', portalCustomerId],
        queryFn: () => bookingRequestApi.getMyRequests().then(data => data.filter((b: any) => !b.notes?.includes('Zalo'))),
        enabled: activeTab === 'history' && !!portalToken,
        refetchInterval: activeTab === 'history' && portalToken ? 30_000 : false,
    });
    const filteredRequests = myRequests.filter((request: any) => {
        if (historyFilter === 'all') return true;
        const bookingEndTime = getBookingEndTime(request);
        if (!bookingEndTime) return historyFilter === 'upcoming';
        return historyFilter === 'upcoming' ? bookingEndTime > historyNow : bookingEndTime <= historyNow;
    });
    const { data: venueReviews = [], isLoading: isLoadingReviews } = useQuery({
        queryKey: ['venue-reviews-public', selectedVenueDetail?.id],
        queryFn: () => venueReviewApi.getPublic(selectedVenueDetail!.id),
        enabled: !!selectedVenueDetail && activeModalTab === 'reviews',
    });
    const {
        data: eligibleReviewBookings = [],
        isLoading: isLoadingEligibleReviewBookings,
        isError: isEligibleReviewBookingsError,
        error: eligibleReviewBookingsError,
    } = useQuery({
        queryKey: ['eligible-review-bookings', portalCustomerId],
        queryFn: () => venueReviewApi.getEligibleBookings(),
        enabled: !!portalToken && !!selectedVenueDetail && activeModalTab === 'reviews',
        refetchInterval: activeModalTab === 'reviews' && portalToken ? 30_000 : false,
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
        const eligibleBooking = eligibleReviewBookings.find((booking) =>
            booking.id === reviewBookingId && booking.court.venue.id === selectedVenueDetail.id,
        );
        if (!eligibleBooking || !reviewContent.trim()) {
            toast({ title: 'Chỉ có thể đánh giá sau khi chọn một lịch đã hoàn thành', variant: 'error' });
            return;
        }
        setReviewSubmitting(true);
        try {
            await venueReviewApi.createPublic({
                bookingId: reviewBookingId,
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
            setReviewBookingId('');
            queryClient.invalidateQueries({ queryKey: ['venue-reviews-public', selectedVenueDetail.id] });
            queryClient.invalidateQueries({ queryKey: ['eligible-review-bookings', portalCustomerId] });
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
                    if (venueList.length > 0) {
                        setSelectedMapVenueId(prev => prev || venueList[0].id);
                    }
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

        // Area filter
        if (areaFilter !== 'all') {
            if (!venue.address || !venue.address.toLowerCase().includes(areaFilter.toLowerCase())) {
                return false;
            }
        }

        // Min courts filter
        const courtCount = venue.courts?.length || venue._count?.courts || 0;
        if (minCourtsFilter > 0 && courtCount < minCourtsFilter) {
            return false;
        }

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
        localStorage.removeItem('portalUserPhone');
        localStorage.removeItem('portalUserId');
        localStorage.removeItem('portalUser');
        setPortalToken('');
        setUserPhone('');
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
                    <section className="relative isolate overflow-hidden rounded-[28px] bg-gradient-to-br from-[#063d2c] via-[#087a4c] to-[#16a36a] p-6 text-white shadow-[0_24px_60px_-28px_rgba(6,61,44,0.65)] sm:p-8 lg:p-10">
                        {/* Hiệu ứng nền mờ */}
                        <div className="absolute -right-16 -top-24 -z-10 h-72 w-72 rounded-full border-[36px] border-white/5" />
                        <div className="absolute -bottom-40 right-24 -z-10 h-80 w-80 rounded-full bg-lime-300/10 blur-2xl" />

                        <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
                            <div className="max-w-xl flex-1">
                                <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold tracking-wide text-emerald-50 backdrop-blur-sm">
                                    <Sparkles className="h-3.5 w-3.5 text-lime-300" />
                                    NHÀ THI ĐẤU ĐA NĂNG HUE
                                </span>
                                <h1 className="mt-4 text-3xl font-black leading-tight tracking-tight sm:text-4xl lg:text-[40px]">
                                    Sẵn sàng cho một
                                    <span className="block text-lime-300">trận đấu thật hay?</span>
                                </h1>
                                <p className="mt-3 text-sm leading-6 text-emerald-50/90 sm:text-base">
                                    Tìm sân phù hợp, xem thông tin và đặt lịch nhanh chóng ngay trên điện thoại.
                                </p>
                                <div className="mt-6 flex flex-wrap items-center gap-3">
                                    <button
                                        type="button"
                                        onClick={() => document.getElementById('venue-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                                        className="inline-flex items-center gap-2 rounded-xl bg-lime-300 px-5 py-3 text-sm font-bold text-emerald-950 shadow-lg shadow-black/10 transition hover:bg-lime-200 active:scale-95"
                                    >
                                        Tìm sân ngay
                                        <ChevronRight className="h-4 w-4" />
                                    </button>
                                    <span className="inline-flex items-center gap-2 text-sm font-medium text-white/85">
                                        <ShieldCheck className="h-4 w-4 text-lime-300" />
                                        Đặt sân tiện lợi, xác nhận nhanh
                                    </span>
                                </div>
                            </div>

                            {/* Poster Nhà Thi Đấu Đa Năng HUE */}
                            <div className="relative shrink-0 w-full sm:w-80 lg:w-[340px] xl:w-[380px]">
                                <div className="group relative overflow-hidden rounded-2xl border-2 border-white/30 bg-white/10 p-1.5 shadow-2xl backdrop-blur-md transition hover:scale-[1.02]">
                                    <img
                                        src="/nha-thi-dau-hue.jpg"
                                        alt="Nhà thi đấu đa năng HUE - Gắn kết để phát triển"
                                        className="w-full h-auto max-h-72 sm:max-h-80 lg:max-h-[320px] object-cover rounded-xl shadow-inner"
                                    />
                                    <div className="absolute bottom-3 left-3 right-3 rounded-xl bg-slate-950/75 px-3 py-1.5 backdrop-blur-md flex items-center justify-between text-[11px] font-bold text-white border border-white/15">
                                        <span>🏸 Cầu lông · Pickleball · Bóng bàn</span>
                                        <span className="text-lime-300">ĐH Kinh tế Huế</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Banner Đặc quyền HUE */}
                    <section className="overflow-hidden rounded-2xl border-2 border-emerald-400 bg-gradient-to-r from-emerald-900 via-teal-900 to-emerald-800 p-5 text-white shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-white border border-white/30 flex items-center justify-center p-1 shrink-0 shadow-md">
                                <img src="/logo-hue.jpg" alt="Logo Trường Đại học Kinh tế Huế" className="w-full h-full object-contain rounded-full" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="bg-lime-300 text-emerald-950 text-xs font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                                        Đặc quyền HUE
                                    </span>
                                    <span className="text-xs text-emerald-200">Trường ĐH Kinh tế Huế</span>
                                </div>
                                <h3 className="text-lg font-black mt-1">Giảm trực tiếp 20% tiền sân cho Sinh viên & Cán bộ trường</h3>
                                <p className="text-xs text-emerald-100/90 mt-0.5">Xác thực tài khoản bằng Mã số sinh viên (MSSV) để tự động áp dụng ưu đãi khi đặt sân tại trường.</p>
                            </div>
                        </div>
                        {loyaltyAccount?.isVerifiedHue ? (
                            <div className="px-4 py-2.5 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl text-white text-xs font-bold flex items-center gap-2 shrink-0">
                                <span className="w-2 h-2 rounded-full bg-lime-400 animate-pulse" />
                                <span>Đã xác thực MSSV: <strong className="text-lime-300">{loyaltyAccount?.studentId || 'Sinh viên HUE'}</strong> (-20%)</span>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => {
                                    if (!portalToken) {
                                        navigate("/dang-nhap");
                                    } else {
                                        setShowHueModal(true);
                                    }
                                }}
                                className="px-5 py-3 bg-lime-300 hover:bg-lime-200 text-emerald-950 font-black text-sm rounded-xl shadow-md shrink-0 transition-all flex items-center justify-center gap-2 active:scale-95"
                            >
                                <span>Xác thực MSSV ngay</span>
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        )}
                    </section>

                    {homeHighlights.length > 0 && (
                        <section aria-label="Ưu đãi và sự kiện" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {homeHighlights.map(item => (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => {
                                        setExploreFilter(item.type);
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

                        {/* Bộ lọc mở rộng: Khu vực & Số sân */}
                        <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-2.5 text-xs text-gray-600">
                            <span className="font-medium text-gray-500">Khu vực:</span>
                            <select
                                value={areaFilter}
                                onChange={(e) => setAreaFilter(e.target.value)}
                                className="rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-700 outline-none focus:border-emerald-500"
                            >
                                <option value="all">Tất cả khu vực</option>
                                {Array.from(new Set(venues.map(v => {
                                    if (!v.address) return '';
                                    const parts = v.address.split(',').map(s => s.trim());
                                    return parts.length >= 2 ? parts[parts.length - 2] : '';
                                }).filter(Boolean))).map((area) => (
                                    <option key={area} value={area}>{area}</option>
                                ))}
                            </select>

                            <span className="font-medium text-gray-500 ml-2">Số lượng sân:</span>
                            <select
                                value={minCourtsFilter}
                                onChange={(e) => setMinCourtsFilter(Number(e.target.value))}
                                className="rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-700 outline-none focus:border-emerald-500"
                            >
                                <option value={0}>Tất cả quy mô</option>
                                <option value={2}>Từ 2 sân trở lên</option>
                                <option value={4}>Từ 4 sân trở lên</option>
                            </select>

                            {(areaFilter !== 'all' || minCourtsFilter > 0) && (
                                <button
                                    type="button"
                                    onClick={() => { setAreaFilter('all'); setMinCourtsFilter(0); }}
                                    className="ml-auto text-xs font-semibold text-rose-600 hover:underline"
                                >
                                    Xóa lọc nâng cao
                                </button>
                            )}
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
                                        ? portalToken
                                            ? 'Chạm vào biểu tượng trái tim để lưu sân vào tài khoản của bạn.'
                                            : 'Khách vãng lai lưu yêu thích trên thiết bị hiện tại; đăng nhập để đồng bộ với tài khoản.'
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
                                                    status.isOpen ? 'bg-white/95 text-emerald-800' : 'bg-white/95 text-gray-700'
                                                }`}>
                                                    <span className={`h-1.5 w-1.5 rounded-full ${status.isOpen ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                                                    {status.statusLabel}
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

            {/* Map View - Interactive Map & Venue Explorer */}
            {activeTab === 'map' && (() => {
                const currentMapVenue = venues.find(v => v.id === selectedMapVenueId) || venues[0] || null;
                return (
                    <div className="flex flex-col min-h-[calc(100vh-80px)] bg-gray-50 pb-28">
                        <div className="bg-white border-b border-gray-200 px-4 py-4">
                            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div>
                                    <h1 className="text-xl sm:text-2xl font-black text-gray-900 flex items-center gap-2">
                                        <MapIcon className="w-6 h-6 text-emerald-600" />
                                        Bản đồ cơ sở & chỉ đường
                                    </h1>
                                    <p className="text-xs sm:text-sm text-gray-600 mt-0.5">
                                        Chọn cơ sở bên dưới để xem vị trí trực tiếp trên bản đồ và nhận lộ trình di chuyển
                                    </p>
                                </div>
                                {currentMapVenue && (
                                    <button
                                        type="button"
                                        onClick={() => openVenueDirections(currentMapVenue)}
                                        className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl transition shadow-sm self-start sm:self-auto"
                                    >
                                        <Navigation className="w-3.5 h-3.5" />
                                        Chỉ đường đến {currentMapVenue.name}
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="max-w-7xl mx-auto w-full px-4 pt-4 flex-1 flex flex-col lg:flex-row gap-6">
                            {/* Map iframe column */}
                            <div className="lg:w-3/5 rounded-2xl overflow-hidden border border-gray-200 bg-white shadow-sm flex flex-col min-h-[380px] lg:min-h-[560px]">
                                <div className="p-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between text-xs text-gray-600">
                                    <span className="font-semibold text-gray-800 flex items-center gap-1.5 truncate">
                                        <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
                                        {currentMapVenue ? `${currentMapVenue.name} - ${currentMapVenue.address}` : 'Thành phố Huế'}
                                    </span>
                                    <span className="text-[11px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full shrink-0">
                                        Trực tuyến
                                    </span>
                                </div>
                                <div className="flex-1 w-full h-full min-h-[340px] relative">
                                    <iframe
                                        title="Bản đồ cơ sở sân cầu lông"
                                        src={`https://maps.google.com/maps?q=${encodeURIComponent(currentMapVenue ? `${currentMapVenue.name}, ${currentMapVenue.address}` : 'Sân cầu lông Huế, Thừa Thiên Huế')}&t=&z=16&ie=UTF8&iwloc=&output=embed`}
                                        width="100%"
                                        height="100%"
                                        style={{ border: 0, minHeight: '340px', width: '100%', height: '100%' }}
                                        allowFullScreen={true}
                                        loading="lazy"
                                    />
                                </div>
                            </div>

                            {/* Venue list column */}
                            <div className="lg:w-2/5 flex flex-col gap-3 overflow-y-auto max-h-[620px] pr-1">
                                <div className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">
                                    Danh sách {venues.length} cơ sở
                                </div>
                                {loading ? (
                                    <div className="rounded-2xl bg-white p-8 text-center text-gray-500">Đang tải danh sách cơ sở...</div>
                                ) : venues.length === 0 ? (
                                    <div className="rounded-2xl bg-white p-8 text-center text-gray-500">Chưa có cơ sở nào.</div>
                                ) : (
                                    venues.map(venue => {
                                        const status = getOperatingStatus(venue);
                                        const isSelected = (currentMapVenue?.id === venue.id);
                                        const courtCount = venue.courts?.length || venue._count?.courts || 0;

                                        return (
                                            <article
                                                key={venue.id}
                                                onClick={() => setSelectedMapVenueId(venue.id)}
                                                className={`rounded-2xl border p-4 bg-white transition-all cursor-pointer ${
                                                    isSelected 
                                                        ? 'border-emerald-600 ring-2 ring-emerald-500/20 shadow-md bg-emerald-50/20' 
                                                        : 'border-gray-200 hover:border-emerald-300 hover:shadow-sm'
                                                }`}
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <div>
                                                        <h3 className="font-bold text-gray-900 text-base flex items-center gap-1.5">
                                                            {venue.name}
                                                            {isSelected && (
                                                                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-600 text-white">
                                                                    Đang ghim
                                                                </span>
                                                            )}
                                                        </h3>
                                                        <p className="mt-1 flex items-start gap-1.5 text-xs text-gray-600 leading-relaxed">
                                                            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                                                            <span>{venue.address || 'Chưa cập nhật địa chỉ'}</span>
                                                        </p>
                                                    </div>
                                                    <span className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                                                        status.isOpen ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                                    }`}>
                                                        <span className={`w-1.5 h-1.5 rounded-full ${status.isOpen ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                                                        {status.statusLabel}
                                                    </span>
                                                </div>

                                                <div className="mt-2.5 flex items-center gap-3 text-xs text-gray-500 pt-2 border-t border-gray-100">
                                                    <span className="flex items-center gap-1">
                                                        <Clock className="w-3.5 h-3.5 text-gray-400" />
                                                        {status.dayName}: <strong className="text-gray-700">{status.text}</strong>
                                                    </span>
                                                    {courtCount > 0 && (
                                                        <span>• Quy mô: <strong className="text-gray-700">{courtCount} sân</strong></span>
                                                    )}
                                                </div>

                                                <div className="mt-3 flex gap-2" onClick={e => e.stopPropagation()}>
                                                    <button
                                                        type="button"
                                                        onClick={() => openVenueDirections(venue)}
                                                        className="flex-1 rounded-xl border border-emerald-700 px-3 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-50 transition"
                                                    >
                                                        Chỉ đường
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleSelectVenue(venue)}
                                                        className="flex-1 rounded-xl bg-emerald-700 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-800 transition"
                                                    >
                                                        Đặt sân
                                                    </button>
                                                </div>
                                            </article>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>
                );
            })()}

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

                    {portalToken ? (
                        <section className="mb-6 overflow-hidden rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50/70 via-white to-orange-50/50 shadow-xs transition-all">
                            {/* Header rút gọn dạng thẻ ngắn (Compact Short Bar) */}
                            <div className="flex items-center justify-between gap-3 p-4 sm:p-5">
                                <div className="flex items-center gap-3.5 min-w-0">
                                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 shadow-xs">
                                        <Gift className="h-5 w-5" />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="text-xs font-bold uppercase tracking-wider text-amber-800">Quà tặng thành viên</p>
                                            <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100/80 text-amber-800">
                                                100 điểm = 10.000đ
                                            </span>
                                        </div>
                                        <div className="flex items-baseline gap-2 mt-0.5">
                                            <h3 className="text-xl font-black text-slate-900">
                                                {isLoadingLoyalty ? '...' : (loyaltyAccount?.points ?? 0).toLocaleString('vi-VN')}
                                                <span className="ml-1 text-xs font-bold text-amber-700">điểm</span>
                                            </h3>
                                            <span className="text-xs text-slate-500">
                                                (Khả dụng: <strong className="text-amber-800">{Math.max(0, (loyaltyAccount?.points ?? 0) - (loyaltyAccount?.reservedPoints ?? 0)).toLocaleString('vi-VN')}</strong>)
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setIsLoyaltyExpanded(!isLoyaltyExpanded)}
                                    className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-amber-900 bg-amber-100/80 hover:bg-amber-200/80 rounded-xl transition-all active:scale-95 shadow-xs"
                                >
                                    <span>{isLoyaltyExpanded ? 'Thu gọn' : 'Xem lịch sử'}</span>
                                    {isLoyaltyExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                </button>
                            </div>

                            {/* Khung chi tiết và lịch sử có thể thu gọn / mở rộng, giới hạn chiều cao chống tràn */}
                            {isLoyaltyExpanded && (
                                <div className="border-t border-amber-100 bg-white/70 animate-in fade-in slide-in-from-top-1 duration-200">
                                    <div className="px-5 py-2.5 text-xs text-slate-600 border-b border-amber-100/60 leading-relaxed bg-amber-50/40">
                                        💡 Mỗi hóa đơn thanh toán từ 100.000đ nhận 1 điểm. Dùng điểm giảm tối đa 20% tiền sân khi đặt trực tuyến.
                                    </div>

                                    <div className="p-4 sm:p-5">
                                        <div className="flex items-center justify-between mb-2">
                                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                                                Lịch sử giao dịch ({loyaltyAccount?.pointsTransactions.length || 0})
                                            </h4>
                                            {loyaltyAccount?.pointsTransactions && loyaltyAccount.pointsTransactions.length > 4 && (
                                                <span className="text-[11px] text-slate-400">Cuộn để xem thêm</span>
                                            )}
                                        </div>

                                        {isLoyaltyError ? (
                                            <div className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700">
                                                Không tải được lịch sử điểm.
                                                <button onClick={() => void refetchLoyalty()} className="ml-2 font-bold underline">Thử lại</button>
                                            </div>
                                        ) : !loyaltyAccount?.pointsTransactions.length ? (
                                            <p className="text-xs text-slate-500 py-2 italic">Chưa có giao dịch tích điểm nào.</p>
                                        ) : (
                                            <div className="max-h-56 overflow-y-auto pr-1 divide-y divide-amber-100/70">
                                                {loyaltyAccount.pointsTransactions.map((entry) => (
                                                    <div key={entry.id} className="flex items-center justify-between gap-3 py-2 text-xs">
                                                        <div className="min-w-0">
                                                            <p className="truncate font-medium text-slate-700">{entry.reason}</p>
                                                            <p className="text-[11px] text-slate-400">
                                                                {new Date(entry.createdAt).toLocaleDateString('vi-VN')} {new Date(entry.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                                            </p>
                                                        </div>
                                                        <span className={`shrink-0 font-bold ${entry.points > 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                                                            {entry.points > 0 ? '+' : ''}{entry.points.toLocaleString('vi-VN')} đ
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </section>
                    ) : (
                        <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h3 className="font-bold text-amber-950">Tích điểm cho mỗi lần chơi</h3>
                                <p className="mt-1 text-sm text-amber-800">Đăng nhập để theo dõi điểm và đổi ưu đãi đặt sân.</p>
                            </div>
                            <button onClick={() => navigate('/dang-nhap')} className="shrink-0 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-800">Đăng nhập</button>
                        </div>
                    )}

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
                <div className="min-h-[calc(100vh-80px)] bg-[#f5f7f6] px-4 pb-28 pt-5 sm:px-6 sm:pt-8">
                    <div className="mx-auto max-w-6xl">
                        <section className="relative isolate overflow-hidden rounded-[28px] bg-gradient-to-br from-[#073c2b] via-[#08784b] to-[#16a36a] px-5 py-6 text-white shadow-[0_24px_60px_-32px_rgba(6,61,44,0.75)] sm:px-8 sm:py-9">
                            <div className="absolute -right-12 -top-20 -z-10 h-64 w-64 rounded-full border-[32px] border-white/5" />
                            <div className="absolute -bottom-28 right-32 -z-10 h-56 w-56 rounded-full bg-emerald-300/10 blur-2xl" />
                            <div className="flex items-center justify-between gap-3">
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('home')}
                                    className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-white/90 transition hover:bg-white/20"
                                >
                                    <ChevronLeft className="h-4 w-4" /> Trang chủ
                                </button>
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-emerald-50">
                                    <Sparkles className="h-3.5 w-3.5" /> Tin mới từ hệ thống
                                </span>
                            </div>
                            <div className="mt-7 max-w-2xl sm:mt-9">
                                <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-200">Dành cho người yêu cầu lông</p>
                                <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Khám phá điều mới mẻ</h1>
                                <p className="mt-3 max-w-xl text-sm leading-6 text-emerald-50/85 sm:text-base">
                                    Theo dõi sự kiện, khóa học, ưu đãi và những thông tin mới nhất từ các sân.
                                </p>
                            </div>
                            <div className="mt-6 inline-flex items-center gap-2 rounded-xl border border-white/15 bg-black/10 px-3 py-2 text-xs font-medium text-white/90">
                                <Compass className="h-4 w-4" />
                                {exploreItems.length} nội dung đang được hiển thị
                            </div>
                        </section>

                        <section className="mt-6">
                            <div className="mb-3 flex items-end justify-between gap-3">
                                <div>
                                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-700">Chọn chủ đề</p>
                                    <h2 className="mt-1 text-lg font-extrabold tracking-tight text-gray-900">Nội dung dành cho bạn</h2>
                                </div>
                                <span className="text-xs font-medium text-gray-500">{filteredExploreItems.length} kết quả</span>
                            </div>
                            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 scrollbar-hide sm:mx-0 sm:flex-wrap sm:px-0">
                                <button
                                    type="button"
                                    onClick={() => setExploreFilter('all')}
                                    className={`shrink-0 rounded-full border px-4 py-2 text-sm font-bold transition ${
                                        exploreFilter === 'all'
                                            ? 'border-emerald-800 bg-emerald-800 text-white shadow-sm'
                                            : 'border-gray-200 bg-white text-gray-600 hover:border-emerald-300 hover:text-emerald-800'
                                    }`}
                                >
                                    Tất cả <span className="ml-1 opacity-70">{exploreItems.length}</span>
                                </button>
                                {(['EVENT', 'COURSE', 'NEWS', 'DEAL', 'PASS'] as ExploreContentType[]).map((type) => {
                                    const count = getByType(type).length;
                                    return (
                                        <button
                                            key={type}
                                            type="button"
                                            onClick={() => setExploreFilter(type)}
                                            className={`shrink-0 rounded-full border px-4 py-2 text-sm font-bold transition ${
                                                exploreFilter === type
                                                    ? 'border-emerald-800 bg-emerald-800 text-white shadow-sm'
                                                    : 'border-gray-200 bg-white text-gray-600 hover:border-emerald-300 hover:text-emerald-800'
                                            }`}
                                        >
                                            <span className="mr-1.5">{TYPE_ICONS[type]}</span>{TYPE_LABELS[type]}
                                            <span className="ml-1 opacity-70">{count}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </section>

                        <section className="mt-5">
                            {isLoadingExploreItems ? (
                                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                                    {[1, 2, 3].map((item) => (
                                        <div key={item} className="overflow-hidden rounded-3xl border border-gray-100 bg-white">
                                            <div className="h-48 animate-pulse bg-gray-200" />
                                            <div className="space-y-3 p-5">
                                                <div className="h-4 w-24 animate-pulse rounded-full bg-gray-200" />
                                                <div className="h-6 w-4/5 animate-pulse rounded bg-gray-200" />
                                                <div className="h-4 w-full animate-pulse rounded bg-gray-100" />
                                                <div className="h-4 w-2/3 animate-pulse rounded bg-gray-100" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : isExploreItemsError ? (
                                <div className="rounded-3xl border border-gray-200 bg-white px-5 py-14 text-center shadow-sm">
                                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-gray-600">
                                        <RefreshCw className="h-6 w-6" />
                                    </div>
                                    <h3 className="mt-4 font-bold text-gray-900">Chưa tải được nội dung</h3>
                                    <p className="mt-1 text-sm text-gray-500">Kiểm tra kết nối rồi thử tải lại.</p>
                                    <button
                                        type="button"
                                        onClick={() => void refetchExploreItems()}
                                        className="mt-5 rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-900"
                                    >
                                        Thử tải lại
                                    </button>
                                </div>
                            ) : filteredExploreItems.length === 0 ? (
                                <div className="rounded-3xl border border-dashed border-gray-300 bg-white px-5 py-14 text-center">
                                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-3xl">
                                        {exploreFilter === 'all' ? '🏸' : TYPE_ICONS[exploreFilter]}
                                    </div>
                                    <h3 className="mt-4 font-bold text-gray-900">
                                        {exploreFilter === 'all' ? 'Nội dung mới đang được chuẩn bị' : `Chưa có ${TYPE_LABELS[exploreFilter].toLowerCase()} nào`}
                                    </h3>
                                    <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-gray-500">
                                        Các thông tin được cập nhật bởi đội ngũ sân sẽ xuất hiện tại đây. Trong lúc chờ, bạn có thể tìm và đặt sân phù hợp.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab('home')}
                                        className="mt-5 rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-900"
                                    >
                                        Khám phá sân
                                    </button>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                                    {filteredExploreItems.map((item) => {
                                        const action = getExploreAction(item);
                                        const startDate = formatExploreDate(item.startDate);
                                        const endDate = formatExploreDate(item.endDate);
                                        return (
                                            <article
                                                key={item.id}
                                                className="group flex min-w-0 flex-col overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-[0_8px_30px_-24px_rgba(15,23,42,0.3)] transition duration-200 hover:-translate-y-1 hover:border-emerald-100 hover:shadow-[0_24px_45px_-28px_rgba(15,23,42,0.35)]"
                                            >
                                                <div className={`relative isolate flex aspect-[16/10] items-center justify-center overflow-hidden bg-gradient-to-br ${exploreTypeBackgrounds[item.type]}`}>
                                                    <span className="text-7xl opacity-70 transition duration-300 group-hover:scale-110">{TYPE_ICONS[item.type]}</span>
                                                    {item.imageUrl && (
                                                        <img
                                                            src={item.imageUrl}
                                                            alt=""
                                                            loading="lazy"
                                                            onError={(event) => { event.currentTarget.style.display = 'none'; }}
                                                            className="absolute inset-0 -z-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
                                                        />
                                                    )}
                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/5 to-black/15" />
                                                    <span className="absolute left-4 top-4 rounded-full border border-white/20 bg-black/25 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-md">
                                                        {TYPE_ICONS[item.type]} <span className="ml-1">{TYPE_LABELS[item.type]}</span>
                                                    </span>
                                                    {item.badge && (
                                                        <span className="absolute right-4 top-4 rounded-full bg-white px-3 py-1.5 text-[11px] font-extrabold text-gray-900 shadow-sm">
                                                            {item.badge}
                                                        </span>
                                                    )}
                                                    <h3 className="absolute bottom-4 left-5 right-5 line-clamp-2 text-xl font-black leading-tight text-white drop-shadow sm:text-2xl">
                                                        {item.title}
                                                    </h3>
                                                </div>
                                                <div className="flex flex-1 flex-col p-5">
                                                    {item.description && (
                                                        <p className="line-clamp-3 whitespace-pre-line text-sm leading-6 text-gray-600">{item.description}</p>
                                                    )}
                                                    {(startDate || endDate) && (
                                                        <div className="mt-4 flex items-start gap-2 rounded-xl bg-gray-50 px-3 py-2.5 text-xs font-medium text-gray-600">
                                                            <CalendarRange className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                                                            <span>
                                                                {startDate && endDate
                                                                    ? `${startDate} – ${endDate}`
                                                                    : startDate
                                                                        ? `Bắt đầu ${startDate}`
                                                                        : `Đến hết ${endDate}`}
                                                            </span>
                                                        </div>
                                                    )}
                                                    <div className="mt-auto flex items-end justify-between gap-3 border-t border-gray-100 pt-4">
                                                        <div className="min-w-0">
                                                            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                                                                {item.price ? 'Thông tin giá' : 'Cập nhật mới'}
                                                            </p>
                                                            {item.price ? (
                                                                <p className="mt-1 break-words text-lg font-black leading-tight text-emerald-800">{item.price}</p>
                                                            ) : (
                                                                <p className="mt-1 text-sm font-semibold text-gray-700">{TYPE_LABELS[item.type]}</p>
                                                            )}
                                                        </div>
                                                        {action && (
                                                            <a
                                                                href={action.href}
                                                                target={action.external ? '_blank' : undefined}
                                                                rel={action.external ? 'noopener noreferrer' : undefined}
                                                                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-emerald-800 px-3.5 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-900"
                                                            >
                                                                {action.text}
                                                                <ArrowUpRight className="h-3.5 w-3.5" />
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>
                                            </article>
                                        );
                                    })}
                                </div>
                            )}
                        </section>
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
                        {!portalToken ? (
                            <div className="text-center py-20 bg-white rounded-2xl border border-gray-100 flex flex-col items-center">
                                <User className="w-16 h-16 text-gray-300 mb-4" />
                                <p className="text-gray-500 font-medium mb-4">Đăng nhập để xem và quản lý lịch đặt của bạn</p>
                                <button
                                    onClick={() => navigate('/dang-nhap')}
                                    className="px-6 py-2 bg-[#19b251] text-white font-bold rounded-full"
                                >
                                    Đăng nhập
                                </button>
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
                                                req.checkIn?.status === 'NO_SHOW' ? 'bg-rose-100 text-rose-700' :
                                                req.cancellationRequestStatus === 'PENDING' ? 'bg-amber-100 text-amber-700' :
                                                req.status === 'CANCELLED' || req.status === 'REJECTED' ? 'bg-red-100 text-red-600' :
                                                req.status === 'EXPIRED' ? 'bg-gray-200 text-gray-700' :
                                                req.status === 'PENDING' ? 'bg-orange-100 text-orange-600' :
                                                req.status === 'APPROVED' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'
                                            }`}>
                                                {req.checkIn?.status === 'NO_SHOW' ? 'Khách vắng' :
                                                 req.cancellationRequestStatus === 'PENDING' ? `Chờ duyệt ${req.cancellationRequestType === 'RESCHEDULE' ? 'đổi lịch' : 'hủy'}` :
                                                 req.status === 'CANCELLED' ? 'Đã hủy' :
                                                 req.status === 'EXPIRED' ? 'Hết hạn thanh toán' :
                                                 req.status === 'PENDING' ? 'Chờ xác nhận' :
                                                 req.status === 'APPROVED' ? 'Đã xác nhận' :
                                                 req.status === 'REJECTED' ? 'Đã từ chối' : req.status}
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
                                                    {req.paymentMethod === 'VNPAY' ? 'VNPay' : 'Chuyển khoản'} · {req.paymentStatus === 'PAID' ? 'Đã xác nhận tiền nhận' : req.status === 'EXPIRED' ? 'Đã hết hạn' : 'Chờ xác nhận'}
                                                    {getBookingRequestTotal(req) > 0 && <span className="block text-xs">Tổng: {formatVnd(getBookingRequestTotal(req))}</span>}
                                                    {req.paymentStatus === 'PAID' && <span className="block text-xs">Đã nhận: {formatVnd(req.paymentAmount || 0)}</span>}
                                                </span>
                                            </div>
                                            {req.paymentMethod === 'DEPOSIT_TRANSFER' && req.transferReference && (
                                                <div className="rounded-lg border border-emerald-100 bg-white p-2 text-xs">
                                                    <p><span className="text-gray-500">Nội dung chuyển khoản:</span> <strong className="text-emerald-800">{req.transferReference}</strong></p>
                                                    {req.status === 'PENDING' && req.expiresAt && (
                                                        <p className="mt-1 text-amber-700">Hạn giữ sân: {new Date(req.expiresAt).toLocaleString('vi-VN')}</p>
                                                    )}
                                                </div>
                                            )}
                                            {req.status === 'APPROVED' && (
                                                <div className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                                                    {req.checkIn?.status === 'NO_SHOW' ? (
                                                        <p className="text-sm font-semibold text-rose-800">
                                                            Lịch đã được hệ thống tự động ghi nhận khách vắng sau giờ kết thúc vì chưa check-in.
                                                        </p>
                                                    ) : req.checkIn?.checkedInAt ? (
                                                        <p className="text-sm font-semibold text-emerald-800">
                                                            Lịch đã check-in lúc {new Date(req.checkIn.checkedInAt).toLocaleString('vi-VN')}.
                                                        </p>
                                                    ) : req.checkIn?.checkInToken ? (
                                                        <div className="flex flex-col items-center gap-3 sm:flex-row">
                                                            <BookingCheckInQr token={req.checkIn.checkInToken} />
                                                            <div className="text-center text-xs text-emerald-900 sm:text-left">
                                                                <p className="font-bold">Mã QR xem lịch đặt</p>
                                                                <p className="mt-1">Tải mã về hoặc quét để mở nhanh thông tin lịch. Nhân viên sẽ check-in trực tiếp trên lịch quản lý.</p>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="text-sm text-amber-900">
                                                            <p className="font-bold">Chưa có mã QR check-in cho lịch này.</p>
                                                            <p className="mt-1 text-xs">Tải lại trang sau ít phút. Nếu vẫn chưa thấy mã, vui lòng liên hệ cơ sở để kiểm tra lịch đặt.</p>
                                                            <button
                                                                type="button"
                                                                onClick={() => void refetchRequests()}
                                                                className="mt-2 rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-900 hover:bg-amber-200"
                                                            >
                                                                Tải lại lịch
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            {req.status === 'PENDING' && req.paymentStatus === 'PAID' && (
                                                <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                                                    <p className="font-bold">Đã nhận thanh toán, lịch đang chờ cơ sở xác nhận.</p>
                                                    <p className="mt-1 text-xs">Mã QR check-in sẽ hiển thị tại đây sau khi lịch được xác nhận.</p>
                                                </div>
                                            )}

                                            {/* Hiển thị lý do đổi lịch/hủy */}
                                            {req.cancellationRequestReason && (
                                                <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50/80 p-2.5 text-xs text-amber-800">
                                                    <span className="font-bold">Lý do yêu cầu {req.cancellationRequestType === 'RESCHEDULE' ? 'đổi lịch' : 'hủy'}: </span>
                                                    {req.cancellationRequestReason}
                                                    {req.cancellationRequestType === 'RESCHEDULE' && req.requestedDate && (
                                                        <p className="mt-1 font-semibold">Khung giờ đề xuất: {new Date(req.requestedDate).toLocaleDateString('vi-VN')} · {req.requestedStartTime}–{req.requestedEndTime}</p>
                                                    )}
                                                </div>
                                            )}
                                            {req.cancellationRequestStatus === 'REJECTED' && (
                                                <div className="mt-2 rounded-xl border border-sky-200 bg-sky-50/80 p-2.5 text-xs text-sky-800">
                                                    Cơ sở đã từ chối yêu cầu hủy; lịch đặt vẫn còn hiệu lực.
                                                </div>
                                            )}
                                            {req.notes && (req.status === 'REJECTED' || req.status === 'CANCELLED') && (
                                                <div className="mt-2 rounded-xl border border-rose-200 bg-rose-50/80 p-2.5 text-xs text-rose-800">
                                                    <span className="font-bold">Lý do: </span>
                                                    {req.notes}
                                                </div>
                                            )}

                                            {/* Thao tác quản lý lịch đặt */}
                                            {(req.status === 'PENDING' || req.status === 'APPROVED') && (
                                                <div className="mt-3 flex flex-col gap-3 border-t border-gray-100 pt-3">
                                                    <span className={`w-fit max-w-full rounded-lg px-3 py-2 text-xs font-medium leading-snug ${
                                                        req.cancellationRequestStatus === 'PENDING'
                                                            ? 'bg-amber-50 text-amber-800'
                                                            : req.status === 'PENDING'
                                                                ? 'bg-orange-50 text-orange-700'
                                                                : 'bg-emerald-50 text-emerald-800'
                                                    }`}>
                                                        {req.cancellationRequestStatus === 'PENDING'
                                                            ? `Yêu cầu ${req.cancellationRequestType === 'RESCHEDULE' ? 'đổi lịch' : 'hủy'} đang chờ cơ sở duyệt`
                                                            : req.status === 'PENDING'
                                                                ? 'Chờ cơ sở xác nhận'
                                                                : 'Đã giữ chỗ thành công'}
                                                    </span>
                                                    {req.cancellationRequestStatus !== 'PENDING' && (
                                                        <div className="grid grid-cols-2 gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setCustomerChangeType('CANCELLATION');
                                                                setCustomerCancelModal({ isOpen: true, request: req });
                                                                setCustomerCancelReason('');
                                                            }}
                                                            className="inline-flex min-w-0 items-center justify-center gap-1 rounded-lg border border-rose-200 px-2.5 py-2 text-center text-xs font-semibold leading-tight text-rose-600 transition hover:bg-rose-50 hover:text-rose-700"
                                                        >
                                                            <X className="w-3.5 h-3.5" />
                                                            Yêu cầu hủy
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setCustomerChangeType('RESCHEDULE');
                                                                setCustomerCancelModal({ isOpen: true, request: req });
                                                                setCustomerCancelReason('');
                                                                setCustomerRequestedDate('');
                                                                setCustomerRequestedStart('');
                                                                setCustomerRequestedEnd('');
                                                            }}
                                                            className="inline-flex min-w-0 items-center justify-center gap-1 rounded-lg border border-emerald-200 px-2.5 py-2 text-center text-xs font-semibold leading-tight text-emerald-700 transition hover:bg-emerald-50 hover:text-emerald-800"
                                                        >
                                                            Đổi lịch
                                                        </button>
                                                        </div>
                                                    )}
                                                    {req.courtId && req.venueId && (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                const date = new Date(req.date);
                                                                const dateValue = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
                                                                navigate(`/dat-lich/${req.venueId}/${req.courtId}?date=${dateValue}&startTime=${encodeURIComponent(req.startTime)}&endTime=${encodeURIComponent(req.endTime)}`);
                                                            }}
                                                            className="w-full rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-center text-sm font-bold leading-tight text-emerald-800 transition hover:bg-emerald-100"
                                                        >
                                                            Đặt lại khung giờ này
                                                        </button>
                                                    )}
                                                </div>
                                            )}
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
                                    <img src="/images/courts/logo.jpg" alt="Logo HUE" className="w-full h-full object-contain p-1" />
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
                                    {(() => {
                                        const status = getOperatingStatus(selectedVenueDetail);
                                        return (
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm bg-gray-50/90 p-3.5 rounded-xl border border-gray-100">
                                                <div className="flex items-center gap-2.5 text-gray-700 font-medium">
                                                    <Clock className="w-4 h-4 text-[#19b251] shrink-0" />
                                                    <span>
                                                        {status.dayName}: <strong className="text-gray-900">{status.text}</strong>
                                                    </span>
                                                </div>
                                                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold self-start sm:self-auto ${status.isOpen ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-800'}`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${status.isOpen ? 'bg-green-500 animate-pulse' : 'bg-amber-500'}`} />
                                                    <span>{status.statusLabel}</span>
                                                </div>
                                            </div>
                                        );
                                    })()}

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
                                <div className="max-h-[52vh] space-y-6 overflow-y-auto pr-1">
                                    {venueDetailLoading ? (
                                        <div className="py-10 text-center text-sm text-gray-500">Đang tải thông tin...</div>
                                    ) : (
                                        <>
                                            <section>
                                                <div className="mb-3 flex items-end justify-between gap-3">
                                                    <div>
                                                        <h4 className="font-bold text-slate-900">Bảng giá sân</h4>
                                                        <p className="mt-0.5 text-xs text-slate-500">Giá thuê được áp dụng theo ngày và khung giờ.</p>
                                                    </div>
                                                    <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">Giá / giờ</span>
                                                </div>
                                                {selectedVenueDetail.pricingRules?.length ? (
                                                    <div className="grid gap-3 sm:grid-cols-2">
                                                        {selectedVenueDetail.pricingRules.map((rule) => (
                                                            <article key={rule.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-emerald-200 hover:shadow-md">
                                                                <div className="flex items-start justify-between gap-3">
                                                                    <div className="min-w-0">
                                                                        <h5 className="break-words text-sm font-bold text-slate-900">{rule.name}</h5>
                                                                        <p className="mt-1 text-xs text-slate-500">
                                                                            {rule.dayOfWeek ? pricingDayLabels[rule.dayOfWeek] || rule.dayOfWeek : 'Mọi ngày'}
                                                                        </p>
                                                                    </div>
                                                                    <div className="shrink-0 text-right">
                                                                        <p className="text-base font-black leading-tight text-emerald-700">{formatVnd(rule.pricePerHour)}</p>
                                                                        <p className="mt-0.5 text-[10px] text-slate-500">mỗi giờ</p>
                                                                    </div>
                                                                </div>
                                                                <div className="mt-3 flex flex-wrap gap-2">
                                                                    <span className="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-800">
                                                                        {rule.startTime && rule.endTime ? `${rule.startTime} – ${rule.endTime}` : 'Mọi khung giờ'}
                                                                    </span>
                                                                    <span className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-600">
                                                                        30 phút · {formatVnd(rule.pricePerHour / 2)}
                                                                    </span>
                                                                </div>
                                                                {rule.description && <p className="mt-3 border-t border-slate-100 pt-3 text-xs leading-5 text-slate-500">{rule.description}</p>}
                                                            </article>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center text-sm text-slate-500">Cơ sở chưa cập nhật bảng giá.</p>
                                                )}
                                            </section>
                                            <section>
                                                <div className="mb-3">
                                                    <h4 className="font-bold text-slate-900">Sản phẩm & dịch vụ</h4>
                                                    <p className="mt-0.5 text-xs text-slate-500">Tiện ích có thể lựa chọn thêm khi đặt sân.</p>
                                                </div>
                                                <div className="grid gap-3 sm:grid-cols-2">
                                                    {selectedVenueDetail.products?.map((product) => (
                                                        <article key={product.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                                                            <div className="flex items-start justify-between gap-3">
                                                                <div className="min-w-0">
                                                                    <span className="inline-flex rounded-full bg-sky-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-sky-700">Sản phẩm</span>
                                                                    <h5 className="mt-2 break-words text-sm font-bold text-slate-900">{product.name}</h5>
                                                                </div>
                                                                <p className="shrink-0 text-sm font-extrabold text-emerald-700">{formatVnd(product.price)}</p>
                                                            </div>
                                                            <p className={`mt-3 text-xs font-medium ${product.stock > 0 ? 'text-slate-500' : 'text-rose-600'}`}>
                                                                {product.stock > 0 ? `Còn ${product.stock} ${product.unit || 'cái'}` : 'Tạm hết hàng'}
                                                            </p>
                                                            {product.description && <p className="mt-2 text-xs leading-5 text-slate-500">{product.description}</p>}
                                                        </article>
                                                    ))}
                                                    {selectedVenueDetail.services?.map((service) => (
                                                        <article key={service.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                                                            <div className="flex items-start justify-between gap-3">
                                                                <div className="min-w-0">
                                                                    <span className="inline-flex rounded-full bg-violet-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-violet-700">Dịch vụ</span>
                                                                    <h5 className="mt-2 break-words text-sm font-bold text-slate-900">{service.name}</h5>
                                                                </div>
                                                                <p className="shrink-0 text-sm font-extrabold text-emerald-700">{formatVnd(service.price)}</p>
                                                            </div>
                                                            <p className="mt-3 text-xs text-slate-500">Đơn vị: {service.unit || 'lần'}</p>
                                                            {service.description && <p className="mt-2 text-xs leading-5 text-slate-500">{service.description}</p>}
                                                        </article>
                                                    ))}
                                                    {!selectedVenueDetail.products?.length && !selectedVenueDetail.services?.length && (
                                                        <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center text-sm text-slate-500 sm:col-span-2">Cơ sở chưa cập nhật sản phẩm hoặc dịch vụ.</p>
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
                                        {!portalToken ? (
                                            <p className="rounded-lg bg-white p-2 text-xs text-amber-800">Đăng nhập tài khoản khách hàng để đánh giá lịch đã hoàn thành.</p>
                                        ) : (
                                            <>
                                                <select value={reviewBookingId} onChange={(event) => setReviewBookingId(event.target.value)} required disabled={isLoadingEligibleReviewBookings || isEligibleReviewBookingsError} className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-xs text-gray-900 disabled:cursor-not-allowed disabled:bg-gray-100">
                                                    <option value="">Chọn lịch đã hoàn thành tại cơ sở này</option>
                                                    {eligibleReviewBookings.filter((booking) => booking.court.venue.id === selectedVenueDetail.id).map((booking) => (
                                                        <option key={booking.id} value={booking.id}>
                                                            {booking.court.name} · {new Date(booking.date).toLocaleDateString('vi-VN')} · {booking.startTime}–{booking.endTime}
                                                        </option>
                                                    ))}
                                                </select>
                                                {isLoadingEligibleReviewBookings ? (
                                                    <p className="text-[11px] text-gray-500">Đang tải lịch đủ điều kiện đánh giá...</p>
                                                ) : isEligibleReviewBookingsError ? (
                                                    <p className="text-[11px] text-red-600">
                                                        {isAxiosError<{ message?: string }>(eligibleReviewBookingsError)
                                                            ? eligibleReviewBookingsError.response?.data?.message || 'Không thể tải lịch đánh giá. Vui lòng thử lại sau.'
                                                            : 'Không thể tải lịch đánh giá. Vui lòng thử lại sau.'}
                                                    </p>
                                                ) : !eligibleReviewBookings.some((booking) => booking.court.venue.id === selectedVenueDetail.id) && (
                                                    <p className="text-[11px] text-gray-500">
                                                        Không có lịch đủ điều kiện. Lịch phải đã check-out, gắn với tài khoản này và chưa được gửi đánh giá.
                                                    </p>
                                                )}
                                            </>
                                        )}
                                        <div className="flex items-center gap-0.5" role="group" aria-label="Chọn số sao">
                                            {[1, 2, 3, 4, 5].map((rating) => (
                                                <button key={rating} type="button" onClick={() => setReviewRating(rating)} aria-label={`${rating} sao`}>
                                                    <Star className={`w-4 h-4 ${rating <= reviewRating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
                                                </button>
                                            ))}
                                            <span className="ml-1.5 text-xs text-gray-600">{reviewRating}/5</span>
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
                                        <button type="submit" disabled={reviewSubmitting || !portalToken || !reviewBookingId} className="rounded-lg bg-[#19b251] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#159a45] disabled:opacity-60">
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

            {/* Customer cancellation / reschedule request */}
            {customerCancelModal.isOpen && customerCancelModal.request && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200 border border-gray-100">
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">
                                    {customerChangeType === 'RESCHEDULE' ? 'Yêu cầu đổi lịch đặt' : 'Yêu cầu hủy lịch đặt'}
                                </h3>
                                <p className="text-xs text-gray-500 mt-0.5">
                                    {customerCancelModal.request.venue?.name || 'Sân cầu lông'} • {customerCancelModal.request.startTime} - {customerCancelModal.request.endTime} ({new Date(customerCancelModal.request.date).toLocaleDateString('vi-VN')})
                                </p>
                            </div>
                            <button
                                onClick={() => setCustomerCancelModal({ isOpen: false, request: null })}
                                className="p-1 hover:bg-gray-100 rounded-full transition text-gray-400 hover:text-gray-600"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 leading-relaxed">
                                <p className="font-bold flex items-center gap-1.5 mb-1">
                                    <Info className="w-3.5 h-3.5 text-amber-600" />
                                    Chính sách đổi / hủy lịch
                                </p>
                                <p>
                                    Gửi yêu cầu ít nhất 24 giờ trước giờ bắt đầu. Yêu cầu chỉ có hiệu lực sau khi cơ sở duyệt; lịch hiện tại vẫn giữ nguyên trong lúc chờ. Với lịch đã thanh toán, hệ thống không tự hoàn tiền hoặc đổi hóa đơn — khoản tiền được giữ nguyên cho đến khi admin xử lý qua luồng hoàn hóa đơn hiện có.
                                </p>
                            </div>

                            {customerChangeType === 'RESCHEDULE' && (
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                    <label className="text-xs font-semibold text-gray-700">Ngày mới
                                        <input type="date" value={customerRequestedDate} min={new Date().toISOString().slice(0, 10)} onChange={(event) => setCustomerRequestedDate(event.target.value)} className="mt-1 block w-full rounded-lg border border-gray-200 bg-gray-50 px-2 py-2 text-xs" />
                                    </label>
                                    <label className="text-xs font-semibold text-gray-700">Từ
                                        <input type="time" value={customerRequestedStart} onChange={(event) => setCustomerRequestedStart(event.target.value)} className="mt-1 block w-full rounded-lg border border-gray-200 bg-gray-50 px-2 py-2 text-xs" />
                                    </label>
                                    <label className="text-xs font-semibold text-gray-700">Đến
                                        <input type="time" value={customerRequestedEnd} onChange={(event) => setCustomerRequestedEnd(event.target.value)} className="mt-1 block w-full rounded-lg border border-gray-200 bg-gray-50 px-2 py-2 text-xs" />
                                    </label>
                                    <p className="sm:col-span-3 text-[11px] text-gray-500">Duyệt đổi lịch sẽ giữ nguyên tổng tiền và trạng thái thanh toán hiện tại; mọi điều chỉnh tiền cần admin xử lý riêng.</p>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                                    Lý do
                                </label>
                                <textarea
                                    rows={3}
                                    value={customerCancelReason}
                                    onChange={(e) => setCustomerCancelReason(e.target.value)}
                                    placeholder={customerChangeType === 'RESCHEDULE' ? 'Vui lòng cho biết lý do đổi lịch...' : 'Vui lòng cho biết lý do hủy...'}
                                    maxLength={500}
                                    className="w-full text-xs p-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500"
                                />
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                    {[
                                        'Bận đột xuất',
                                        'Thời tiết / lý do sức khỏe',
                                        'Đặt nhầm sân / cơ sở'
                                    ].map((chip) => (
                                        <button
                                            key={chip}
                                            type="button"
                                            onClick={() => setCustomerCancelReason(chip)}
                                            className="text-[11px] bg-gray-100 hover:bg-gray-200 text-gray-700 px-2.5 py-1 rounded-full transition"
                                        >
                                            {chip}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={() => setCustomerCancelModal({ isOpen: false, request: null })}
                                    className="px-4 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition"
                                >
                                    Đóng
                                </button>
                                <button
                                    type="button"
                                    disabled={
                                        cancelMutation.isPending || rescheduleMutation.isPending || !customerCancelReason.trim() ||
                                        (customerChangeType === 'RESCHEDULE' && (!customerRequestedDate || !customerRequestedStart || !customerRequestedEnd))
                                    }
                                    onClick={() => {
                                        if (customerChangeType === 'RESCHEDULE') {
                                            rescheduleMutation.mutate({
                                                id: customerCancelModal.request.id,
                                                reason: customerCancelReason.trim(),
                                                date: customerRequestedDate,
                                                startTime: customerRequestedStart,
                                                endTime: customerRequestedEnd,
                                            });
                                        } else {
                                            cancelMutation.mutate({
                                                id: customerCancelModal.request.id,
                                                reason: customerCancelReason.trim()
                                            });
                                        }
                                    }}
                                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-sm disabled:opacity-50"
                                >
                                    {cancelMutation.isPending || rescheduleMutation.isPending ? 'Đang gửi yêu cầu...' : customerChangeType === 'RESCHEDULE' ? 'Gửi yêu cầu đổi lịch' : 'Gửi yêu cầu hủy'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Xác thực Sinh viên HUE */}
            <HueStudentVerifyModal 
                isOpen={showHueModal} 
                onClose={() => setShowHueModal(false)} 
                onSuccess={() => refetchLoyalty()} 
            />

            <ChatBotWidget />
        </div>
    );
}
