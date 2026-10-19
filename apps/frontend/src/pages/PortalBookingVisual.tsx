import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { 
    ChevronLeft, Clock, MapPin, 
    Phone, User, ShoppingBag, ChevronRight, Info, X, Heart
} from 'lucide-react';
import { venueApi } from '@/services/venue.service';
import { productApi, serviceApi } from '@/services/inventory.service';
import { operatingHourApi, OperatingHour } from '@/services/operating-hour.service';
import { bookingRequestApi } from '@/services/booking.service';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, cn } from '@/lib/utils';
import { format, isSameDay } from 'date-fns';
import { voucherApi } from '@/services/voucher.service';
import { portalAuthApi } from '@/services/portal-auth.service';

interface Court { id: string; name: string; status: string; }
interface Product { id: string; name: string; price: number; stock: number; image?: string; }
interface Service { id: string; name: string; price: number; }

const getNextHalfHour = (time: string) => {
    const [hour, minute] = time.split(':').map(Number);
    const nextMinute = minute + 30;
    const nextHour = hour + (nextMinute >= 60 ? 1 : 0);
    return `${String(nextHour).padStart(2, '0')}:${String(nextMinute % 60).padStart(2, '0')}`;
};

const getDurationLabel = (startTime: string, endTime: string) => {
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);
    const minutes = endHour * 60 + endMinute - (startHour * 60 + startMinute);
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return [
        hours > 0 ? `${hours} giờ` : '',
        remainingMinutes > 0 ? `${remainingMinutes} phút` : '',
    ].filter(Boolean).join(' ');
};



