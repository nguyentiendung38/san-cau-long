import { useQuery } from '@tanstack/react-query';
import { bookingApi, Booking } from '@/services/booking.service';
import BookingCheckInQr from './BookingCheckInQr';

export default function BookingCheckInQrPanel({ booking, isOpen }: { booking: Booking; isOpen: boolean }) {
    const { data: token } = useQuery({
        queryKey: ['booking-check-in-qr', booking.id],
        queryFn: () => bookingApi.getCheckInToken(booking.id),
        enabled: isOpen && booking.status === 'CONFIRMED',
    });

    if (!token) return null;
    return (
        <div className="mt-3 rounded-xl border border-primary-500/20 bg-primary-500/5 p-3">
            <p className="mb-2 text-sm font-semibold text-foreground">Mã QR check-in</p>
            <BookingCheckInQr token={token} />
            <p className="mt-2 text-xs text-foreground-secondary">Mã chỉ xác nhận lịch đặt này; nhân viên cần được phân quyền tại cơ sở của lịch.</p>
        </div>
    );
}
