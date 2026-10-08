import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, X } from 'lucide-react';
import { Venue, Court } from '@/services/venue.service';

interface VisualBookingModalProps {
    isOpen: boolean;
    onClose: () => void;
    venue: Venue | null;
    courts: Court[];
    initialCourtId?: string;
    onNext: (bookingData: { court: Court; date: string; startTime: string; endTime: string }) => void;
}

export function VisualBookingModal({ isOpen, onClose, venue, courts, initialCourtId, onNext }: VisualBookingModalProps) {
    const [selectedDate, setSelectedDate] = useState<string>(() => {
        const today = new Date();
        return `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    });

    const [selectedCourtId, setSelectedCourtId] = useState<string | null>(initialCourtId || null);
    const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
    
    // Custom calendar state
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [calendarViewDate, setCalendarViewDate] = useState<Date>(new Date());
    const [tempSelectedDateStr, setTempSelectedDateStr] = useState<string>(selectedDate);

    useEffect(() => {
        if (isOpen) {
            setSelectedCourtId(initialCourtId || null);
            setSelectedSlots([]);
        }
    }, [isOpen, initialCourtId, selectedDate]);

    const { minDateStr, maxDateStr, maxMonthDate, currentMonthDate } = useMemo(() => {
        const today = new Date();
        const minStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        
        const currentM = new Date(today.getFullYear(), today.getMonth(), 1);
        
        const maxDate = new Date();
        maxDate.setMonth(today.getMonth() + 2);
        const maxStr = `${maxDate.getFullYear()}-${String(maxDate.getMonth()+1).padStart(2, '0')}-${String(maxDate.getDate()).padStart(2, '0')}`;
        
        const maxM = new Date(today.getFullYear(), today.getMonth() + 1, 1);
        
        return { minDateStr: minStr, maxDateStr: maxStr, maxMonthDate: maxM, currentMonthDate: currentM };
    }, []);

    const times = useMemo(() => {
        const t = [];
        for (let h = 5; h <= 23; h++) {
            t.push(`${h.toString().padStart(2, '0')}:00`);
            if (h !== 23 || true) {
                t.push(`${h.toString().padStart(2, '0')}:30`);
            }
        }
        return t;
    }, []);

    if (!isOpen || !venue) return null;

    const isSlotPast = (timeStr: string) => {
        const now = new Date();
        const slotDate = new Date(selectedDate);
        
        const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        if (selectedDate < todayStr) return true;
        
        if (selectedDate === todayStr) {
            const [h, m] = timeStr.split(':').map(Number);
            const slotTime = h * 60 + m;
            const currentTime = now.getHours() * 60 + now.getMinutes();
            return slotTime <= currentTime;
        }
        
        return false;
    };

    const handleSlotClick = (courtId: string, time: string) => {
        if (isSlotPast(time)) return;

        if (selectedCourtId !== courtId) {
            setSelectedCourtId(courtId);
            setSelectedSlots([time]);
            return;
        }

        if (selectedSlots.includes(time)) {
            setSelectedSlots(prev => prev.filter(t => t !== time));
        } else {
            setSelectedSlots(prev => [...prev, time].sort());
        }
    };

    const handleNext = () => {
        if (!selectedCourtId || selectedSlots.length === 0) {
            alert('Vui lòng chọn ít nhất một khung giờ trống.');
            return;
        }

        const sorted = [...selectedSlots].sort();
        const startTime = sorted[0];
        
        const lastSlot = sorted[sorted.length - 1];
        const [lh, lm] = lastSlot.split(':').map(Number);
        let endH = lh;
        let endM = lm + 30;
        if (endM >= 60) {
            endH += 1;
            endM -= 60;
        }
        const endTimeStr = `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;

        const court = courts.find(c => c.id === selectedCourtId);
        if (court) {
            onNext({
                court,
                date: selectedDate,
                startTime,
                endTime: endTimeStr
            });
        }
    };

    const formatDateDisplay = (dateStr: string) => {
        const [y, m, d] = dateStr.split('-');
        return `${d}/${m}/${y}`;
    };

    // Calendar logic
    const handleOpenCalendar = () => {
        setCalendarViewDate(new Date(selectedDate));
        setTempSelectedDateStr(selectedDate);
        setShowDatePicker(true);
    };

    const handlePrevMonth = () => {
        const newD = new Date(calendarViewDate);
        newD.setMonth(newD.getMonth() - 1);
        if (newD >= currentMonthDate) {
            setCalendarViewDate(newD);
        }
    };

    const handleNextMonth = () => {
        const newD = new Date(calendarViewDate);
        newD.setMonth(newD.getMonth() + 1);
        if (newD.getFullYear() < maxMonthDate.getFullYear() || (newD.getFullYear() === maxMonthDate.getFullYear() && newD.getMonth() <= maxMonthDate.getMonth())) {
            setCalendarViewDate(newD);
        }
    };

    const getDaysInMonth = (year: number, month: number) => {
        return new Date(year, month + 1, 0).getDate();
    };

    const getFirstDayOfMonth = (year: number, month: number) => {
        const day = new Date(year, month, 1).getDay();
        return day === 0 ? 6 : day - 1; // Map Sunday(0)->6, Monday(1)->0, ..., Saturday(6)->5
    };

    const renderCalendarDays = () => {
        const year = calendarViewDate.getFullYear();
        const month = calendarViewDate.getMonth();
        const daysInMonth = getDaysInMonth(year, month);
        const firstDay = getFirstDayOfMonth(year, month);
        
        const days = [];
        for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`empty-${i}`} className="w-8 h-8"></div>);
        }

        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
            const isSelected = dateStr === tempSelectedDateStr;
            const isPast = dateStr < minDateStr;
            const isTooFar = dateStr > maxDateStr;
            const isDisabled = isPast || isTooFar;

            days.push(
                <button
                    key={d}
                    disabled={isDisabled}
                    onClick={() => setTempSelectedDateStr(dateStr)}
                    className={`w-8 h-8 flex items-center justify-center rounded-md text-sm transition-colors ${
                        isSelected 
                            ? 'bg-[#0f763e] text-white font-bold' 
                            : isDisabled 
                                ? 'text-gray-300 cursor-not-allowed' 
                                : 'hover:bg-gray-100 text-gray-700'
                    }`}
                >
                    {d}
                </button>
            );
        }
        return days;
    };

    const confirmDate = () => {
        setSelectedDate(tempSelectedDateStr);
        setShowDatePicker(false);
    };

    return (
        <div className="fixed inset-0 z-[120] bg-white flex flex-col font-sans animate-in fade-in duration-200">
            {/* Top Header */}
            <div className="bg-[#0f763e] text-white flex items-center justify-between px-4 py-3 z-10 relative">
                <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                    <ChevronLeft className="w-6 h-6" />
                </button>
                <h1 className="text-lg font-bold text-center absolute left-1/2 -translate-x-1/2">
                    ĐẶT LỊCH THEO SÂN - TRỰC QUAN
                </h1>
                
                {/* Custom Date Picker Button */}
                <div 
                    onClick={handleOpenCalendar}
                    className="relative flex items-center bg-white/20 hover:bg-white/30 rounded-lg px-3 py-1.5 cursor-pointer transition-colors"
                >
                    <span className="text-sm font-semibold mr-2 pointer-events-none">{formatDateDisplay(selectedDate)}</span>
                    <CalendarIcon className="w-4 h-4 pointer-events-none" />
                </div>
            </div>

            {/* Custom Calendar Modal */}
            {showDatePicker && (
                <div className="fixed inset-0 z-[130] bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-[320px] overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* Calendar Header */}
                        <div className="flex justify-between items-center p-4">
                            <button 
                                onClick={handlePrevMonth}
                                disabled={calendarViewDate <= currentMonthDate}
                                className={`p-1 rounded-full ${calendarViewDate <= currentMonthDate ? 'text-gray-300' : 'text-gray-600 hover:bg-gray-100'}`}
                            >
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                            <span className="font-semibold text-gray-800">
                                tháng {calendarViewDate.getMonth() + 1} năm {calendarViewDate.getFullYear()}
                            </span>
                            <button 
                                onClick={handleNextMonth}
                                disabled={calendarViewDate.getFullYear() > maxMonthDate.getFullYear() || (calendarViewDate.getFullYear() === maxMonthDate.getFullYear() && calendarViewDate.getMonth() >= maxMonthDate.getMonth())}
                                className={`p-1 rounded-full ${calendarViewDate.getFullYear() > maxMonthDate.getFullYear() || (calendarViewDate.getFullYear() === maxMonthDate.getFullYear() && calendarViewDate.getMonth() >= maxMonthDate.getMonth()) ? 'text-gray-300' : 'text-gray-600 hover:bg-gray-100'}`}
                            >
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Calendar Grid */}
                        <div className="px-4 pb-2">
                            <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-gray-400 mb-2">
                                <div>T2</div>
                                <div>T3</div>
                                <div>T4</div>
                                <div>T5</div>
                                <div>T6</div>
                                <div>T7</div>
                                <div>CN</div>
                            </div>
                            <div className="grid grid-cols-7 gap-1 place-items-center">
                                {renderCalendarDays()}
                            </div>
                        </div>

                        {/* Calendar Footer */}
                        <div className="flex justify-end gap-3 p-4">
                            <button 
                                onClick={() => setShowDatePicker(false)}
                                className="px-4 py-2 text-sm font-semibold text-[#0f763e] hover:bg-green-50 rounded-lg transition-colors"
                            >
                                Hủy
                            </button>
                            <button 
                                onClick={confirmDate}
                                className="px-4 py-2 text-sm font-semibold bg-[#0f763e] text-white hover:bg-[#0c6133] rounded-lg transition-colors shadow-sm"
                            >
                                Xác nhận
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Legend Bar */}
            <div className="bg-[#0f763e] px-4 py-2 pb-3 flex items-center gap-6 text-xs text-white shadow-md z-10 relative">
                <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded bg-gray-300"></div> <span>Trống</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded bg-red-600"></div> <span>Đã đặt</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded bg-[#4d4d4d]"></div> <span>Khoá</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded bg-purple-600"></div> <span>Sự kiện</span>
                </div>
                <a href="#" className="text-yellow-400 underline hover:text-yellow-300 ml-auto">
                    Xem sân & bảng giá
                </a>
            </div>

            {/* Notice Bar */}
            <div className="bg-[#fdf4e9] text-center py-2 text-sm text-red-600 shadow-sm z-10">
                <span className="font-bold">Lưu ý:</span> Nếu bạn cần đặt lịch cố định vui lòng liên hệ: <span className="font-bold">0333655059</span> để được hỗ trợ
            </div>

            {/* Grid Area */}
            <div className="flex-1 overflow-auto flex bg-gray-50 relative">
                {/* Sticky Left Column (Courts) */}
                <div className="sticky left-0 bg-white z-20 border-r border-gray-300 w-[100px] flex-shrink-0 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">
                    <div className="h-10 border-b border-gray-300 bg-gray-100"></div> {/* Top left empty header */}
                    {courts.map(court => (
                        <div key={court.id} className="h-12 border-b border-gray-300 flex items-center justify-center text-xs font-semibold text-gray-700 bg-white">
                            {court.name}
                        </div>
                    ))}
                </div>

                {/* Right Scrollable Grid */}
                <div className="flex flex-col min-w-max">
                    {/* Time Header */}
                    <div className="flex h-10 border-b border-gray-300 bg-gray-100 sticky top-0 z-10">
                        {times.map(t => (
                            <div key={t} className="w-12 flex-shrink-0 border-r border-gray-300 flex items-center justify-center text-[10px] text-gray-600">
                                {t}
                            </div>
                        ))}
                    </div>

                    {/* Grid Body */}
                    {courts.map(court => (
                        <div key={court.id} className="flex h-12 border-b border-gray-300">
                            {times.map(t => {
                                const past = isSlotPast(t);
                                const isSelected = selectedCourtId === court.id && selectedSlots.includes(t);
                                
                                let bgColor = 'bg-gray-200 hover:bg-gray-300 cursor-pointer'; // Trống
                                if (past) {
                                    bgColor = 'bg-[#4d4d4d] cursor-not-allowed'; // Khoá
                                } else if (isSelected) {
                                    bgColor = 'bg-[#19b251] shadow-inner'; // Đang chọn
                                }

                                return (
                                    <div 
                                        key={`${court.id}-${t}`} 
                                        onClick={() => handleSlotClick(court.id, t)}
                                        className={`w-12 flex-shrink-0 border-r border-gray-300 border-b border-b-gray-300 transition-colors ${bgColor}`}
                                    ></div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>

            {/* Bottom Bar */}
            <div className="bg-gray-100 p-4 border-t border-gray-300 shadow-[0_-4px_10px_rgba(0,0,0,0.05)] z-20 flex justify-center">
                <button 
                    onClick={handleNext}
                    className="w-full max-w-2xl bg-[#e3b632] hover:bg-[#cca32c] text-white font-bold py-3.5 rounded transition-colors shadow-md text-sm tracking-wide"
                >
                    TIẾP THEO
                </button>
            </div>
        </div>
    );
}
