import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Court, Venue } from '@/services/venue.service';
import { bookingRequestApi } from '@/services/booking.service';
import { useToast } from '@/hooks/use-toast';

export function PortalBookingFloatingForm({ court, venue, onClose }: { court: Court, venue: Venue, onClose: () => void }) {
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState("MOMO");
    
    // Default to today
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const [date, setDate] = useState(today);
    const [startTime, setStartTime] = useState('09:00');
    const [endTime, setEndTime] = useState('10:00');

    // MOCK PRICE CALCULATION (based on screenshot: 1 hour = 90.000)
    const calculatePrice = () => {
        const [h1, m1] = startTime.split(':').map(Number);
        const [h2, m2] = endTime.split(':').map(Number);
        const hours = (h2 + m2/60) - (h1 + m1/60);
        if (hours <= 0) return 0;
        return hours * 90000;
    };
    
    const price = calculatePrice();

    const handleSubmit = async () => {
        try {
            setIsSubmitting(true);
            const res = await bookingRequestApi.createPublic({
                name: 'Khách hàng', // Default name or we can add a field
                phone: '0901234567', 
                venueId: venue.id,
                courtId: court.id,
                date: date,
                startTime: startTime,
                endTime: endTime,
                paymentMethod: paymentMethod as "MOMO" | "DEPOSIT_TRANSFER",
                paymentAmount: price
            });
            
            const payRes = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/momo/create-payment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount: price,
                    orderId: res.id || (res as any).data?.id
                })
            });
            const payData = await payRes.json();
            if (paymentMethod === "DEPOSIT_TRANSFER") {
                toast({ title: "�?t l?ch th�nh c�ng!", description: "Vui l?ng chuy?n kho?n v�o STK: 123456789 - VCB - T�n: NGUYEN VAN A. N?i dung: Thanh toan " + ((res as any).id || (res as any).data?.id) });
                onClose();
                return;
            }
            if (payData.payUrl) {
                window.location.href = payData.payUrl;
                return;
            }
            
            toast({ title: 'Gửi yêu cầu thành công!' });
            onClose();
        } catch (error) {
            toast({ title: 'Lỗi', variant: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed bottom-6 right-6 bg-white rounded-xl shadow-2xl border border-gray-200 w-80 p-5 z-[120] animate-in slide-in-from-bottom-5">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-gray-800 text-lg">{court.name || 'Sân Cầu Lông A1'}</h3>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-full p-1 transition-colors">
                    <X size={18}/>
                </button>
            </div>
            
            <div className="text-sm font-semibold text-gray-500 mb-4 border-b pb-2">Tùy chọn đặt lịch</div>
            
            <div className="space-y-4 text-sm">
                <div className="flex justify-between items-center">
                    <span className="text-gray-600 font-medium">Ngày</span>
                    <input type="date" value={date} onChange={e => setDate(e.target.value)} className="border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#19b251]" />
                </div>
                
                <div className="flex justify-between items-center">
                    <span className="text-gray-600 font-medium">Từ</span>
                    <select value={startTime} onChange={e => setStartTime(e.target.value)} className="border border-gray-300 rounded-md px-3 py-1.5 min-w-[120px] focus:outline-none focus:ring-1 focus:ring-[#19b251]">
                        {Array.from({length: 15}).map((_, i) => {
                            const h = i + 6;
                            return (
                                <React.Fragment key={h}>
                                    <option value={`${String(h).padStart(2,'0')}:00`}>{String(h).padStart(2,'0')}:00</option>
                                    <option value={`${String(h).padStart(2,'0')}:30`}>{String(h).padStart(2,'0')}:30</option>
                                </React.Fragment>
                            )
                        })}
                    </select>
                </div>
                
                <div className="flex justify-between items-center">
                    <span className="text-gray-600 font-medium">Đến</span>
                    <select value={endTime} onChange={e => setEndTime(e.target.value)} className="border border-gray-300 rounded-md px-3 py-1.5 min-w-[120px] focus:outline-none focus:ring-1 focus:ring-[#19b251]">
                        {Array.from({length: 15}).map((_, i) => {
                            const h = i + 6;
                            return (
                                <React.Fragment key={h}>
                                    <option value={`${String(h).padStart(2,'0')}:00`}>{String(h).padStart(2,'0')}:00</option>
                                    <option value={`${String(h).padStart(2,'0')}:30`}>{String(h).padStart(2,'0')}:30</option>
                                </React.Fragment>
                            )
                        })}
                    </select>
                </div>
                
                <div className="flex justify-between items-center pt-2">
                    <span className="text-gray-600 font-medium">Giá</span>
                    <span className="font-semibold text-gray-800">{price.toLocaleString('vi-VN')} đ</span>
                </div>
                
                <div className="flex flex-col gap-2 pt-2 border-t border-gray-100">
                    <span className="text-gray-600 font-medium">Ph��ng th?c thanh to�n</span>
                    <div className="flex gap-2">
                        <button type="button" onClick={() => setPaymentMethod('MOMO')} className={`flex-1 py-1.5 rounded-md border text-xs font-semibold ${paymentMethod === 'MOMO' ? 'border-pink-500 bg-pink-50 text-pink-600' : 'border-gray-200 text-gray-500'}`}>MoMo</button>
                        <button type="button" onClick={() => setPaymentMethod('DEPOSIT_TRANSFER')} className={`flex-1 py-1.5 rounded-md border text-xs font-semibold ${paymentMethod === 'DEPOSIT_TRANSFER' ? 'border-[#19b251] bg-green-50 text-[#19b251]' : 'border-gray-200 text-gray-500'}`}>Ng�n h�ng</button>
                    </div>
                </div>
                <div className="flex justify-between items-center pt-3 border-t border-gray-100">
                    <span className="text-gray-800 font-bold">Tạm tính</span>
                    <span className="font-bold text-[#19b251] text-xl">{price.toLocaleString('vi-VN')} đ</span>
                </div>
                
                <button onClick={handleSubmit} disabled={isSubmitting || price <= 0} className="w-full bg-[#19b251] hover:bg-green-600 disabled:opacity-50 text-white font-bold py-3 rounded-lg mt-4 transition-colors shadow-sm">
                    {isSubmitting ? 'Đang xử lý...' : 'Gửi yêu cầu đặt sân'}
                </button>
            </div>
        </div>
    );
}