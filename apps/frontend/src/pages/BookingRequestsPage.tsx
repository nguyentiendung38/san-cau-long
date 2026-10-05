import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, X, Clock, Calendar, User, Phone, Trash2 } from 'lucide-react';
import { bookingRequestApi } from '@/services/booking.service';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

export default function BookingRequestsPage() {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const { data: requests, isLoading } = useQuery({
        queryKey: ['booking-requests'],
        queryFn: () => bookingRequestApi.getAll(),
    });

    const updateStatusMutation = useMutation({
        mutationFn: ({ id, status }: { id: string, status: string }) => bookingRequestApi.updateStatus(id, status),
        onSuccess: () => {
            toast({ title: 'Đã xử lý thành công', variant: 'success' });
            queryClient.invalidateQueries({ queryKey: ['booking-requests'] });
        },
        onError: (error: any) => {
            toast({
                title: 'Không thể xếp lịch',
                description: error?.response?.data?.message || 'Có lỗi xảy ra, có thể sân đã bị người khác đặt trước trong khung giờ này.',
                variant: 'error'
            });
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => bookingRequestApi.delete(id),
        onSuccess: () => {
            toast({ title: 'Đã xóa yêu cầu', variant: 'success' });
            queryClient.invalidateQueries({ queryKey: ['booking-requests'] });
        },
    });

    const confirmDepositMutation = useMutation({
        mutationFn: (id: string) => bookingRequestApi.updatePaymentStatus(id, 'PAID'),
        onSuccess: () => {
            toast({ title: 'Đã xác nhận thanh toán', variant: 'success' });
            queryClient.invalidateQueries({ queryKey: ['booking-requests'] });
        },
        onError: () => toast({ title: 'Không thể xác nhận tiền cọc', variant: 'error' }),
    });

    return (
        <div className="p-6 space-y-6 max-w-screen-xl mx-auto">
            <div>
                <h1 className="text-2xl font-bold text-foreground">Yêu cầu đặt sân online</h1>
                <p className="text-foreground-secondary mt-1">Quản lý các yêu cầu đặt sân từ khách hàng trên Portal</p>
            </div>

            {isLoading ? (
                <div className="grid gap-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="bg-background-secondary rounded-xl h-32 animate-pulse border border-border" />
                    ))}
                </div>
            ) : (
                <div className="grid gap-4">
                    {requests?.length === 0 ? (
                        <div className="text-center p-12 bg-background-secondary rounded-xl border border-border text-foreground-muted">
                            <div className="text-4xl mb-3">📬</div>
                            Không có yêu cầu đặt sân nào.
                        </div>
                    ) : (
                        requests?.map((req) => (
                            <div key={req.id} className="bg-background-secondary p-5 rounded-xl border border-border flex flex-col md:flex-row justify-between gap-4 hover:border-primary-500/30 transition-colors shadow-sm">
                                <div className="space-y-3 flex-1">
                                    <div className="flex items-center gap-3">
                                        <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                                            <User className="w-5 h-5 text-primary-500" /> {req.name}
                                        </h3>
                                        <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full border ${
                                            req.status === 'PENDING' 
                                                ? 'bg-yellow-500/20 text-yellow-500 border-yellow-500/20' 
                                                : req.status === 'APPROVED' 
                                                    ? 'bg-primary-500/20 text-primary-400 border-primary-500/20' 
                                                    : 'bg-error/20 text-error border-error/20'
                                        }`}>
                                            {req.status === 'PENDING' ? 'CHỜ DUYỆT' : req.status === 'APPROVED' ? 'ĐÃ NHẬP LỊCH' : 'ĐÃ HỦY'}
                                        </span>
                                    </div>
                                    <div className="text-sm text-foreground-secondary flex flex-wrap gap-x-6 gap-y-2">
                                        <span className="flex items-center gap-1.5"><Phone className="w-4 h-4 text-foreground-muted" /> {req.phone}</span>
                                        <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4 text-foreground-muted" /> {format(new Date(req.date), 'dd/MM/yyyy')}</span>
                                        <span className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-foreground-muted" /> {req.startTime} - {req.endTime}</span>
                                        <span className={`font-semibold ${req.paymentMethod === 'MOMO' ? 'text-pink-500' : 'text-foreground-secondary'}`}>
                                            {req.paymentMethod === 'DEPOSIT_TRANSFER'
                                                ? `Thanh toán QR · ${req.paymentStatus === 'PAID' ? 'Đã xác nhận' : 'Chờ kiểm tra'}`
                                                : `MoMo online · ${req.paymentStatus === 'PAID' ? 'Đã thanh toán' : 'Chờ thanh toán'}`}
                                        </span>
                                        {req.paymentProof && (
                                            <a href={req.paymentProof} target="_blank" rel="noreferrer" className="text-primary-400 underline font-medium">
                                                Xem bill cọc
                                            </a>
                                        )}
                                    </div>
                                    {req.notes && (
                                        <div className="text-sm text-foreground-secondary bg-background-tertiary p-3 rounded-lg border border-border mt-2">
                                            <span className="font-semibold text-foreground">Ghi chú:</span> {req.notes}
                                        </div>
                                    )}
                                    <div className="text-xs text-foreground-muted pt-1">
                                        Gửi lúc: {format(new Date(req.createdAt), 'HH:mm dd/MM/yyyy')}
                                    </div>
                                </div>
                                <div className="flex flex-row md:flex-col gap-2 shrink-0 justify-end md:justify-center">
                                    {req.paymentMethod === 'DEPOSIT_TRANSFER' && req.paymentStatus === 'PENDING' && req.paymentProof && (
                                        <button
                                            onClick={() => confirmDepositMutation.mutate(req.id)}
                                            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
                                        >
                                            Xác nhận thanh toán
                                        </button>
                                    )}
                                    {req.status === 'PENDING' && (
                                        <>
                                            <button 
                                                onClick={() => updateStatusMutation.mutate({ id: req.id, status: 'APPROVED' })}
                                                className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                                            >
                                                <Check className="w-4 h-4" /> Đã nhập vào lịch
                                            </button>
                                            <button 
                                                onClick={() => updateStatusMutation.mutate({ id: req.id, status: 'REJECTED' })}
                                                className="bg-error/10 hover:bg-error/20 text-error border border-error/20 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                                            >
                                                <X className="w-4 h-4" /> Từ chối
                                            </button>
                                        </>
                                    )}
                                    <button 
                                        onClick={() => deleteMutation.mutate(req.id)}
                                        className="bg-background-tertiary hover:bg-background text-foreground-secondary border border-border px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 mt-auto"
                                    >
                                        <Trash2 className="w-4 h-4" /> Xóa bản ghi
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
