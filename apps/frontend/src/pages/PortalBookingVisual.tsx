import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
    ChevronLeft, Clock, MapPin, 
    Phone, User, ShoppingBag, ChevronRight, Info, X
} from 'lucide-react';
import { venueApi } from '@/services/venue.service';
import { productApi, serviceApi } from '@/services/inventory.service';
import { operatingHourApi, OperatingHour } from '@/services/operating-hour.service';
import { bookingRequestApi } from '@/services/booking.service';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, cn } from '@/lib/utils';
import { format, isSameDay } from 'date-fns';
import { voucherApi } from '@/services/voucher.service';

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
    const { toast } = useToast();

    const [venue, setVenue] = useState<any>(null);

    
    


    const [courts, setCourts] = useState<Court[]>([]);
    const [bookings, setBookings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [viewMonth, setViewMonth] = useState<Date>(new Date());
    const [selectedCourt, setSelectedCourt] = useState<Court | null>(null);
    const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
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
        venueApi.getById(venueId).then(res => setVenue(res)).catch(() => {
            toast({ title: 'Không tìm thấy cơ sở', variant: 'error' });
            navigate(-1);
        });
    }, [venueId, navigate, toast]);

    // Fetch Availability
    useEffect(() => {
        if (!venue) return;
        const fetchAvailability = async () => {
            setLoading(true);
            try {
                const dateStr = format(selectedDate, 'yyyy-MM-dd');
                const res = await venueApi.getAvailability(venue.id, dateStr);
                const availableCourts = res.courts;
                setCourts(availableCourts);
                setBookings(res.bookings);
                
                if (availableCourts.length > 0) {
                    // Auto select court if provided in URL, else first court
                    if (courtId) {
                        const c = availableCourts.find((c: Court) => c.id === courtId);
                        setSelectedCourt(c || availableCourts[0]);
                    } else {
                        setSelectedCourt(availableCourts[0]);
                    }
                } else {
                    setSelectedCourt(null);
                }
                
                setSelectedSlots([]);

                try {
                    const [prodRes, servRes, opRes] = await Promise.all([
                        productApi.getAll({ venueId: venue.id, isActive: true }),
                        serviceApi.getAll({ venueId: venue.id, isActive: true }),
                        operatingHourApi.getAll({ venueId: venue.id, isActive: true })
                    ]);
                    setProducts(prodRes.data || []);
                    setServices(servRes.data || []);
                    setOperatingHours(opRes.data || []);
                } catch (e) { console.error('Failed to fetch inventory or hours:', e); }

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

    const getSlotStatus = (time: string) => {
        if (!selectedCourt) return 'unavailable';
        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        const now = new Date();
        const nowStr = format(now, 'yyyy-MM-dd');
        const nowTime = format(now, 'HH:mm');
        
        if (dateStr === nowStr && time < nowTime) return 'past';
        
        const isBooked = bookings.some(b => 
            b.courtId === selectedCourt.id && 
            b.startTime <= time && 
            b.endTime > time
        );
        if (isBooked) return 'booked';
        
        return 'available';
    };

    const handleSlotClick = (time: string) => {
        const status = getSlotStatus(time);
        if (status !== 'available') return;

        setSelectedSlots(prev => {
            if (prev.includes(time)) {
                return prev.filter(t => t !== time);
            }
            return [...prev, time].sort();
        });
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
                const rules = [...venue.pricingRules].sort((a: any, b: any) => b.priority - a.priority);
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

    const finalAmount = Math.max(0, totalAmount - (appliedVoucher?.discountAmount || 0));

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
        if (paymentMethod === 'DEPOSIT_TRANSFER' && !paymentProof) {
            toast({ title: 'Vui lòng tải lên ảnh chụp màn hình chuyển khoản', variant: 'error' });
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
                if (delta > 0) return [...prev, { id: item.id, name: item.name, price: item.price, quantity: 1, type }];
                return prev;
            }
            const newQty = existing.quantity + delta;
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
                            <div className="mb-6">
                                <div className="flex items-center justify-between mb-3">
                                    <h2 className="text-base font-bold text-gray-800">Chọn sân</h2>
                                </div>
                                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
                                    {courts.map(court => (
                                        <button
                                            key={court.id}
                                            onClick={() => {
                                                setSelectedCourt(court);
                                                setSelectedSlots([]);
                                            }}
                                            className={cn(
                                                "px-5 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all border",
                                                selectedCourt?.id === court.id
                                                    ? "bg-green-600 text-white border-green-600 shadow-md"
                                                    : "bg-white text-gray-600 border-gray-200 hover:border-green-300 hover:bg-green-50"
                                            )}
                                        >
                                            {court.name}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Time Slots Grid */}
                            <div className="mb-6">
                                <div className="flex items-center justify-between mb-3">
                                    <h2 className="text-base font-bold text-gray-800">Chọn giờ</h2>
                                    <div className="flex items-center gap-3 text-[10px] font-medium text-gray-500">
                                        <span className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full bg-white border border-gray-300" /> Trống</span>
                                        <span className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full bg-green-500" /> Đang chọn</span>
                                        <span className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full bg-gray-200" /> Đã đặt/Qua</span>
                                    </div>
                                </div>
                                
                                <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                                    {visibleSlots.length === 0 ? (
                                        <div className="text-center py-6 text-gray-500 text-sm">
                                            Cơ sở không mở cửa vào ngày này.
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2.5">
                                            {visibleSlots.map(time => {
                                            const status = getSlotStatus(time);
                                            const isSelected = selectedSlots.includes(time);
                                            return (
                                                <button
                                                    key={time}
                                                    disabled={status !== 'available'}
                                                    onClick={() => handleSlotClick(time)}
                                                    className={cn(
                                                    "py-2 px-1 rounded-xl text-[11px] sm:text-xs font-semibold transition-all border flex items-center justify-center gap-0.5 whitespace-nowrap",
                                                        status === 'available' && !isSelected && "bg-white text-gray-700 border-gray-200 hover:border-green-500 hover:text-green-600",
                                                        isSelected && "bg-green-500 text-white border-green-500 shadow-sm shadow-green-200 scale-105",
                                                        status === 'past' && "bg-gray-100 text-gray-400 border-gray-100 opacity-60 cursor-not-allowed",
                                                        status === 'booked' && (dateStr === nowStr && time < nowTime || dateStr < nowStr ? "bg-red-50 text-red-500 border-red-200 opacity-60 cursor-not-allowed" : "bg-red-50 text-red-500 border-red-200 cursor-not-allowed")
                                                    )}
                                                aria-label={`${time} đến ${getNextHalfHour(time)}`}
                                                >
                                                    {status === 'booked' && <X className="w-3.5 h-3.5 text-red-500" strokeWidth={3} />}
                                                    <span>{time}-{getNextHalfHour(time)}</span>
                                                </button>
                                            );
                                        })}
                                        </div>
                                    )}
                                </div>
                            </div>
                            
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
                                                {appliedVoucher ? (
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

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2 ml-1">Thanh toán</label>
                                    <div className="flex flex-wrap justify-center gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setPaymentMethod('VNPAY')}
                                            className={cn(
                                                "py-2 px-4 flex items-center gap-1.5 rounded-lg border transition-all",
                                                paymentMethod === 'VNPAY' ? "border-blue-500 bg-blue-50 text-blue-700 font-bold" : "border-gray-200 bg-white text-gray-600 font-medium hover:border-blue-200"
                                            )}
                                        >
                                            <span className="text-lg">💳</span>
                                            <span className="text-sm">VNPAY</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setPaymentMethod('DEPOSIT_TRANSFER')}
                                            className={cn(
                                                "py-2 px-4 flex items-center gap-1.5 rounded-lg border transition-all",
                                                paymentMethod === 'DEPOSIT_TRANSFER' ? "border-green-500 bg-green-50 text-green-700 font-bold" : "border-gray-200 bg-white text-gray-600 font-medium hover:border-green-200"
                                            )}
                                        >
                                            <span className="text-lg">🏦</span>
                                            <span className="text-sm">Chuyển khoản</span>
                                        </button>
                                    </div>

                                    {paymentMethod === 'DEPOSIT_TRANSFER' && (
                                        <div className="mt-4 p-5 border border-green-200 bg-green-50 rounded-2xl animate-in fade-in slide-in-from-top-2">
                                            <div className="text-center mb-4">
                                                <p className="text-sm font-bold text-green-800 mb-3">Quét mã QR để cọc sân</p>
                                                <div className="bg-white p-2 rounded-2xl inline-block border border-green-100 shadow-sm mx-auto mb-3">
                                                    <img src={`https://img.vietqr.io/image/MB-0359850125-compact2.png?amount=${totalAmount}&addInfo=Coc%20san%20${bookingForm.phone || 'khach'}&accountName=NGUYEN%20VAN%20A`} alt="QR" className="w-40 h-40 object-contain" />
                                                </div>
                                                <div className="text-xs font-medium text-green-700">
                                                    MB Bank - 0359850125<br/>Chủ TK: NGUYEN VAN A
                                                </div>
                                            </div>

                                            <div className="flex flex-col items-start justify-center">
                                                <label className="text-sm font-bold text-gray-700 mb-2">Tải ảnh chụp giao dịch *</label>
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
