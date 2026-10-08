import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, X, Clock, Calendar, User, Phone, Trash2, Image as ImageIcon } from 'lucide-react';
import { bookingRequestApi } from '@/services/booking.service';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { useState } from 'react';

export default function BookingRequestsPage() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [selectedProof, setSelectedProof] = useState<string | null>(null);
    const [depositConfirmModal, setDepositConfirmModal] = useState<{ isOpen: boolean, reqId: string, name: string, defaultAmount: number }>({ isOpen: false, reqId: '', name: '', defaultAmount: 0 });
    const [depositAmount, setDepositAmount] = useState<string>('');

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
        mutationFn: ({ id, amount }: { id: string, amount: number }) => bookingRequestApi.updatePaymentStatus(id, 'PAID', amount),
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
                    {(!requests || requests.length === 0) ? (
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
                                        <span className="flex items-center gap-1.5">
                                            <span className="font-semibold text-primary-500">{req.venue?.name}</span>
                                            {req.court && <span>- Sân: <span className="font-semibold text-foreground">{req.court.name}</span></span>}
                                        </span>
                                        <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4 text-foreground-muted" /> {format(new Date(req.date), 'dd/MM/yyyy')}</span>
                                        <span className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-foreground-muted" /> {req.startTime} - {req.endTime}</span>
                                        <span className={`font-semibold ${req.paymentMethod === 'MOMO' ? 'text-pink-500' : 'text-foreground-secondary'}`}>
                                            {req.paymentMethod === 'DEPOSIT_TRANSFER'
                                                ? `Thanh toán QR · ${req.paymentStatus === 'PAID' ? 'Đã xác nhận' : 'Chờ kiểm tra'}`
                                                : `MoMo online · ${req.paymentStatus === 'PAID' ? 'đã thanh toán qua momo' : 'Chờ thanh toán'}`}
                                        </span>
                                        {req.paymentProof && (
                                            <button 
                                                onClick={() => setSelectedProof(req.paymentProof as string)} 
                                                className="flex items-center gap-1.5 text-primary-600 hover:text-primary-700 font-medium"
                                            >
                                                <ImageIcon className="w-4 h-4" />
                                                Xem bill cọc
                                            </button>
                                        )}
                                    </div>
                                    
                                    {req.orderedItems && (
                                        <div className="text-sm text-foreground-secondary bg-background-tertiary p-3 rounded-lg border border-border mt-2">
                                            <span className="font-semibold text-foreground">Dịch vụ đi kèm: </span>
                                            <span>
                                                {(() => {
                                                    try {
                                                        const items = JSON.parse(req.orderedItems);
                                                        return items.map((i: any) => `${i.quantity} x ${i.name}`).join(', ');
                                                    } catch (e) {
                                                        return req.orderedItems;
                                                    }
                                                })()}
                                            </span>
                                        </div>
                                    )}

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
                                            onClick={() => {
                                                setDepositConfirmModal({ isOpen: true, reqId: req.id, name: req.name, defaultAmount: req.paymentAmount || 0 });
                                                setDepositAmount(req.paymentAmount ? req.paymentAmount.toString() : '');
                                            }}
                                            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
                                        >
                                            Xác nhận thanh toán
                                        </button>
                                    )}
                                    {req.status === 'PENDING' && (
                                        <>
                                            <button onClick={() => updateStatusMutation.mutate({ id: req.id, status: 'APPROVED' })} disabled={updateStatusMutation.isPending} className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                                                <Check className="w-4 h-4" /> Đã nhập vào lịch
                                            </button>
                                            <button onClick={() => updateStatusMutation.mutate({ id: req.id, status: 'REJECTED' })} disabled={updateStatusMutation.isPending} className="bg-error/10 hover:bg-error/20 text-error border border-error/20 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                                                <X className="w-4 h-4" /> Từ chối
                                            </button>
                                        </>
                                    )}
                                    <button onClick={() => deleteMutation.mutate(req.id)} disabled={deleteMutation.isPending} className="bg-background-tertiary hover:bg-background text-foreground-secondary border border-border px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 mt-auto disabled:opacity-50 disabled:cursor-not-allowed">
                                        <Trash2 className="w-4 h-4" /> Xóa bản ghi
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Payment Proof Modal */}
            {selectedProof && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedProof(null)}>
                    <div className="relative bg-white rounded-2xl p-2 max-w-2xl w-full shadow-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center p-3 border-b border-gray-100">
                            <h3 className="font-bold text-gray-900">Ảnh chuyển khoản</h3>
                            <button onClick={() => setSelectedProof(null)} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
                                <X className="w-6 h-6 text-gray-500" />
                            </button>
                        </div>
                        <div className="p-2 overflow-auto flex-1 flex justify-center items-center bg-gray-50">
                            <img src={selectedProof} alt="Bill chuyển khoản" className="max-w-full max-h-[70vh] object-contain rounded-lg" />
                        </div>
                    </div>
                </div>
            )}

            {/* Deposit Confirm Modal */}
            {depositConfirmModal.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="relative bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="text-xl font-bold text-gray-900">Xác nhận tiền cọc</h3>
                                <p className="text-sm text-gray-500 mt-1">Khách hàng: <span className="font-semibold text-gray-800">{depositConfirmModal.name}</span></p>
                            </div>
                            <button onClick={() => setDepositConfirmModal({ ...depositConfirmModal, isOpen: false })} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Số tiền khách đã cọc (VNĐ)</label>
                                <input 
                                    type="number" 
                                    value={depositAmount} 
                                    onChange={e => setDepositAmount(e.target.value)} 
                                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500"
                                    placeholder="Nhập số tiền..."
                                />
                                <p className="text-xs text-gray-500 mt-1.5">Số tiền này sẽ được lưu và tự động trừ vào tổng tiền hóa đơn lúc khách đến thanh toán.</p>
                            </div>
                            
                            <div className="flex justify-end gap-3 pt-2">
                                <button 
                                    onClick={() => setDepositConfirmModal({ ...depositConfirmModal, isOpen: false })}
                                    className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-medium hover:bg-gray-50"
                                >
                                    Hủy
                                </button>
                                <button 
                                    onClick={() => {
                                        const amount = parseFloat(depositAmount);
                                        if (isNaN(amount) || amount < 0) {
                                            toast({ title: 'Vui lòng nhập số tiền hợp lệ', variant: 'error' });
                                            return;
                                        }
                                        confirmDepositMutation.mutate({ id: depositConfirmModal.reqId, amount });
                                        setDepositConfirmModal({ ...depositConfirmModal, isOpen: false });
                                    }}
                                    disabled={confirmDepositMutation.isPending}
                                    className="px-5 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold transition-colors disabled:opacity-50"
                                >
                                    {confirmDepositMutation.isPending ? 'Đang lưu...' : 'Lưu & Xác nhận'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
