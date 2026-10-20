import { useQuery } from '@tanstack/react-query';
import { CalendarDays, Clock3, MapPin, ShieldCheck } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { bookingApi } from '@/services/booking.service';

const bookingStatusLabels: Record<string, string> = {
    CONFIRMED: 'Đã xác nhận',
    IN_PROGRESS: 'Đang chơi',
    COMPLETED: 'Đã hoàn thành',
    CANCELLED: 'Đã hủy',
    NO_SHOW: 'Khách vắng mặt',
    PENDING: 'Chờ xác nhận',
};

const formatVnd = (amount: number) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

export default function CheckInPage() {
    const { token = '' } = useParams<{ token: string }>();
    const bookingQuery = useQuery({
        queryKey: ['public-check-in-info', token],
        queryFn: () => bookingApi.getCheckInInfo(token),
        enabled: !!token,
        retry: false,
    });
    const booking = bookingQuery.data;

    return (
        <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
            <section className="w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
                <header className="bg-gradient-to-br from-emerald-800 to-teal-600 px-6 py-7 text-white">
                    <img src="/logo-hue.jpg" alt="Logo HUE" className="mb-3 h-12 w-12 rounded-full object-contain bg-white p-0.5 shadow-md" />
                    <p className="text-sm font-semibold text-emerald-100">QUẢN LÝ SÂN CẦU LÔNG · LỊCH ĐẶT SÂN</p>
                    <h1 className="mt-1 text-2xl font-black">Thông tin lịch đặt sân</h1>
                    <p className="mt-2 text-sm text-emerald-50">Mã QR giúp mở nhanh thông tin lịch đặt sân của bạn.</p>
                </header>

                <div className="p-6">
                    {bookingQuery.isLoading ? (
                        <div className="space-y-3" aria-label="Đang tải lịch đặt">
                            <div className="h-5 animate-pulse rounded bg-slate-100" />
                            <div className="h-5 animate-pulse rounded bg-slate-100" />
                            <div className="h-5 animate-pulse rounded bg-slate-100" />
                        </div>
                    ) : bookingQuery.isError ? (
                        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
                            Không tìm thấy lịch đặt cho mã QR này. Có thể mã đã hết hiệu lực hoặc không hợp lệ.
                        </div>
                    ) : booking ? (
                        <>
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Cơ sở</p>
                                    <h2 className="mt-1 text-lg font-black text-slate-900">{booking.venueName}</h2>
                                </div>
                                <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
                                    booking.status === 'CONFIRMED' ? 'bg-emerald-100 text-emerald-800' :
                                    booking.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800' :
                                    'bg-slate-100 text-slate-700'
                                }`}>
                                    {bookingStatusLabels[booking.status] || booking.status}
                                </span>
                            </div>

                            <div className="mt-5 space-y-4 rounded-2xl bg-slate-50 p-4">
                                <div className="flex gap-3">
                                    <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
                                    <div>
                                        <p className="text-xs font-semibold text-slate-500">Sân</p>
                                        <p className="font-bold text-slate-900">{booking.courtName}</p>
                                        {booking.venueAddress && <p className="mt-0.5 text-sm text-slate-600">{booking.venueAddress}</p>}
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <CalendarDays className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
                                    <div>
                                        <p className="text-xs font-semibold text-slate-500">Ngày đặt</p>
                                        <p className="font-bold text-slate-900">
                                            {new Date(booking.date).toLocaleDateString('vi-VN', { timeZone: 'UTC' })}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
                                    <div>
                                        <p className="text-xs font-semibold text-slate-500">Thời gian</p>
                                        <p className="font-bold text-slate-900">{booking.startTime} – {booking.endTime}</p>
                                    </div>
                                </div>
                                <div className="flex justify-between gap-3 border-t border-slate-200 pt-3 text-sm">
                                    <span className="text-slate-500">Tổng tiền</span>
                                    <span className="font-bold text-slate-900">{formatVnd(booking.totalAmount)}</span>
                                </div>
                                {booking.checkedInAt && (
                                    <p className="border-t border-slate-200 pt-3 text-sm font-semibold text-emerald-800">
                                        Đã check-in lúc {new Date(booking.checkedInAt).toLocaleString('vi-VN')}
                                    </p>
                                )}
                            </div>

                            <p className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900">
                                Khi đến sân, nhân viên sẽ xác nhận check-in trực tiếp trên lịch quản lý.
                            </p>
                        </>
                    ) : null}
                </div>

                <footer className="border-t border-slate-100 px-6 py-4 text-center text-xs text-slate-500">
                    Mã QR chỉ hiển thị thông tin cần thiết để xem và đối chiếu lịch đặt sân.
                </footer>
            </section>
        </main>
    );
}
