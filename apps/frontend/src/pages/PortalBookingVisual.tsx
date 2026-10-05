import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { venueApi, Venue, Court } from '@/services/venue.service';
import { bookingRequestApi } from '@/services/booking.service';
import { useToast } from '@/hooks/use-toast';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

const TIME_SLOTS: string[] = [];
for (let h = 5; h <= 23; h++) {
    const hour = h.toString().padStart(2, '0');
    TIME_SLOTS.push(`${hour}:00`);
    if (h !== 23) {
        TIME_SLOTS.push(`${hour}:30`);
    }
}

export function PortalBookingVisual({ venue, onClose }: { venue: Venue; onClose: () => void }) {
    const now = new Date();
    const todayString = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const currentTimeString = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const maxDate = new Date(now.getFullYear(), now.getMonth() + 2, 0);
    const maxDateString = `${maxDate.getFullYear()}-${String(maxDate.getMonth() + 1).padStart(2, '0')}-${String(maxDate.getDate()).padStart(2, '0')}`;
    
    const [selectedDate, setSelectedDate] = useState(todayString);
    const [courts, setCourts] = useState<Court[]>([]);
    const [bookings, setBookings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [showDatePicker, setShowDatePicker] = useState(false);
    const [tempDate, setTempDate] = useState<Date>(new Date());
    const [viewMonth, setViewMonth] = useState<Date>(new Date());

    const [selectedCourt, setSelectedCourt] = useState<Court | null>(null);
    const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
    const [showForm, setShowForm] = useState(false);
    
    const [bookingForm, setBookingForm] = useState({
        name: '', phone: '', notes: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState<'MOMO' | 'DEPOSIT_TRANSFER'>('MOMO');
    const totalAmount = selectedCourt ? selectedSlots.length * 25000 : 0;
    
    const { toast } = useToast();
    const queryClient = useQueryClient();

    useEffect(() => {
        const fetchAvailability = async () => {
            setLoading(true);
            try {
                const res = await venueApi.getAvailability(venue.id, selectedDate);
                setCourts(res.courts);
                setBookings(res.bookings);
                setSelectedCourt(null);
                setSelectedSlots([]);
            } catch (error) {
                toast({ title: 'Lỗi tải dữ liệu', variant: 'error' });
            } finally {
                setLoading(false);
            }
        };
        fetchAvailability();
    }, [venue.id, selectedDate, toast]);

    const getSlotStatus = (courtId: string, time: string) => {
        const isPast = selectedDate === todayString && time < currentTimeString;
        if (isPast) return 'past';

        const isBooked = bookings.some(b => b.courtId === courtId && b.startTime <= time && b.endTime > time);
        if (isBooked) return 'booked';

        return 'available';
    };

    const handleSlotClick = (court: Court, time: string) => {
        const status = getSlotStatus(court.id, time);
        if (status !== 'available') return;

        if (selectedCourt && selectedCourt.id !== court.id) {
            setSelectedCourt(court);
            setSelectedSlots([time]);
            return;
        }

        setSelectedCourt(court);

        if (selectedSlots.length === 0) {
            setSelectedSlots([time]);
        } else {
            const timeIndex = TIME_SLOTS.indexOf(time);
            const firstSlotIndex = TIME_SLOTS.indexOf(selectedSlots[0]);
            const lastSlotIndex = TIME_SLOTS.indexOf(selectedSlots[selectedSlots.length - 1]);

            if (timeIndex === firstSlotIndex - 1 || timeIndex === lastSlotIndex + 1) {
                const newSlots = [...selectedSlots, time].sort((a, b) => TIME_SLOTS.indexOf(a) - TIME_SLOTS.indexOf(b));
                setSelectedSlots(newSlots);
            } else if (selectedSlots.includes(time)) {
                if (time === selectedSlots[0] || time === selectedSlots[selectedSlots.length - 1]) {
                    setSelectedSlots(selectedSlots.filter(s => s !== time));
                    if (selectedSlots.length === 1) setSelectedCourt(null);
                } else {
                    setSelectedSlots([time]);
                }
            } else {
                setSelectedSlots([time]);
            }
        }
    };

    const handleProceed = () => {
        if (!selectedCourt || selectedSlots.length === 0) return;
        setShowForm(true);
    };

    const handleBookingSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedCourt || selectedSlots.length === 0) return;

        const startTime = selectedSlots[0];
        const lastSlot = selectedSlots[selectedSlots.length - 1];
        const [h, m] = lastSlot.split(':').map(Number);
        let newM = m + 30;
        let newH = h;
        if (newM >= 60) {
            newM = 0;
            newH += 1;
        }
        const endTime = `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;

        setIsSubmitting(true);
        try {
            const bookingRequest = await bookingRequestApi.createPublic({
                ...bookingForm,
                venueId: venue.id,
                courtId: selectedCourt.id,
                date: selectedDate,
                startTime,
                endTime,
                paymentMethod,
                paymentAmount: totalAmount
            });
            
            if (bookingForm.phone) {
                localStorage.setItem('portalUserPhone', bookingForm.phone);
                window.dispatchEvent(new Event('portal-phone-updated'));
                queryClient.invalidateQueries({ queryKey: ['my-requests'] });
            }

            // Nếu chọn MoMo → redirect sang cổng thanh toán MoMo Sandbox
            if (paymentMethod === 'MOMO') {
                toast({ title: '🔄 Đang chuyển sang trang thanh toán MoMo...' });
                const momoRes = await bookingRequestApi.createMomoPayment(bookingRequest.id, totalAmount);
                if (momoRes.payUrl) {
                    window.location.href = momoRes.payUrl;
                    return;
                } else {
                    toast({ title: '❌ Không lấy được link MoMo, vui lòng thử lại', variant: 'error' });
                }
            } else {
                toast({ title: '✅ Gửi yêu cầu thành công! Chờ admin xác nhận.' });
            }

            setBookings(prev => [...prev, { courtId: selectedCourt.id, startTime, endTime }]);
            setShowForm(false);
            setSelectedCourt(null);
            setSelectedSlots([]);
        } catch (error: any) {
            toast({ title: `Lỗi: ${error?.response?.data?.message || 'Vui lòng thử lại'}`, variant: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const generateCalendarDays = () => {
        const firstDay = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
        const lastDay = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0);
        let startOffset = firstDay.getDay() - 1;
        if (startOffset === -1) startOffset = 6;
        
        const days = [];
        for (let i = 0; i < startOffset; i++) {
            days.push(null);
        }
        for (let i = 1; i <= lastDay.getDate(); i++) {
            days.push(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), i));
        }
        return days;
    };

    const isSameDay = (d1: Date, d2: Date) => {
        return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
    };

    const changeMonth = (offset: number) => {
        const newMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + offset, 1);
        // Only allow this month and next month
        const currentM = new Date(now.getFullYear(), now.getMonth(), 1);
        const maxM = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        if (newMonth >= currentM && newMonth <= maxM) {
            setViewMonth(newMonth);
        }
    };
    
    return (
        <div className="fixed inset-0 z-[100] bg-white flex flex-col animate-in fade-in slide-in-from-bottom-10 duration-300 font-sans">
            <div className="bg-[#1a5b3a] text-white flex items-center p-3 relative">
                <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full">
                    <ChevronLeft className="w-6 h-6" />
                </button>
                <h1 className="flex-1 text-center font-bold text-lg tracking-wider">ĐẶT LỊCH THEO SÂN - TRỰC QUAN</h1>
                <div 
                    onClick={() => { 
                        const d = new Date(selectedDate);
                        setTempDate(d); 
                        setViewMonth(new Date(d.getFullYear(), d.getMonth(), 1)); 
                        setShowDatePicker(true); 
                    }} 
                    className="absolute right-4 flex items-center gap-2 bg-white/20 hover:bg-white/30 transition-colors rounded-md px-3 py-1.5 cursor-pointer"
                >
                    <span className="text-white font-medium">
                        {selectedDate.split('-').reverse().join('/')}
                    </span>
                    <CalendarIcon className="w-4 h-4 text-white" />
                </div>
            </div>

            <div className="bg-gray-50 border-b border-gray-200 p-2 flex flex-col items-center justify-center text-sm gap-1">
                <div className="flex gap-4 items-center">
                    <div className="flex items-center gap-1.5"><div className="w-5 h-5 bg-white border border-gray-300 rounded"></div> <span className="text-gray-700 font-medium">Trống</span></div>
                    <div className="flex items-center gap-1.5"><div className="w-5 h-5 bg-[#ff6b6b] rounded"></div> <span className="text-gray-700 font-medium">Đã đặt</span></div>
                    <div className="flex items-center gap-1.5"><div className="w-5 h-5 bg-[#a3a3a3] rounded"></div> <span className="text-gray-700 font-medium">Khoá (Đã qua)</span></div>
                    <div className="flex items-center gap-1.5"><div className="w-5 h-5 bg-[#3b82f6] rounded"></div> <span className="text-gray-700 font-medium">Đang chọn</span></div>
                </div>
                <div className="text-[#e85d04] text-xs font-semibold mt-1">Lưu ý: Bạn phải chọn các khung giờ liên tiếp nhau trên cùng 1 sân.</div>
            </div>

            <div className="flex-1 overflow-auto bg-gray-50 relative">
                {loading ? (
                    <div className="flex items-center justify-center h-full"><div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin"></div></div>
                ) : courts.length === 0 ? (
                    <div className="text-center p-10 text-gray-500">Chưa có sân nào.</div>
                ) : (
                    <div className="inline-block min-w-full">
                        <div className="flex sticky top-0 bg-blue-50 z-10 border-b border-gray-200">
                            <div className="w-16 shrink-0 bg-blue-50 border-r border-gray-200 sticky left-0 z-20"></div>
                            {TIME_SLOTS.map(t => (
                                <div key={t} className="w-12 shrink-0 text-center py-1 text-[10px] text-[#0ea5e9] font-medium border-r border-gray-200">
                                    {t}
                                </div>
                            ))}
                        </div>
                        {courts.map(court => (
                            <div key={court.id} className="flex border-b border-gray-200 bg-white hover:bg-gray-50 transition-colors">
                                <div className="w-16 shrink-0 bg-green-50/50 border-r border-gray-200 flex items-center justify-center text-xs font-medium text-green-800 sticky left-0 z-10 text-center p-1">
                                    {court.name}
                                </div>
                                {TIME_SLOTS.map(time => {
                                    const status = getSlotStatus(court.id, time);
                                    const isSelected = selectedCourt?.id === court.id && selectedSlots.includes(time);
                                    
                                    let bgClass = 'bg-white hover:bg-blue-50 cursor-pointer';
                                    if (status === 'past') bgClass = 'bg-[#a3a3a3] cursor-not-allowed border-gray-300';
                                    else if (status === 'booked') bgClass = 'bg-[#ff6b6b] cursor-not-allowed border-red-400';
                                    else if (isSelected) bgClass = 'bg-[#3b82f6] border-blue-600';

                                    return (
                                        <div 
                                            key={`${court.id}-${time}`}
                                            onClick={() => handleSlotClick(court, time)}
                                            className={`w-12 h-12 shrink-0 border-r border-b border-gray-200 transition-all ${bgClass}`}
                                        />
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {selectedCourt && selectedSlots.length > 0 ? (
                <div className="bg-[#046c4e] rounded-t-2xl p-4 shadow-[0_-4px_15px_rgba(0,0,0,0.2)] shrink-0 z-50 text-white flex flex-col gap-3">
                    <div className="flex justify-between items-center px-1 font-bold text-base">
                        <span>Tổng giờ: {Math.floor((selectedSlots.length * 30) / 60)}h{(selectedSlots.length * 30) % 60 === 0 ? '00' : '30'}</span>
                        <span>Tổng tiền: {(selectedSlots.length * 25000).toLocaleString('vi-VN')} đ</span>
                    </div>
                    <button 
                        onClick={handleProceed}
                        className="w-full bg-[#eab308] hover:bg-yellow-500 text-white font-bold text-lg py-3 rounded-lg transition-colors"
                    >
                        TIẾP THEO
                    </button>
                </div>
            ) : (
                <div className="bg-[#eab308] p-3 shadow-[0_-4px_10px_rgba(0,0,0,0.1)] shrink-0 z-50">
                    <button 
                        disabled
                        className="w-full bg-transparent text-white font-bold text-lg opacity-50 cursor-not-allowed"
                    >
                        TIẾP THEO
                    </button>
                </div>
            )}

            {showForm && selectedCourt && (
                <div className="fixed inset-0 z-[110] bg-black/60 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
                        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-lg text-gray-800">Xác nhận đặt lịch</h3>
                            <button onClick={() => setShowForm(false)} className="p-1 hover:bg-gray-200 rounded-full">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <form onSubmit={handleBookingSubmit} className="p-4 space-y-4">
                            <div className="bg-green-50 text-green-800 p-3 rounded-xl text-sm font-medium border border-green-100">
                                <div>Sân: <span className="font-bold">{selectedCourt.name}</span></div>
                                <div>Thời gian: <span className="font-bold">{selectedSlots[0]} - {
                                    (() => {
                                        const lastSlot = selectedSlots[selectedSlots.length - 1];
                                        const [h, m] = lastSlot.split(':').map(Number);
                                        let newM = m + 30, newH = h;
                                        if (newM >= 60) { newM = 0; newH += 1; }
                                        return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
                                    })()
                                }</span></div>
                                <div>Ngày: <span className="font-bold">{selectedDate}</span></div>
                            </div>
                            
                            <div className="space-y-1">
                                <label className="text-sm font-medium text-gray-700">Họ và tên *</label>
                                <input required type="text" value={bookingForm.name} onChange={e => setBookingForm({...bookingForm, name: e.target.value})} className="w-full border border-gray-300 rounded-xl px-3 py-2 bg-white text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500" placeholder="VD: Nguyễn Văn A" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-medium text-gray-700">Số điện thoại *</label>
                                <input required type="tel" value={bookingForm.phone} onChange={e => setBookingForm({...bookingForm, phone: e.target.value})} className="w-full border border-gray-300 rounded-xl px-3 py-2 bg-white text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500" placeholder="VD: 0901234567" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-medium text-gray-700">Ghi chú (Tùy chọn)</label>
                                <textarea value={bookingForm.notes} onChange={e => setBookingForm({...bookingForm, notes: e.target.value})} className="w-full border border-gray-300 rounded-xl px-3 py-2 resize-none bg-white text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500" rows={2}></textarea>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">Phương thức thanh toán</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setPaymentMethod('MOMO')}
                                        className={`py-2.5 rounded-xl border text-sm font-semibold transition-colors ${
                                            paymentMethod === 'MOMO'
                                                ? 'border-pink-500 bg-pink-50 text-pink-600'
                                                : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400'
                                        }`}
                                    >
                                        MoMo
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setPaymentMethod('DEPOSIT_TRANSFER')}
                                        className={`py-2.5 rounded-xl border text-sm font-semibold transition-colors ${
                                            paymentMethod === 'DEPOSIT_TRANSFER'
                                                ? 'border-[#1a5b3a] bg-green-50 text-[#1a5b3a]'
                                                : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400'
                                        }`}
                                    >
                                        Chuyển khoản
                                    </button>
                                </div>
                            </div>
                            <div className="rounded-xl bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-800">
                                Tổng tiền: <span className="font-bold">{totalAmount.toLocaleString('vi-VN')} đ</span>
                            </div>
                            <button disabled={isSubmitting} type="submit" className={`w-full text-white font-bold py-3 rounded-xl active:scale-95 transition-all ${paymentMethod === 'MOMO' ? 'bg-[#ae2070] hover:bg-pink-700' : 'bg-[#1a5b3a] hover:bg-green-800'}`}>
                                {isSubmitting
                                    ? 'Đang xử lý...'
                                    : paymentMethod === 'MOMO'
                                        ? '💳 Thanh toán qua MoMo'
                                        : '✅ Gửi yêu cầu đặt sân'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {showDatePicker && (
                <div className="fixed inset-0 z-[120] bg-black/40 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl w-full max-w-[320px] p-5 shadow-xl font-sans animate-in zoom-in-95">
                        <div className="flex justify-between items-center mb-6 px-1">
                            <button onClick={() => changeMonth(-1)} className="p-1 hover:bg-gray-100 rounded-full text-[#046c4e] transition-colors">
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                            <div className="font-medium text-gray-800 text-[15px]">
                                tháng {viewMonth.getMonth() + 1} năm {viewMonth.getFullYear()}
                            </div>
                            <button onClick={() => changeMonth(1)} className="p-1 hover:bg-gray-100 rounded-full text-[#046c4e] transition-colors">
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </div>
                        
                        <div className="grid grid-cols-7 mb-3 text-center text-gray-500 text-[13px] font-medium">
                            <div>T2</div><div>T3</div><div>T4</div><div>T5</div><div>T6</div><div>T7</div><div>CN</div>
                        </div>
                        
                        <div className="grid grid-cols-7 gap-y-2 text-center text-gray-800">
                            {generateCalendarDays().map((day, i) => {
                                if (!day) return <div key={`empty-${i}`}></div>;
                                
                                const isToday = isSameDay(day, now);
                                const isSelected = isSameDay(day, tempDate);
                                const isPast = day < new Date(now.getFullYear(), now.getMonth(), now.getDate());
                                const isBeyondNextMonth = day > maxDate;
            
                                let btnClass = "w-8 h-8 mx-auto flex items-center justify-center rounded-lg text-[15px] transition-all ";
                                if (isPast || isBeyondNextMonth) {
                                    btnClass += "text-gray-300 cursor-not-allowed";
                                } else if (isSelected) {
                                    btnClass += "bg-[#046c4e] text-white font-semibold shadow-md";
                                } else if (isToday) {
                                    btnClass += "border border-[#046c4e] text-[#046c4e] font-semibold";
                                } else {
                                    btnClass += "hover:bg-green-50 cursor-pointer";
                                }
            
                                return (
                                    <button 
                                        key={i} 
                                        disabled={isPast || isBeyondNextMonth}
                                        onClick={() => setTempDate(day)}
                                        className={btnClass}
                                    >
                                        {day.getDate()}
                                    </button>
                                )
                            })}
                        </div>
            
                        <div className="flex justify-end gap-3 mt-8">
                            <button onClick={() => setShowDatePicker(false)} className="text-[#046c4e] hover:text-green-800 font-medium px-4 py-2">
                                Hủy
                            </button>
                            <button 
                                onClick={() => {
                                    const dStr = `${tempDate.getFullYear()}-${String(tempDate.getMonth() + 1).padStart(2, '0')}-${String(tempDate.getDate()).padStart(2, '0')}`;
                                    setSelectedDate(dStr);
                                    setShowDatePicker(false);
                                }} 
                                className="bg-[#046c4e] hover:bg-green-800 text-white font-medium px-6 py-2 rounded-lg transition-colors shadow-sm"
                            >
                                Xác nhận
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