export default function PortalBookingVisual() {
    const { venueId, courtId } = useParams();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { toast } = useToast();

    const [venue, setVenue] = useState<any>(null);

    
    


    const [courts, setCourts] = useState<Court[]>([]);
    const [bookings, setBookings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [selectedDate, setSelectedDate] = useState<Date>(() => {
        const date = searchParams.get('date');
        const parsed = date ? new Date(`${date}T00:00:00`) : new Date();
        return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
    });
    const [viewMonth, setViewMonth] = useState<Date>(new Date());
    const [selectedCourt, setSelectedCourt] = useState<Court | null>(null);
    const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
    const [slotPeriod, setSlotPeriod] = useState<'all' | 'morning' | 'afternoon' | 'evening'>('all');
    const [showPricing, setShowPricing] = useState(false);
    const [operatingHours, setOperatingHours] = useState<OperatingHour[]>([]);

    const timeSlots = useMemo(() => {
        if (!operatingHours || operatingHours.length === 0) {
            return []; // User expects no slots if admin hasn't set any
        }
        
        // Generate a superset of all possible slots from all active hours across any day
        // (visibleSlots will filter them per day)
        let slots = new Set<string>();
        operatingHours.forEach((oh) => {
            const [startHour, startMin] = oh.startTime.split(':').map(Number);
            const [endHour, endMin] = oh.endTime.split(':').map(Number);
            const startTotalMinutes = startHour * 60 + startMin;
            const endTotalMinutes = endHour * 60 + endMin;
            for (let m = startTotalMinutes; m < endTotalMinutes; m += 30) {
                const h = Math.floor(m / 60);
                const mins = m % 60;
                slots.add(`${h.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`);
            }
        });
        return Array.from(slots).sort();
    }, [operatingHours]);
    
    const generateCalendarDays = () => {
        const year = viewMonth.getFullYear();
        const month = viewMonth.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        
        let startOffset = firstDay.getDay() - 1;
        if (startOffset === -1) startOffset = 6;
        
        const days: (Date | null)[] = [];
        for (let i = 0; i < startOffset; i++) days.push(null);
        for (let i = 1; i <= lastDay.getDate(); i++) days.push(new Date(year, month, i));
        return days;
    };
    
    const changeMonth = (offset: number) => {
        const newMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + offset, 1);
        const now = new Date();
        const currentM = new Date(now.getFullYear(), now.getMonth(), 1);
        const maxM = new Date(now.getFullYear(), now.getMonth() + 2, 1); // allow booking up to 2 months ahead
        if (newMonth >= currentM && newMonth <= maxM) setViewMonth(newMonth);
    };
    
    // Inventory
    const [products, setProducts] = useState<Product[]>([]);
    const [services, setServices] = useState<Service[]>([]);
    const [orderedItems, setOrderedItems] = useState<{ id: string; name: string; price: number; quantity: number; type: 'product' | 'service' }[]>([]);
    const [showInventory, setShowInventory] = useState(false);

    // Form
    const [showForm, setShowForm] = useState(false);
    const [bookingForm, setBookingForm] = useState({ name: '', phone: '', notes: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState<'VNPAY' | 'DEPOSIT_TRANSFER'>('VNPAY');
    const [paymentProof, setPaymentProof] = useState<string>('');
    const [paymentProofName, setPaymentProofName] = useState<string>('');
    const [voucherCodeInput, setVoucherCodeInput] = useState('');
    const [appliedVoucher, setAppliedVoucher] = useState<{code: string, discountAmount: number} | null>(null);
    const [isCheckingVoucher, setIsCheckingVoucher] = useState(false);
    const [availableLoyaltyPoints, setAvailableLoyaltyPoints] = useState(0);
    const [redeemPoints, setRedeemPoints] = useState(0);
    const [isLoadingLoyaltyPoints, setIsLoadingLoyaltyPoints] = useState(false);
    const [favoriteCourtIds, setFavoriteCourtIds] = useState<string[]>(() => {
        if (localStorage.getItem('portalUserToken')) return [];
        try { return JSON.parse(localStorage.getItem('portal_favorite_courts') || '[]'); } catch { return []; }
    });
    const [transferDetails, setTransferDetails] = useState<{
        requestId: string; reference: string; amount: number; expiresAt: string; date: string;
        startTime: string; endTime: string; courtName: string;
    } | null>(null);

    useEffect(() => {
        if (!localStorage.getItem('portalUserToken')) return;
        let active = true;
        portalAuthApi.getFavorites()
            .then((favorites) => {
                if (!active) return;
                setFavoriteCourtIds(favorites.courtIds);
                localStorage.removeItem('portal_favorite_courts');
            })
            .catch((error) => {
                console.error('Không thể đồng bộ sân yêu thích vào tài khoản:', error);
            });
        return () => {
            active = false;
        };
    }, []);

    const toggleFavoriteCourt = async (courtId: string) => {
        const isFavorite = favoriteCourtIds.includes(courtId);
        if (localStorage.getItem('portalUserToken')) {
            try {
                const favorites = await portalAuthApi.setFavoriteCourt(courtId, !isFavorite);
                setFavoriteCourtIds(favorites.courtIds);
            } catch (error: any) {
                toast({ title: 'Không thể cập nhật sân yêu thích', description: error?.response?.data?.message, variant: 'error' });
            }
            return;
        }
        const next = isFavorite ? favoriteCourtIds.filter((id) => id !== courtId) : [...favoriteCourtIds, courtId];
        setFavoriteCourtIds(next);
        localStorage.setItem('portal_favorite_courts', JSON.stringify(next));
        toast({ title: 'Yêu thích trên thiết bị này', description: 'Đăng nhập để đồng bộ sân yêu thích với tài khoản.' });
    };

    // Pre-fill user
    useEffect(() => {
        const uPhone = localStorage.getItem('portalUserPhone');
        const uName = localStorage.getItem('portalUser');
        if (uPhone) setBookingForm(prev => ({ ...prev, phone: uPhone }));
        if (uName) {
            try {
                const p = JSON.parse(uName);
                if (p.name) setBookingForm(prev => ({ ...prev, name: p.name }));
            } catch {}
        }
    }, []);

    // Fetch Venue
    useEffect(() => {
        if (!venueId) return;
        venueApi.getById(venueId).then(res => {
            if (!res.isActive) {
                toast({ title: 'Cơ sở hiện không nhận đặt sân', variant: 'error' });
                navigate('/trang-chu');
                return;
            }
            setVenue(res);
        }).catch(() => {
            toast({ title: 'Không tìm thấy cơ sở', variant: 'error' });
            navigate(-1);
        });
    }, [venueId, navigate, toast]);

    // Fetch Availability
    useEffect(() => {
        if (!venue) return;
        const fetchAvailability = async () => {
            setLoading(true);
            setOperatingHours([]);
            setProducts([]);
            setServices([]);
            try {
                const dateStr = format(selectedDate, 'yyyy-MM-dd');
                const res = await venueApi.getAvailability(venue.id, dateStr);
                const availableCourts = res.courts;
                setCourts(availableCourts);
                setBookings(res.bookings);
                
                if (availableCourts.length > 0) {
                    setSelectedCourt(current => availableCourts.find(
                        (court: Court) => court.id === (courtId || current?.id),
                    ) || availableCourts[0]);
                } else {
                    setSelectedCourt(null);
                }
                
                setSelectedSlots([]);

                try {
                    const [prodRes, servRes, opRes] = await Promise.all([
                        productApi.getAll({ venueId: venue.id, isActive: true, limit: 1000 }),
                        serviceApi.getAll({ venueId: venue.id, isActive: true, limit: 1000 }),
                        operatingHourApi.getAll({ venueId: venue.id, isActive: true })
                    ]);
                    setProducts(prodRes.data || []);
                    setServices(servRes.data || []);
                    setOperatingHours(opRes.data || []);
                } catch {
                    setOperatingHours([]);
                    setProducts([]);
                    setServices([]);
                    toast({ title: 'Không thể tải giờ hoạt động hoặc dịch vụ', variant: 'error' });
                }

            } catch {
                toast({ title: 'Lỗi tải dữ liệu', variant: 'error' });
            } finally {
                setLoading(false);
            }
        };
        fetchAvailability();
    }, [venue, selectedDate, courtId, toast]);

    const visibleSlots = useMemo(() => {
        if (!venue) return timeSlots;

        const dayOfWeek = selectedDate.getDay(); // 0=Sun, 1=Mon...
        
        // Find matching operating hours for this day
        const activeHours = operatingHours.filter(oh => {
            try {
                const days = JSON.parse(oh.daysOfWeek);
                return days.includes(dayOfWeek);
            } catch(e) { return false; }
        });

        if (activeHours.length === 0) { return []; }

        // Return slots that fall within ANY of the active operating hours
        return timeSlots.filter(time => {
            return activeHours.some(oh => time >= oh.startTime && time < oh.endTime);
        });
    }, [venue, operatingHours, selectedDate]);

    const filteredTimeSlots = useMemo(() => visibleSlots.filter((time) => {
        const hour = Number(time.slice(0, 2));
        if (slotPeriod === 'morning') return hour < 12;
        if (slotPeriod === 'afternoon') return hour >= 12 && hour < 18;
        if (slotPeriod === 'evening') return hour >= 18;
        return true;
    }), [visibleSlots, slotPeriod]);

    const timeSlotCounts = useMemo(() => ({
        all: visibleSlots.length,
        morning: visibleSlots.filter((time) => Number(time.slice(0, 2)) < 12).length,
        afternoon: visibleSlots.filter((time) => {
            const hour = Number(time.slice(0, 2));
            return hour >= 12 && hour < 18;
        }).length,
        evening: visibleSlots.filter((time) => Number(time.slice(0, 2)) >= 18).length,
    }), [visibleSlots]);

    const getSlotStatus = (time: string) => {
        if (!selectedCourt) return 'unavailable';
        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        const now = new Date();
        const nowStr = format(now, 'yyyy-MM-dd');
        const nowTime = format(now, 'HH:mm');
        
        if (dateStr === nowStr && time < nowTime) return 'past';
        
        const blockingSlot = bookings.find(b => 
            b.courtId === selectedCourt.id && 
            b.startTime <= time && 
            b.endTime > time
        );
        if (blockingSlot?.status === 'MAINTENANCE') return 'maintenance';
        if (blockingSlot) return 'booked';

        const slotEnd = getNextHalfHour(time);
        const dayOfWeek = format(selectedDate, 'EEEE').toUpperCase();
        const matchingRule = [...(venue?.pricingRules || [])]
            .sort((a: any, b: any) => b.priority - a.priority || a.name.localeCompare(b.name))
            .find((rule: any) =>
                (!rule.dayOfWeek || rule.dayOfWeek === dayOfWeek) &&
                (!rule.startTime || rule.startTime <= time) &&
                (!rule.endTime || rule.endTime >= slotEnd),
            );
        if (!matchingRule || matchingRule.pricePerHour <= 0) return 'unpriced';
        
        return 'available';
    };

    const repeatApplied = useRef(false);
    useEffect(() => {
        const start = searchParams.get('startTime');
        const end = searchParams.get('endTime');
        if (repeatApplied.current || !selectedCourt || !start || !end || timeSlots.length === 0) return;
        repeatApplied.current = true;
        const slots: string[] = [];
        for (let time = start; time < end; time = getNextHalfHour(time)) slots.push(time);
        if (
            !slots.length ||
            getNextHalfHour(slots[slots.length - 1]) !== end ||
            slots.some((time) => !timeSlots.includes(time) || getSlotStatus(time) !== 'available')
        ) {
            toast({ title: 'Khung giờ cũ hiện không còn trống', description: 'Vui lòng chọn giờ khả dụng khác.', variant: 'error' });
            return;
        }
        setSelectedSlots(slots);
    }, [selectedCourt, timeSlots, bookings, selectedDate, searchParams, toast]);

    const handleSlotClick = (time: string) => {
        const status = getSlotStatus(time);
        if (status !== 'available') return;

        const selectedIndex = selectedSlots.indexOf(time);
        if (selectedIndex !== -1) {
            if (selectedSlots.length > 1 && selectedIndex > 0 && selectedIndex < selectedSlots.length - 1) {
                toast({
                    title: 'Giữ khung giờ liền nhau',
                    variant: 'error',
                });
                return;
            }
            setSelectedSlots(selectedIndex === 0 ? selectedSlots.slice(1) : selectedSlots.slice(0, -1));
            return;
        }

        if (selectedSlots.length > 0) {
            const firstSlot = selectedSlots[0];
            const lastSlot = selectedSlots[selectedSlots.length - 1];
            if (getNextHalfHour(time) !== firstSlot && getNextHalfHour(lastSlot) !== time) {
                toast({
                    title: 'Vui lòng chọn giờ liên tiếp',
                    variant: 'error',
                });
                return;
            }
        }
        setSelectedSlots([...selectedSlots, time].sort());
    };

    const totalAmount = useMemo(() => {
        if (!selectedCourt || selectedSlots.length === 0 || !venue) return 0;
        const dayOfWeek = format(selectedDate, 'EEEE').toUpperCase();
        
        let total = 0;
        const lastSelectedSlot = selectedSlots[selectedSlots.length - 1];
        const bookingEndTime = getNextHalfHour(lastSelectedSlot);
        for (let slot = selectedSlots[0]; slot < bookingEndTime; slot = getNextHalfHour(slot)) {
            const slotStart = slot;
            const slotEnd = getNextHalfHour(slot);
            
            let pricePerHour = 0;
            if (venue.pricingRules && venue.pricingRules.length > 0) {
                const rules = [...venue.pricingRules].sort((a: any, b: any) =>
                    b.priority - a.priority || a.name.localeCompare(b.name),
                );
                for (const rule of rules) {
                    const matchDay = !rule.dayOfWeek || rule.dayOfWeek === dayOfWeek;
                    const matchTime = (!rule.startTime || rule.startTime <= slotStart) && (!rule.endTime || rule.endTime >= slotEnd);
                    if (matchDay && matchTime) { pricePerHour = rule.pricePerHour; break; }
                }
            }
            total += pricePerHour / 2;
        }
        for (const item of orderedItems) {
            total += item.price * item.quantity;
        }
        return total;
    }, [selectedSlots, selectedCourt, venue, selectedDate, orderedItems]);

    const itemsAmount = orderedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const courtAmount = Math.max(0, totalAmount - itemsAmount);
    const maxRedeemPoints = Math.max(0, Math.min(
        availableLoyaltyPoints,
        Math.floor((courtAmount * 0.2) / 100),
    ));
    const safeRedeemPoints = Math.min(redeemPoints, maxRedeemPoints);
    const loyaltyDiscount = safeRedeemPoints * 100;
    const finalAmount = Math.max(0, totalAmount - (appliedVoucher?.discountAmount || 0) - loyaltyDiscount);
    useEffect(() => {
        if (redeemPoints > maxRedeemPoints) setRedeemPoints(maxRedeemPoints);
    }, [redeemPoints, maxRedeemPoints]);
    useEffect(() => {
        setAppliedVoucher(null);
        setVoucherCodeInput('');
        setRedeemPoints(0);
    }, [totalAmount]);

    useEffect(() => {
        if (!localStorage.getItem('portalUserToken')) {
            setAvailableLoyaltyPoints(0);
            return;
        }
        let active = true;
        setIsLoadingLoyaltyPoints(true);
        portalAuthApi.getMe()
            .then((customer) => {
                if (active) setAvailableLoyaltyPoints(Math.max(0, customer.points - customer.reservedPoints));
            })
            .catch((error: any) => {
                if (active) {
                    toast({
                        title: 'Không thể tải điểm tích lũy',
                        description: error?.response?.data?.message || 'Vui lòng đăng nhập lại rồi thử lại.',
                        variant: 'error',
                    });
                }
            })
            .finally(() => {
                if (active) setIsLoadingLoyaltyPoints(false);
            });
        return () => { active = false; };
    }, [toast]);

    const bankTransferConfigured = Boolean(
        venue?.bankCode && venue?.bankAccountNumber && venue?.bankAccountName,
    );

    const handleCheckVoucher = async () => {
        if (!voucherCodeInput) {
            setAppliedVoucher(null);
            return;
        }
        setIsCheckingVoucher(true);
        try {
            const res = await voucherApi.validate(voucherCodeInput, totalAmount);
            setAppliedVoucher({
                code: res.voucher.code,
                discountAmount: res.discountAmount
            });
            toast({ title: 'Áp dụng mã thành công', variant: 'success' });
        } catch (error: any) {
            setAppliedVoucher(null);
            toast({ title: error?.response?.data?.message || 'Mã không hợp lệ', variant: 'error' });
        } finally {
            setIsCheckingVoucher(false);
        }
    };

    const handleBookingSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedSlots.length === 0 || !selectedCourt || !venue) return;
        if (!bookingForm.name || !bookingForm.phone) {
            toast({ title: 'Vui lòng điền đủ thông tin liên hệ', variant: 'error' });
            return;
        }
        if (paymentMethod === 'DEPOSIT_TRANSFER' && !bankTransferConfigured) {
            toast({ title: 'Cơ sở chưa cấu hình tài khoản nhận chuyển khoản', variant: 'error' });
            return;
        }
        const sortedSlots = [...selectedSlots].sort();
        const startTime = sortedSlots[0];
        const lastSlot = sortedSlots[sortedSlots.length - 1];
        let [h, m] = lastSlot.split(':').map(Number);
        let nextM = m + 30;
        let nextH = h;
        if (nextM >= 60) { nextM = 0; nextH += 1; }
        const endTime = `${String(nextH).padStart(2, '0')}:${String(nextM).padStart(2, '0')}`;

        setIsSubmitting(true);
        try {
            const dateStr = format(selectedDate, 'yyyy-MM-dd');
            const bookingRequest = await bookingRequestApi.createPublic({
                ...bookingForm,
                venueId: venue.id,
                courtId: selectedCourt.id,
                date: dateStr,
                startTime,
                endTime,
                paymentMethod,
                paymentAmount: finalAmount,
                paymentProof,
                orderedItems: orderedItems.length > 0 ? JSON.stringify(orderedItems) : undefined,
                voucherCode: appliedVoucher?.code,
                discountAmount: appliedVoucher?.discountAmount || 0,
                redeemPoints: safeRedeemPoints,
            });

            if (bookingForm.phone) {
                localStorage.setItem('portalUserPhone', bookingForm.phone);
                localStorage.setItem('portalUser', JSON.stringify({ name: bookingForm.name, phone: bookingForm.phone }));
                window.dispatchEvent(new Event('storage'));
            }

            

            if (paymentMethod === 'VNPAY') {
                toast({ title: 'Đang chuyển sang trang thanh toán VNPAY...' });
                const { payUrl } = await bookingRequestApi.createVnpayPayment(bookingRequest.id, finalAmount);
                if (!payUrl) {
                    throw new Error('VNPAY không trả về liên kết thanh toán. Vui lòng thử lại.');
                }
                window.location.assign(payUrl);
                return;
            }

            if (paymentMethod === 'DEPOSIT_TRANSFER') {
                if (!bookingRequest.transferReference || !bookingRequest.expiresAt) {
                    throw new Error('Không nhận được mã thanh toán từ hệ thống. Vui lòng liên hệ cơ sở trước khi chuyển khoản.');
                }
                setTransferDetails({
                    requestId: bookingRequest.id,
                    reference: bookingRequest.transferReference,
                    amount: bookingRequest.paymentAmount ?? finalAmount,
                    expiresAt: bookingRequest.expiresAt,
                    date: dateStr,
                    startTime,
                    endTime,
                    courtName: selectedCourt.name,
                });
                setShowForm(false);
                toast({ title: 'Đã gửi yêu cầu đặt sân', description: 'Chuyển khoản trong 30 phút để giữ khung giờ.', variant: 'success' });
                return;
            }

            toast({ title: 'Đã gửi yêu cầu đặt sân thành công!', variant: 'success' });
            navigate('/trang-chu');
        } catch (error: any) {
            toast({
                title: paymentMethod === 'VNPAY' ? 'Không thể mở thanh toán VNPAY' : 'Có lỗi xảy ra',
                description: error?.response?.data?.message || error?.message || 'Vui lòng thử lại.',
                variant: 'error',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const updateItemQuantity = (item: Product | Service, type: 'product' | 'service', delta: number) => {
        setOrderedItems(prev => {
            const existing = prev.find(i => i.id === item.id && i.type === type);
            if (!existing) {
                if (type === 'product' && (item as Product).stock < 1) {
                    toast({ title: 'Sản phẩm đã hết hàng', variant: 'error' });
                    return prev;
                }
                if (delta > 0) return [...prev, { id: item.id, name: item.name, price: item.price, quantity: 1, type }];
                return prev;
            }
            const newQty = existing.quantity + delta;
            if (delta > 0 && type === 'product' && newQty > (item as Product).stock) {
                toast({ title: 'Số lượng vượt tồn kho hiện có', variant: 'error' });
                return prev;
            }
            if (newQty <= 0) return prev.filter(i => i.id !== item.id || i.type !== type);
            return prev.map(i => i.id === item.id && i.type === type ? { ...i, quantity: newQty } : i);
        });
    };

    // Render logic
    if (!venue) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="w-10 h-10 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 pb-24 font-sans">
            {/* Header */}
            <div className="bg-gradient-to-r from-green-800 to-green-600 text-white rounded-b-3xl shadow-md px-5 pt-6 pb-8">
                <div className="flex items-start gap-4 mb-4">
                    <button onClick={() => navigate(-1)} className="p-2 bg-white/20 hover:bg-white/30 rounded-full backdrop-blur-sm transition-colors shrink-0">
                        <ChevronLeft className="w-6 h-6" />
                    </button>
                    <div className="flex-1">
                        <h1 className="text-lg font-bold flex flex-wrap items-center gap-1.5 leading-tight">
                            <span className="text-xl">🏸</span>
                            <span>{venue.name}</span>
                            <span className="text-green-200/60 mx-1 hidden sm:inline">|</span>
                            <span className="text-green-100 text-[13px] font-medium flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5 shrink-0" />
                                <span className="line-clamp-1">{venue.address}</span>
                            </span>
                        </h1>
                    </div>
                    <button onClick={() => setShowPricing(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-full backdrop-blur-sm transition-colors shrink-0 border border-white/20 shadow-sm" title="Bảng giá">
                        <Info className="w-4 h-4" />
                        <span className="text-xs font-bold tracking-wide">Bảng giá</span>
                    </button>
                </div>

                {/* Calendar Widget */}
                <div className="mt-6 bg-white/10 rounded-2xl p-4 backdrop-blur-sm border border-white/20">
                    <div className="flex justify-between items-center mb-4">
                        <button onClick={() => changeMonth(-1)} className="p-1.5 hover:bg-white/20 rounded-full transition-colors">
                            <ChevronLeft className="w-5 h-5 text-white" />
                        </button>
                        <div className="font-bold text-white">
                            Tháng {viewMonth.getMonth() + 1} / {viewMonth.getFullYear()}
                        </div>
                        <button onClick={() => changeMonth(1)} className="p-1.5 hover:bg-white/20 rounded-full transition-colors">
                            <ChevronRight className="w-5 h-5 text-white" />
                        </button>
                    </div>

                    <div className="grid grid-cols-7 mb-2 text-center text-[10px] font-bold text-green-100 uppercase">
                        {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(d => <div key={d}>{d}</div>)}
                    </div>

                    <div className="grid grid-cols-7 gap-y-1 gap-x-1 text-center">
                        {generateCalendarDays().map((day, i) => {
                            if (!day) return <div key={`empty-${i}`} />;
                            
                            const now = new Date();
                            const isToday = isSameDay(day, now);
                            const isSelected = isSameDay(day, selectedDate);
                            
                            // Can only book today or future days up to 2 months
                            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                            const isPast = day < today;
                            
                            let cls = 'w-8 h-8 mx-auto flex flex-col items-center justify-center rounded-full text-sm font-semibold transition-all ';
                            
                            if (isPast) {
                                cls += 'text-white/30 cursor-not-allowed';
                            } else if (isSelected) {
                                cls += 'bg-white text-green-700 shadow-md scale-110';
                            } else if (isToday) {
                                cls += 'border border-white/50 text-white hover:bg-white/20 cursor-pointer';
                            } else {
                                cls += 'text-white hover:bg-white/20 cursor-pointer';
                            }
                            
                            return (
                                <button 
                                    key={i} 
                                    disabled={isPast} 
                                    onClick={() => {
                                        setSelectedDate(day);
                                        setSelectedSlots([]);
                                    }} 
                                    className={cls}
                                >
                                    {day.getDate()}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center mt-12">
                    <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
                </div>
            ) : (
                <div className="px-4 mt-6">
                    {/* Court Selector */}
                    {courts.length > 0 ? (
                        <>
                            <div className="mb-6 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
                                <div className="flex items-center justify-between mb-3">
                                    <div>
                                        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-700">Bước 1</p>
                                        <h2 className="mt-1 text-base font-bold text-gray-900">Chọn sân</h2>
                                    </div>
                                    {selectedCourt && (
                                        <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800">
                                            Đang chọn · {selectedCourt.name}
                                        </span>
                                    )}
                                </div>
                                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
                                    {courts.map(court => (
                                        <div key={court.id} className="flex shrink-0 items-center overflow-hidden rounded-xl">
                                            <button
                                                onClick={() => {
                                                    setSelectedCourt(court);
                                                    setSelectedSlots([]);
                                                }}
                                                className={cn(
                                                    "min-h-11 border px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition-all",
                                                    selectedCourt?.id === court.id
                                                        ? "border-emerald-700 bg-emerald-700 text-white shadow-md shadow-emerald-900/10"
                                                        : "border-gray-200 bg-gray-50 text-gray-700 hover:border-emerald-300 hover:bg-emerald-50"
                                                )}
                                            >
                                                {court.name}
                                            </button>
                                            <button
                                                type="button"
                                                aria-label={favoriteCourtIds.includes(court.id) ? `Bỏ yêu thích ${court.name}` : `Yêu thích ${court.name}`}
                                                onClick={() => void toggleFavoriteCourt(court.id)}
                                                className={cn(
                                                    "min-h-11 border-y border-r px-3 transition-colors",
                                                    favoriteCourtIds.includes(court.id)
                                                        ? "border-emerald-700 bg-emerald-700 text-rose-200"
                                                        : "border-gray-200 bg-gray-50 text-gray-400 hover:bg-rose-50 hover:text-rose-500",
                                                )}
                                            >
                                                <Heart className={cn("h-4 w-4", favoriteCourtIds.includes(court.id) && "fill-current")} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                {!localStorage.getItem('portalUserToken') && (
                                    <p className="mt-2 text-xs text-gray-500">Khách chưa đăng nhập lưu yêu thích trên thiết bị này; đăng nhập để đồng bộ với tài khoản.</p>
                                )}
                            </div>

                            {/* Time Slots Grid */}
                            <section className="mb-6 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-[0_12px_35px_-28px_rgba(15,23,42,0.5)] sm:rounded-3xl">
                                <div className="border-b border-gray-100 bg-gradient-to-r from-emerald-50/80 via-white to-white px-4 py-4 sm:px-6 sm:py-5">
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div>
                                            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-700">Bước 2</p>
                                            <div className="mt-1 flex flex-wrap items-center gap-2">
                                                <h2 className="text-lg font-black tracking-tight text-gray-900">Chọn khung giờ</h2>
                                                {selectedSlots.length > 0 && (
                                                    <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">
                                                        {selectedSlots.length} khung · {getDurationLabel(
                                                            selectedSlots[0],
                                                            getNextHalfHour(selectedSlots[selectedSlots.length - 1]),
                                                        )}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="mt-1 text-xs text-gray-500 sm:text-sm">
                                                Mỗi khung giờ kéo dài 30 phút. Chọn một hoặc nhiều khung giờ còn trống.
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-3 rounded-xl bg-white/80 px-3 py-2 text-[11px] font-medium text-gray-600 ring-1 ring-gray-100">
                                            <span className="inline-flex items-center gap-1.5">
                                                <span className="h-2.5 w-2.5 rounded-full border border-emerald-300 bg-white" />
                                                Còn trống
                                            </span>
                                            <span className="inline-flex items-center gap-1.5">
                                                <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
                                                Đã chọn
                                            </span>
                                            <span className="inline-flex items-center gap-1.5">
                                                <span className="h-2.5 w-2.5 rounded-full bg-gray-200" />
                                                Không khả dụng
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-4 sm:p-6">
                                    {visibleSlots.length === 0 ? (
                                        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/70 px-4 py-10 text-center">
                                            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-2xl shadow-sm">🕒</div>
                                            <p className="mt-3 font-semibold text-gray-800">Không có giờ hoạt động</p>
                                            <p className="mt-1 text-sm text-gray-500">Cơ sở không mở cửa vào ngày bạn đã chọn.</p>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="-mx-1 mb-5 flex gap-2 overflow-x-auto px-1 pb-1">
                                                {([
                                                    { value: 'all', label: 'Tất cả' },
                                                    { value: 'morning', label: 'Buổi sáng' },
                                                    { value: 'afternoon', label: 'Buổi chiều' },
                                                    { value: 'evening', label: 'Buổi tối' },
                                                ] as const).map(period => (
                                                    <button
                                                        key={period.value}
                                                        type="button"
                                                        onClick={() => setSlotPeriod(period.value)}
                                                        className={cn(
                                                            "inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border px-3.5 text-xs font-semibold transition sm:text-sm",
                                                            slotPeriod === period.value
                                                                ? "border-emerald-700 bg-emerald-700 text-white shadow-sm"
                                                                : "border-gray-200 bg-white text-gray-600 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800"
                                                        )}
                                                    >
                                                        {period.label}
                                                        <span className={cn(
                                                            "rounded-full px-1.5 py-0.5 text-[10px]",
                                                            slotPeriod === period.value ? "bg-white/15 text-white" : "bg-gray-100 text-gray-500"
                                                        )}>
                                                            {timeSlotCounts[period.value]}
                                                        </span>
                                                    </button>
                                                ))}
                                            </div>

                                            {filteredTimeSlots.length === 0 ? (
                                                <div className="rounded-xl bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
                                                    Không có khung giờ trong buổi này.
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-2.5 lg:grid-cols-4 xl:grid-cols-5">
                                                    {filteredTimeSlots.map(time => {
                                                        const status = getSlotStatus(time);
                                                        const isSelected = selectedSlots.includes(time);
                                                        const isUnavailable = status === 'booked' || status === 'maintenance' || status === 'past' || status === 'unavailable' || status === 'unpriced';
                                                        const statusLabel = isSelected
                                                            ? 'Đã chọn'
                                                            : status === 'booked'
                                                                ? 'Đã có lịch'
                                                                : status === 'maintenance'
                                                                    ? 'Bảo trì'
                                                                : status === 'past'
                                                                    ? 'Đã qua'
                                                                    : status === 'unpriced'
                                                                        ? 'Chưa có giá'
                                                                    : status === 'unavailable'
                                                                        ? 'Không khả dụng'
                                                                        : 'Còn trống';
                                                        return (
                                                            <button
                                                                key={time}
                                                                type="button"
                                                                disabled={isUnavailable}
                                                                onClick={() => handleSlotClick(time)}
                                                                aria-pressed={isSelected}
                                                                aria-label={`${time} đến ${getNextHalfHour(time)} · ${statusLabel}`}
                                                                className={cn(
                                                                    "group relative flex min-h-11 items-center justify-between gap-1.5 rounded-xl border px-2.5 py-2 text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 sm:min-h-12 sm:px-3",
                                                                    isSelected && "border-emerald-700 bg-emerald-700 text-white shadow-md shadow-emerald-900/15",
                                                                    status === 'available' && !isSelected && "border-gray-200 bg-white text-gray-800 hover:-translate-y-0.5 hover:border-emerald-400 hover:bg-emerald-50/60 hover:shadow-sm",
                                                                    isUnavailable && "cursor-not-allowed border-gray-100 bg-gray-50 text-gray-400"
                                                                )}
                                                            >
                                                                <span className="whitespace-nowrap text-xs font-bold tracking-tight sm:text-sm">
                                                                    {time} - {getNextHalfHour(time)}
                                                                </span>
                                                                <span className={cn(
                                                                    "shrink-0 rounded-full px-1.5 py-1 text-[9px] font-bold sm:px-2",
                                                                    isSelected && "bg-white/15 text-white",
                                                                    status === 'available' && !isSelected && "bg-emerald-50 text-emerald-700",
                                                                    isUnavailable && "bg-gray-100 text-gray-500"
                                                                )}>
                                                                    {statusLabel}
                                                                </span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            </section>
                            
                            {/* Inventory Toggle */}
                            {(products.length > 0 || services.length > 0) && (
                                <div className="mb-6">
                                    <button 
                                        onClick={() => setShowInventory(!showInventory)}
                                        className="w-full bg-white px-5 py-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                                                <ShoppingBag className="w-5 h-5" />
                                            </div>
                                            <div className="text-left">
                                                <h3 className="font-bold text-gray-800">Dịch vụ đi kèm</h3>
                                                <p className="text-xs text-gray-500">Nước uống, thuê vợt, v.v.</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {orderedItems.length > 0 && (
                                                <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
                                                    {orderedItems.reduce((s, i) => s + i.quantity, 0)}
                                                </span>
                                            )}
                                            <ChevronRight className={cn("w-5 h-5 text-gray-400 transition-transform", showInventory && "rotate-90")} />
                                        </div>
                                    </button>
                                    
                                    {showInventory && (
                                        <div className="mt-3 bg-white p-4 rounded-2xl shadow-sm border border-gray-100 space-y-4 animate-in slide-in-from-top-2">
                                            {[...products, ...services].map((item: any) => {
                                                const type = item.stock !== undefined ? 'product' : 'service';
                                                const qty = orderedItems.find(i => i.id === item.id && i.type === type)?.quantity || 0;
                                                return (
                                                    <div key={item.id} className="flex items-center justify-between pb-4 border-b border-gray-50 last:border-0 last:pb-0">
                                                        <div>
                                                            <div className="font-semibold text-gray-800 text-sm">{item.name}</div>
                                                            <div className="text-blue-600 text-xs font-bold mt-0.5">{formatCurrency(item.price)}</div>
                                                        </div>
                                                        <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-1">
                                                            <button onClick={() => updateItemQuantity(item, type, -1)} className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center text-gray-600 hover:text-blue-600 font-bold">-</button>
                                                            <span className="w-4 text-center font-bold text-sm text-gray-800">{qty}</span>
                                                            <button onClick={() => updateItemQuantity(item, type, 1)} className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center text-gray-600 hover:text-blue-600 font-bold">+</button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Summary & Checkout Card */}
                            {selectedSlots.length > 0 && (
                                <div className="mt-2 mb-8 bg-white p-5 rounded-3xl shadow-sm border border-gray-100 flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
                                        <div className="flex items-start gap-3">
                                            <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center shrink-0">
                                                <span className="text-xl">🏸</span>
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-gray-800">{selectedCourt?.name}</h3>
                                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                    <span className="text-xs font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-md">
                                                        {selectedSlots[0]} - {getNextHalfHour(selectedSlots[selectedSlots.length - 1])}
                                                    </span>
                                                    <span className="text-xs text-gray-500">
                                                        ({getDurationLabel(selectedSlots[0], getNextHalfHour(selectedSlots[selectedSlots.length - 1]))})
                                                    </span>
                                                    {orderedItems.length > 0 && orderedItems.map((item, idx) => (
                                                        <span key={idx} className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
                                                            {item.name} (x{item.quantity})
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                                        <div className="text-left w-full sm:w-auto">
                                            <p className="text-[11px] text-gray-500 font-bold uppercase tracking-wide mb-1">Tổng cộng</p>
                                            <p className="text-2xl font-black text-green-600 leading-none">
                                                {appliedVoucher || loyaltyDiscount > 0 ? (
                                                    <span className="flex items-center gap-2">
                                                        <span className="text-lg line-through text-gray-400 font-medium">{formatCurrency(totalAmount)}</span>
                                                        {formatCurrency(finalAmount)}
                                                    </span>
                                                ) : formatCurrency(totalAmount)}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => {
                                                const token = localStorage.getItem('portalUserToken');
                                                const phone = localStorage.getItem('portalUserPhone');
                                                if (!token || !phone) {
                                                    toast({ title: 'Vui lòng đăng nhập để đặt sân', variant: 'error' });
                                                    navigate('/dang-nhap');
                                                    return;
                                                }
                                                setShowForm(true);
                                            }}
                                            className="w-full sm:w-auto px-8 py-3.5 bg-green-600 hover:bg-green-700 active:scale-95 text-white font-bold rounded-2xl shadow-lg shadow-green-200 transition-all flex items-center justify-center gap-2"
                                        >
                                            Tiếp tục
                                            <ChevronRight className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            )}

                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-12 px-4 text-center bg-white rounded-3xl shadow-sm border border-gray-100">
                            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                                <span className="text-3xl">🏸</span>
                            </div>
                            <h3 className="font-bold text-gray-800 mb-1">Không có sân</h3>
                            <p className="text-gray-500 text-sm">Cơ sở này hiện chưa có sân nào được mở.</p>
                        </div>
                    )}
                </div>
            )}

            

            {/* Booking Form Modal */}
            {showForm && (
                <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in">
                    <div className="bg-white w-full max-w-md sm:rounded-3xl rounded-t-3xl max-h-[90dvh] flex flex-col shadow-2xl animate-in slide-in-from-bottom-1/2">
                        <div className="relative flex items-center justify-center p-5 border-b border-gray-100 shrink-0">
                            <h2 className="text-xl font-black text-gray-800">Xác nhận đặt sân</h2>
                            <button onClick={() => setShowForm(false)} className="absolute right-4 p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500">
                                X
                            </button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto overscroll-contain touch-pan-y p-5 space-y-6">
                            {/* Summary Card */}
                            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-4 border border-green-100 shadow-inner">
                                <div className="flex items-center gap-3 border-b border-green-200/60 pb-3 mb-3">
                                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm text-xl">🏸</div>
                                    <div>
                                        <p className="font-bold text-green-900">{selectedCourt?.name}</p>
                                        <p className="text-xs text-green-700 font-medium">{format(selectedDate, 'dd/MM/yyyy')}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 text-green-800 font-medium text-sm mb-2">
                                    <Clock className="w-4 h-4" />
                                    {selectedSlots[0]} - {getNextHalfHour(selectedSlots[selectedSlots.length - 1])}
                                    <span className="text-green-700/70">
                                        ({getDurationLabel(selectedSlots[0], getNextHalfHour(selectedSlots[selectedSlots.length - 1]))})
                                    </span>
                                </div>
                                {orderedItems.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 mt-3">
                                        {orderedItems.map((item, idx) => (
                                            <span key={idx} className="text-[11px] font-bold text-emerald-800 bg-emerald-100/50 px-2.5 py-1 rounded-md border border-emerald-200/50">
                                                {item.name} x{item.quantity}
                                            </span>
                                        ))}
                                    </div>
                                )}
                                <div className="flex items-center justify-between text-lg font-black text-green-700 mt-3 pt-3 border-t border-green-200/60">
                                    <span>Tổng cộng</span>
                                    <span>
                                        {appliedVoucher ? (
                                            <span className="flex items-center gap-2">
                                                <span className="text-sm line-through text-green-700/50">{formatCurrency(totalAmount)}</span>
                                                {formatCurrency(finalAmount)}
                                            </span>
                                        ) : formatCurrency(totalAmount)}
                                    </span>
                                </div>
                            </div>

                            <form id="bookingForm" onSubmit={handleBookingSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1.5 ml-1">Họ tên *</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                            <User className="h-5 w-5 text-gray-400" />
                                        </div>
                                        <input
                                            required
                                            readOnly
                                            type="text"
                                            value={bookingForm.name}
                                            className="block w-full pl-11 pr-4 py-3.5 bg-gray-100 border border-gray-200 rounded-2xl text-sm text-gray-500 font-medium cursor-not-allowed"
                                            placeholder="Tên của bạn"
                                        />
                                    </div>
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1.5 ml-1">Số điện thoại *</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                            <Phone className="h-5 w-5 text-gray-400" />
                                        </div>
                                        <input
                                            required
                                            readOnly
                                            type="tel"
                                            value={bookingForm.phone}
                                            className="block w-full pl-11 pr-4 py-3.5 bg-gray-100 border border-gray-200 rounded-2xl text-sm text-gray-500 font-medium cursor-not-allowed"
                                            placeholder="Số điện thoại liên hệ"
                                        />
                                    </div>
                                </div>

                                <div className="p-4 bg-green-50/50 border border-green-100 rounded-2xl">
                                    <label className="block text-sm font-bold text-gray-700 mb-2 ml-1">Mã khuyến mãi (Voucher)</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={voucherCodeInput}
                                            onChange={e => setVoucherCodeInput(e.target.value.toUpperCase().replace(/\s/g, ''))}
                                            placeholder="Nhập mã giảm giá..."
                                            className="flex-1 px-4 py-2.5 bg-white border border-green-200 rounded-xl text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 uppercase"
                                            disabled={isCheckingVoucher}
                                        />
                                        <button
                                            type="button"
                                            onClick={handleCheckVoucher}
                                            disabled={isCheckingVoucher || !voucherCodeInput}
                                            className="px-4 py-2.5 bg-green-600 text-white rounded-xl text-sm font-bold disabled:bg-gray-300 transition-colors whitespace-nowrap"
                                        >
                                            {isCheckingVoucher ? 'Đang kiểm tra...' : 'Áp dụng'}
                                        </button>
                                    </div>
                                    {appliedVoucher && (
                                        <div className="mt-2 text-sm text-green-700 font-medium flex items-center gap-1.5">
                                            <span>✅</span> Đã áp dụng mã giảm giá. Giảm {formatCurrency(appliedVoucher.discountAmount)}
                                        </div>
                                    )}
                                </div>

                                <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <label htmlFor="redeem-points" className="block text-sm font-bold text-amber-950">
                                                Dùng điểm tích lũy
                                            </label>
                                            <p className="mt-1 text-xs leading-5 text-amber-800">
                                                100 điểm = 10.000đ; tối đa giảm 20% tiền sân. Điểm chỉ trừ sau khi cơ sở duyệt và thanh toán đủ.
                                            </p>
                                        </div>
                                        <span className="whitespace-nowrap rounded-full bg-white px-3 py-1 text-xs font-bold text-amber-800">
                                            {isLoadingLoyaltyPoints ? 'Đang tải…' : `${availableLoyaltyPoints.toLocaleString('vi-VN')} điểm`}
                                        </span>
                                    </div>
                                    <div className="mt-3 flex items-center gap-3">
                                        <input
                                            id="redeem-points"
                                            type="number"
                                            min={0}
                                            max={maxRedeemPoints}
                                            step={1}
                                            value={safeRedeemPoints || ''}
                                            onChange={(event) => {
                                                const value = Number(event.target.value);
                                                setRedeemPoints(Number.isFinite(value) ? Math.max(0, Math.min(Math.floor(value), maxRedeemPoints)) : 0);
                                            }}
                                            disabled={isLoadingLoyaltyPoints || maxRedeemPoints === 0}
                                            placeholder={maxRedeemPoints > 0 ? `Tối đa ${maxRedeemPoints}` : 'Chưa đủ điều kiện'}
                                            className="min-w-0 flex-1 rounded-xl border border-amber-200 bg-white px-3 py-2.5 text-sm font-semibold text-gray-900 outline-none focus:ring-2 focus:ring-amber-400 disabled:bg-amber-100"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setRedeemPoints(maxRedeemPoints)}
                                            disabled={maxRedeemPoints === 0}
                                            className="rounded-xl bg-amber-700 px-3 py-2.5 text-xs font-bold text-white transition hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            Dùng tối đa
                                        </button>
                                    </div>
                                    {loyaltyDiscount > 0 && (
                                        <p className="mt-2 text-xs font-semibold text-emerald-800">
                                            Giảm {formatCurrency(loyaltyDiscount)}; còn {Math.max(0, availableLoyaltyPoints - safeRedeemPoints).toLocaleString('vi-VN')} điểm sau khi thanh toán thành công.
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2 ml-1">Thanh toán</label>
                                    <div className="grid grid-cols-2 gap-2 sm:gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setPaymentMethod('VNPAY')}
                                            className={cn(
                                                "min-w-0 py-2.5 px-2.5 sm:px-4 flex items-center justify-center gap-1.5 rounded-xl border transition-all",
                                                paymentMethod === 'VNPAY' ? "border-blue-500 bg-blue-50 text-blue-700 font-bold" : "border-gray-200 bg-white text-gray-600 font-medium hover:border-blue-200"
                                            )}
                                        >
                                            <span className="shrink-0 text-base sm:text-lg">💳</span>
                                            <span className="text-xs sm:text-sm">Thanh toán VNPay</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setPaymentMethod('DEPOSIT_TRANSFER')}
                                            disabled={!bankTransferConfigured}
                                            className={cn(
                                                "min-w-0 py-2.5 px-2.5 sm:px-4 flex items-center justify-center gap-1.5 rounded-xl border transition-all disabled:cursor-not-allowed disabled:opacity-50",
                                                paymentMethod === 'DEPOSIT_TRANSFER' ? "border-green-500 bg-green-50 text-green-700 font-bold" : "border-gray-200 bg-white text-gray-600 font-medium hover:border-green-200"
                                            )}
                                        >
                                            <span className="shrink-0 text-base sm:text-lg">🏦</span>
                                            <span className="text-xs sm:text-sm">Chuyển khoản</span>
                                        </button>
                                    </div>
                                    {!bankTransferConfigured && (
                                        <p className="mt-2 text-xs text-amber-700">
                                            Chuyển khoản chưa được bật vì cơ sở chưa khai báo tài khoản nhận tiền trong quản trị.
                                        </p>
                                    )}

                                    {paymentMethod === 'DEPOSIT_TRANSFER' && (
                                        <div className="mt-4 p-5 border border-green-200 bg-green-50 rounded-2xl animate-in fade-in slide-in-from-top-2">
                                            {bankTransferConfigured ? (
                                                <div className="text-sm text-green-900">
                                                    <p className="font-bold">Thông tin thanh toán sẽ được tạo sau khi gửi yêu cầu</p>
                                                    <p className="mt-1 text-xs leading-5 text-green-800">
                                                        Mã QR sẽ chứa số tiền và mã tham chiếu riêng cho yêu cầu này. Vui lòng chuyển khoản trong 30 phút; cơ sở xác nhận sau khi đối soát thủ công.
                                                    </p>
                                                    <p className="mt-2 font-semibold">{venue.bankCode} · {venue.bankAccountNumber} · {venue.bankAccountName}</p>
                                                    <p className="mt-1 font-bold">Số tiền: {formatCurrency(finalAmount)}</p>
                                                </div>
                                            ) : (
                                                <p className="text-sm font-medium text-amber-800">
                                                    Cơ sở chưa cấu hình tài khoản nhận chuyển khoản. Vui lòng chọn VNPay hoặc liên hệ cơ sở.
                                                </p>
                                            )}

                                            <div className="flex flex-col items-start justify-center">
                                                <label className="text-sm font-bold text-gray-700 mb-2">Ảnh giao dịch (không bắt buộc)</label>
                                                <div className="flex items-center gap-3">
                                                    <label className="flex items-center gap-2 px-4 py-2 border-2 border-green-300 border-dashed rounded-xl cursor-pointer bg-white hover:bg-green-50 transition-colors">
                                                        <span className="text-green-600 font-bold text-xl leading-none">+</span>
                                                        <span className="text-sm font-bold text-green-700">Chọn ảnh</span>
                                                        <input 
                                                            type="file" className="hidden" accept="image/*"
                                                            onChange={(e) => {
                                                                const file = e.target.files?.[0];
                                                                if (file) {
                                                                    if (file.size > 5 * 1024 * 1024) return alert('Ảnh < 5MB');
                                                                    setPaymentProofName(file.name);
                                                                    const reader = new FileReader();
                                                                    reader.onload = (ev) => ev.target?.result && setPaymentProof(ev.target.result as string);
                                                                    reader.readAsDataURL(file);
                                                                }
                                                            }}
                                                        />
                                                    </label>
                                                    {paymentProofName && (
                                                        <div className="text-sm text-green-700 font-medium flex items-center gap-1.5 max-w-[150px] truncate" title={paymentProofName}>
                                                            <span>✅</span> {paymentProofName}
                                                        </div>
                                                    )}
                                                </div>
                                                <p className="mt-2 text-xs text-gray-600">Ảnh giao dịch chỉ hỗ trợ đối soát; không tự động xác nhận đã thanh toán.</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </form>
                        </div>

                        <div className="p-4 border-t border-gray-100 shrink-0 bg-white sm:rounded-b-3xl pb-8 sm:pb-4">
                            <button
                                form="bookingForm"
                                disabled={isSubmitting}
                                type="submit"
                                className={cn(
                                    "w-full py-4 rounded-2xl font-black text-white text-base shadow-lg transition-all",
                                    isSubmitting ? "bg-gray-300 cursor-not-allowed shadow-none" : "bg-green-600 hover:bg-green-700 shadow-green-200 active:scale-95"
                                )}
                            >
                                {isSubmitting ? 'Đang xử lý...' : 'Xác nhận đặt sân'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {transferDetails && (
                <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/55 p-0 backdrop-blur-sm sm:items-center sm:p-4">
                    <section className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl">
                        <div className="text-center">
                            <h2 className="text-xl font-black text-gray-900">Chuyển khoản để giữ sân</h2>
                            <p className="mt-1 text-sm text-gray-600">{venue.name} · {transferDetails.courtName} · {transferDetails.date} {transferDetails.startTime}-{transferDetails.endTime}</p>
                        </div>
                        <div className="mt-5 flex justify-center">
                            <img
                                src={`https://img.vietqr.io/image/${encodeURIComponent(venue.bankCode)}-${encodeURIComponent(venue.bankAccountNumber)}-compact2.png?amount=${Math.round(transferDetails.amount)}&addInfo=${encodeURIComponent(transferDetails.reference)}&accountName=${encodeURIComponent(venue.bankAccountName || '')}`}
                                alt="Mã QR chuyển khoản VietQR"
                                className="h-56 w-56 rounded-xl border border-gray-100 object-contain"
                            />
                        </div>
                        <div className="mt-4 space-y-2 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-950">
                            <p><span className="font-semibold">Ngân hàng:</span> {venue.bankCode}</p>
                            <p><span className="font-semibold">Số tài khoản:</span> {venue.bankAccountNumber}</p>
                            <p><span className="font-semibold">Chủ tài khoản:</span> {venue.bankAccountName}</p>
                            <p><span className="font-semibold">Số tiền:</span> {formatCurrency(transferDetails.amount)}</p>
                            <p><span className="font-semibold">Nội dung bắt buộc:</span> <span className="font-black">{transferDetails.reference}</span></p>
                            <p><span className="font-semibold">Hạn thanh toán:</span> {new Date(transferDetails.expiresAt).toLocaleString('vi-VN')}</p>
                        </div>
                        <p className="mt-3 text-xs leading-5 text-gray-600">
                            Mã QR đã điền sẵn số tiền và mã yêu cầu riêng. Hệ thống không kết nối tự động với ngân hàng; sân chỉ được xác nhận sau khi cơ sở đối soát và xác nhận khoản tiền thực nhận. Yêu cầu chưa thanh toán sẽ hết hạn sau 30 phút.
                        </p>
                        <button
                            type="button"
                            onClick={() => navigate('/trang-chu?tab=history')}
                            className="mt-5 w-full rounded-xl bg-emerald-700 px-4 py-3 font-bold text-white hover:bg-emerald-800"
                        >
                            Xong · xem lịch sử đặt sân
                        </button>
                    </section>
                </div>
            )}

            {/* Pricing Modal */}
            {showPricing && (
                <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in">
                    <div className="bg-white w-full max-w-md sm:rounded-3xl rounded-t-3xl h-[70vh] sm:h-auto flex flex-col shadow-2xl animate-in slide-in-from-bottom-1/2">
                        <div className="flex justify-between items-center p-5 border-b border-gray-100 shrink-0">
                            <h2 className="text-xl font-black text-gray-800">Bảng giá thuê sân</h2>
                            <button onClick={() => setShowPricing(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto p-5 space-y-4">
                            {venue.pricingRules && venue.pricingRules.length > 0 ? (
                                venue.pricingRules.map((rule: any) => (
                                    <div key={rule.id} className="bg-green-50 p-4 rounded-2xl border border-green-100 relative overflow-hidden">
                                        <div className="absolute top-0 right-0 w-16 h-16 bg-green-500/10 rounded-bl-full" />
                                        <div className="flex justify-between items-start mb-2 relative">
                                            <h3 className="font-bold text-green-900 pr-2">{rule.name}</h3>
                                            <span className="font-black text-green-700 bg-white px-2.5 py-1 rounded-xl shadow-sm whitespace-nowrap">
                                                {formatCurrency(rule.pricePerHour)}/h
                                            </span>
                                        </div>
                                        {rule.description && <p className="text-xs text-green-800/70 mb-3 relative">{rule.description}</p>}
                                        <div className="flex flex-wrap gap-1.5 text-[11px] font-bold text-green-700 relative">
                                            {rule.dayOfWeek ? (
                                                <span className="bg-green-200/50 px-2.5 py-1 rounded-lg">Thứ {rule.dayOfWeek}</span>
                                            ) : (
                                                <span className="bg-green-200/50 px-2.5 py-1 rounded-lg">Mọi ngày</span>
                                            )}
                                            {rule.startTime && rule.endTime ? (
                                                <span className="bg-green-200/50 px-2.5 py-1 rounded-lg">
                                                    <Clock className="w-3 h-3 inline-block mr-1 -mt-0.5" />
                                                    {rule.startTime} - {rule.endTime}
                                                </span>
                                            ) : (
                                                <span className="bg-green-200/50 px-2.5 py-1 rounded-lg">Mọi khung giờ</span>
                                            )}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="flex flex-col items-center justify-center py-10 opacity-60">
                                    <Info className="w-12 h-12 text-gray-300 mb-3" />
                                    <p className="text-center text-gray-500 font-medium">Cơ sở chưa cấu hình bảng giá.</p>
                                    <p className="text-center text-xs text-gray-400 mt-1">Vui lòng chọn giờ để xem tạm tính.</p>
                                </div>
                            )}
                        </div>
                        <div className="p-4 border-t border-gray-100 shrink-0 bg-white sm:rounded-b-3xl pb-8 sm:pb-4">
                            <button onClick={() => setShowPricing(false)} className="w-full py-3.5 rounded-xl font-bold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors">
                                Đóng
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
