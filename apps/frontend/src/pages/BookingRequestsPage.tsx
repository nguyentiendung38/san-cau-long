import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { 
    Check, 
    X, 
    Clock, 
    Calendar, 
    User, 
    Phone, 
    Trash2, 
    Image as ImageIcon, 
    Search, 
    Filter, 
    RotateCcw,
    Building2
} from 'lucide-react';
import { bookingRequestApi, getBookingRequestDue, getBookingRequestPaidAmount, getBookingRequestRefundDue, getBookingRequestTotal } from '@/services/booking.service';
import { venueApi } from '@/services/venue.service';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';
import { useState, useMemo, useEffect } from 'react';

export default function BookingRequestsPage() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [searchParams, setSearchParams] = useSearchParams();

    // Filters state synchronized with search params if present
    const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') || 'ALL');
    const [venueFilter, setVenueFilter] = useState<string>(searchParams.get('venueId') || 'ALL');
    const [dateFilter, setDateFilter] = useState<string>(searchParams.get('date') || '');
    const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>(searchParams.get('paymentMethod') || 'ALL');
    const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>(searchParams.get('paymentStatus') || 'ALL');
    const [searchQuery, setSearchQuery] = useState<string>('');

    useEffect(() => {
        setStatusFilter(searchParams.get('status') || 'ALL');
        setVenueFilter(searchParams.get('venueId') || 'ALL');
        setDateFilter(searchParams.get('date') || '');
        setPaymentMethodFilter(searchParams.get('paymentMethod') || 'ALL');
        setPaymentStatusFilter(searchParams.get('paymentStatus') || 'ALL');
    }, [searchParams]);

    // Modals
    const [selectedProof, setSelectedProof] = useState<string | null>(null);
    const [depositConfirmModal, setDepositConfirmModal] = useState<{ isOpen: boolean; reqId: string; name: string; total: number }>({
        isOpen: false, 
        reqId: '', 
        name: '',
        total: 0,
    });
    const [depositAmount, setDepositAmount] = useState<string>('');

    const [rejectModal, setRejectModal] = useState<{ isOpen: boolean; reqId: string; name: string }>({
        isOpen: false,
        reqId: '',
        name: ''
    });
    const [rejectReason, setRejectReason] = useState<string>('');

    // Fetch venues for dropdown
    const { data: venues } = useQuery({
        queryKey: ['venues-list'],
        queryFn: () => venueApi.getAll(),
    });

    // Fetch booking requests
    const { data: requests, isLoading } = useQuery({
        queryKey: ['booking-requests'],
        queryFn: () => bookingRequestApi.getAll(),
    });

    const updateStatusMutation = useMutation({
        mutationFn: ({ id, status, reason }: { id: string; status: string; reason?: string }) => 
            bookingRequestApi.updateStatus(id, status, reason),
        onSuccess: () => {
            toast({ title: 'Đã xử lý thành công', variant: 'success' });
            queryClient.invalidateQueries({ queryKey: ['booking-requests'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard'] });
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
            queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        },
    });

    const confirmDepositMutation = useMutation({
        mutationFn: ({ id, amount }: { id: string; amount: number }) => 
            bookingRequestApi.updatePaymentStatus(id, 'PAID', amount),
        onSuccess: () => {
            toast({ title: 'Đã xác nhận thanh toán', variant: 'success' });
            queryClient.invalidateQueries({ queryKey: ['booking-requests'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        },
        onError: () => toast({ title: 'Không thể xác nhận tiền cọc', variant: 'error' }),
    });

    const cancellationReviewMutation = useMutation({
        mutationFn: ({ id, status }: { id: string; status: 'APPROVED' | 'REJECTED'; type?: 'CANCELLATION' | 'RESCHEDULE' }) =>
            bookingRequestApi.reviewCancellation(id, status),
        onSuccess: (_, variables) => {
            toast({
                title: variables.status === 'APPROVED'
                    ? variables.type === 'RESCHEDULE' ? 'Đã duyệt đổi lịch' : 'Đã duyệt hủy lịch'
                    : variables.type === 'RESCHEDULE' ? 'Đã từ chối yêu cầu đổi lịch' : 'Đã từ chối yêu cầu hủy',
                variant: 'success',
            });
            queryClient.invalidateQueries({ queryKey: ['booking-requests'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        },
        onError: (error: any) => toast({
            title: 'Không thể xử lý yêu cầu hủy',
            description: error?.response?.data?.message || 'Vui lòng tải lại danh sách và thử lại.',
            variant: 'error',
        }),
    });

    // Summary counts
    const counts = useMemo(() => {
        const all = requests || [];
        return {
            all: all.length,
            pending: all.filter(r => r.status === 'PENDING').length,
            pendingTransfer: all.filter(r => r.paymentMethod === 'DEPOSIT_TRANSFER' && r.paymentStatus === 'PENDING').length,
            pendingCancellation: all.filter(r => r.cancellationRequestStatus === 'PENDING').length,
            approved: all.filter(r => r.status === 'APPROVED').length,
            rejected: all.filter(r => r.status === 'REJECTED' || r.status === 'CANCELLED').length,
        };
    }, [requests]);

    // Filtered requests
    const filteredRequests = useMemo(() => {
        return (requests || []).filter((req: any) => {
            // Status
            if (statusFilter !== 'ALL') {
                if (statusFilter === 'CANCEL_REQUESTED') {
                    if (req.cancellationRequestStatus !== 'PENDING') return false;
                } else if (statusFilter === 'REJECTED') {
                    if (req.status !== 'REJECTED' && req.status !== 'CANCELLED') return false;
                } else if (req.status !== statusFilter) {
                    return false;
                }
            }

            // Venue
            if (venueFilter !== 'ALL' && req.venueId !== venueFilter) return false;

            // Payment method
            if (paymentMethodFilter !== 'ALL' && req.paymentMethod !== paymentMethodFilter) return false;

            // Payment status
            if (paymentStatusFilter !== 'ALL' && req.paymentStatus !== paymentStatusFilter) return false;

            // Date
            if (dateFilter) {
                try {
                    const reqDateStr = format(new Date(req.date), 'yyyy-MM-dd');
                    if (reqDateStr !== dateFilter) return false;
                } catch {
                    // Ignore date parse error
                }
            }

            // Search by name or phone
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                const matchName = req.name?.toLowerCase().includes(q);
                const matchPhone = req.phone?.includes(q);
                if (!matchName && !matchPhone) return false;
            }

            return true;
        });
    }, [requests, statusFilter, venueFilter, paymentMethodFilter, paymentStatusFilter, dateFilter, searchQuery]);

    const isFiltered = statusFilter !== 'ALL' || venueFilter !== 'ALL' || paymentMethodFilter !== 'ALL' || paymentStatusFilter !== 'ALL' || dateFilter !== '' || searchQuery.trim() !== '';

    const resetFilters = () => {
        setStatusFilter('ALL');
        setVenueFilter('ALL');
        setDateFilter('');
        setPaymentMethodFilter('ALL');
        setPaymentStatusFilter('ALL');
        setSearchQuery('');
        setSearchParams({});
    };

    return (
        <div className="p-6 space-y-6 max-w-screen-xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Yêu cầu đặt sân online</h1>
                    <p className="text-foreground-secondary mt-1">
                        Quản lý, duyệt và lọc các yêu cầu đặt sân trực tuyến từ khách hàng
                    </p>
                </div>
                {isFiltered && (
                    <button
                        onClick={resetFilters}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-foreground-secondary hover:text-foreground bg-background-secondary transition-colors"
                    >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Đặt lại bộ lọc
                    </button>
                )}
            </div>

            {/* Quick Status Tabs */}
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2.5">
                <button
                    onClick={() => setStatusFilter('ALL')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                        statusFilter === 'ALL'
                            ? 'bg-primary-500/10 border-primary-500 text-primary-500 font-bold shadow-sm'
                            : 'bg-background-secondary border-border text-foreground-secondary hover:border-border-hover'
                    }`}
                >
                    <div className="text-xs">Tất cả yêu cầu</div>
                    <div className="text-xl font-bold mt-1">{counts.all}</div>
                </button>

                <button
                    onClick={() => setStatusFilter('PENDING')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                        statusFilter === 'PENDING'
                            ? 'bg-amber-500/15 border-amber-500 text-amber-500 font-bold shadow-sm'
                            : 'bg-background-secondary border-border text-foreground-secondary hover:border-border-hover'
                    }`}
                >
                    <div className="text-xs">Chờ duyệt</div>
                    <div className="text-xl font-bold mt-1 text-amber-500">{counts.pending}</div>
                </button>

                <button
                    onClick={() => {
                        setPaymentMethodFilter('DEPOSIT_TRANSFER');
                        setPaymentStatusFilter('PENDING');
                    }}
                    className={`p-3 rounded-xl border text-left transition-all ${
                        paymentMethodFilter === 'DEPOSIT_TRANSFER' && paymentStatusFilter === 'PENDING'
                            ? 'bg-blue-500/15 border-blue-500 text-blue-500 font-bold shadow-sm'
                            : 'bg-background-secondary border-border text-foreground-secondary hover:border-border-hover'
                    }`}
                >
                    <div className="text-xs">Cần duyệt cọc</div>
                    <div className="text-xl font-bold mt-1 text-blue-500">{counts.pendingTransfer}</div>
                </button>

                <button
                    onClick={() => setStatusFilter('CANCEL_REQUESTED')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                        statusFilter === 'CANCEL_REQUESTED'
                            ? 'bg-rose-500/15 border-rose-500 text-rose-500 font-bold shadow-sm'
                            : 'bg-background-secondary border-border text-foreground-secondary hover:border-border-hover'
                    }`}
                >
                    <div className="text-xs">Yêu cầu hủy</div>
                    <div className="text-xl font-bold mt-1 text-rose-500">{counts.pendingCancellation}</div>
                </button>

                <button
                    onClick={() => setStatusFilter('APPROVED')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                        statusFilter === 'APPROVED'
                            ? 'bg-emerald-500/15 border-emerald-500 text-emerald-500 font-bold shadow-sm'
                            : 'bg-background-secondary border-border text-foreground-secondary hover:border-border-hover'
                    }`}
                >
                    <div className="text-xs">Đã nhập lịch</div>
                    <div className="text-xl font-bold mt-1 text-emerald-500">{counts.approved}</div>
                </button>

                <button
                    onClick={() => setStatusFilter('REJECTED')}
                    className={`p-3 rounded-xl border text-left transition-all col-span-2 sm:col-span-1 ${
                        statusFilter === 'REJECTED'
                            ? 'bg-rose-500/15 border-rose-500 text-rose-500 font-bold shadow-sm'
                            : 'bg-background-secondary border-border text-foreground-secondary hover:border-border-hover'
                    }`}
                >
                    <div className="text-xs">Đã từ chối / Hủy</div>
                    <div className="text-xl font-bold mt-1 text-rose-500">{counts.rejected}</div>
                </button>
            </div>

            {/* Filter Bar */}
            <div className="bg-background-secondary border border-border rounded-xl p-4 space-y-3 shadow-sm">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-foreground-secondary mb-1">
                    <Filter className="w-3.5 h-3.5 text-primary-500" />
                    Bộ lọc chi tiết
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    {/* Search */}
                    <div className="relative">
                        <Search className="w-4 h-4 text-foreground-muted absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Tìm tên hoặc SĐT..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 bg-background-tertiary border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-primary-500"
                        />
                    </div>

                    {/* Venue select */}
                    <div>
                        <select
                            value={venueFilter}
                            onChange={(e) => setVenueFilter(e.target.value)}
                            className="w-full px-3 py-2 bg-background-tertiary border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-primary-500"
                        >
                            <option value="ALL">Tất cả cơ sở</option>
                            {(venues?.data || []).map((v) => (
                                <option key={v.id} value={v.id}>
                                    {v.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Date filter */}
                    <div>
                        <input
                            type="date"
                            value={dateFilter}
                            onChange={(e) => setDateFilter(e.target.value)}
                            className="w-full px-3 py-2 bg-background-tertiary border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-primary-500"
                        />
                    </div>

                    {/* Payment method */}
                    <div>
                        <select
                            value={paymentMethodFilter}
                            onChange={(e) => setPaymentMethodFilter(e.target.value)}
                            className="w-full px-3 py-2 bg-background-tertiary border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-primary-500"
                        >
                            <option value="ALL">Tất cả PTTT</option>
                            <option value="DEPOSIT_TRANSFER">Chuyển khoản</option>
                            <option value="VNPAY">VNPay online</option>
                        </select>
                    </div>

                    {/* Payment status */}
                    <div>
                        <select
                            value={paymentStatusFilter}
                            onChange={(e) => setPaymentStatusFilter(e.target.value)}
                            className="w-full px-3 py-2 bg-background-tertiary border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-primary-500"
                        >
                            <option value="ALL">Tất cả TT thanh toán</option>
                            <option value="PAID">Đã thanh toán / Đã nhận</option>
                            <option value="PENDING">Chờ thanh toán / Chờ xác nhận</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* List */}
            {isLoading ? (
                <div className="grid gap-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="bg-background-secondary rounded-xl h-32 animate-pulse border border-border" />
                    ))}
                </div>
            ) : (
                <div className="grid gap-4">
                    {filteredRequests.length === 0 ? (
                        <div className="text-center p-12 bg-background-secondary rounded-xl border border-border text-foreground-muted">
                            <div className="text-4xl mb-3">📬</div>
                            <p className="font-medium text-foreground">Không tìm thấy yêu cầu phù hợp</p>
                            <p className="text-sm mt-1">Hãy thử nới lỏng bộ lọc hoặc xóa điều kiện tìm kiếm.</p>
                            {isFiltered && (
                                <button
                                    onClick={resetFilters}
                                    className="mt-4 px-4 py-2 bg-primary-500 text-white rounded-lg text-xs font-semibold hover:bg-primary-600 transition-colors"
                                >
                                    Đặt lại bộ lọc
                                </button>
                            )}
                        </div>
                    ) : (
                        filteredRequests.map((req: any) => (
                            <div key={req.id} className="bg-background-secondary p-5 rounded-xl border border-border flex flex-col md:flex-row justify-between gap-4 hover:border-primary-500/30 transition-colors shadow-sm">
                                <div className="space-y-3 flex-1">
                                    <div className="flex items-center gap-3">
                                        <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                                            <User className="w-5 h-5 text-primary-500" /> {req.name}
                                        </h3>
                                        <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full border ${
                                                            req.cancellationRequestStatus === 'PENDING'
                                                                ? 'bg-rose-500/15 text-rose-500 border-rose-500/20'
                                                                : req.status === 'PENDING' 
                                                                ? 'bg-yellow-500/20 text-yellow-500 border-yellow-500/20' 
                                                : req.status === 'APPROVED' 
                                                    ? 'bg-primary-500/20 text-primary-400 border-primary-500/20' 
                                                                    : req.status === 'EXPIRED'
                                                                        ? 'bg-gray-500/20 text-gray-400 border-gray-500/20'
                                                                    : 'bg-error/20 text-error border-error/20'
                                        }`}>
                                            {req.cancellationRequestStatus === 'PENDING'
                                                ? `CHỜ DUYỆT ${req.cancellationRequestType === 'RESCHEDULE' ? 'ĐỔI LỊCH' : 'HỦY'}`
                                                : req.status === 'PENDING' ? 'CHỜ DUYỆT' : req.status === 'APPROVED' ? 'ĐÃ NHẬP LỊCH' : req.status === 'EXPIRED' ? 'HẾT HẠN' : 'ĐÃ HỦY'}
                                        </span>
                                    </div>
                                    <div className="text-sm text-foreground-secondary flex flex-wrap gap-x-6 gap-y-2">
                                        <span className="flex items-center gap-1.5"><Phone className="w-4 h-4 text-foreground-muted" /> {req.phone}</span>
                                        <span className="flex items-center gap-1.5">
                                            <Building2 className="w-4 h-4 text-primary-500" />
                                            <span className="font-semibold text-primary-500">{req.venue?.name}</span>
                                            {req.court && <span>- Sân: <span className="font-semibold text-foreground">{req.court.name}</span></span>}
                                        </span>
                                        <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4 text-foreground-muted" /> {format(new Date(req.date), 'dd/MM/yyyy')}</span>
                                        <span className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-foreground-muted" /> {req.startTime} - {req.endTime}</span>
                                        <span className={`font-semibold ${req.paymentMethod === 'VNPAY' ? 'text-pink-500' : 'text-foreground-secondary'}`}>
                                            {req.paymentMethod === 'DEPOSIT_TRANSFER'
                                            ? (req.paymentStatus === 'PAID' ? 'Chuyển khoản · Đã xác nhận tiền nhận' : 'Chưa xác nhận thanh toán')
                                                : `VNPAY online · ${req.paymentStatus === 'PAID' ? 'đã thanh toán qua vnpay' : 'Chờ thanh toán'}`}
                                        </span>
                                        {getBookingRequestTotal(req) > 0 && (
                                            <span className="font-semibold text-foreground">
                                            Tổng tiền: {formatCurrency(getBookingRequestTotal(req))}
                                            {` · Đã nhận: ${formatCurrency(getBookingRequestPaidAmount(req))}`}
                                            {getBookingRequestDue(req) > 0 && ` · Còn thiếu: ${formatCurrency(getBookingRequestDue(req))}`}
                                            {getBookingRequestRefundDue(req) > 0 && ` · Cần hoàn: ${formatCurrency(getBookingRequestRefundDue(req))}`}
                                            </span>
                                        )}
                                        {req.cancellationRequestStatus === 'PENDING' && req.cancellationRequestType === 'RESCHEDULE' && req.orderedItems && (
                                            <span className="font-semibold text-blue-600">
                                                {(() => {
                                                    try {
                                                        const requestedTotal = JSON.parse(req.orderedItems).requestedTotalAmount;
                                                        return Number.isFinite(requestedTotal)
                                                            ? `Tổng dự kiến sau đổi lịch: ${formatCurrency(requestedTotal)}`
                                                            : '';
                                                    } catch {
                                                        return '';
                                                    }
                                                })()}
                                            </span>
                                        )}
                                        {req.paymentMethod === 'DEPOSIT_TRANSFER' && req.transferReference && (
                                            <span className="rounded-md border border-primary-500/20 bg-primary-500/5 px-2 py-1 font-semibold text-primary-500">
                                                Nội dung CK: {req.transferReference}
                                                {req.status === 'PENDING' && req.expiresAt && ` · Hạn ${format(new Date(req.expiresAt), 'HH:mm dd/MM')}`}
                                            </span>
                                        )}
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
                                                        const parsed = JSON.parse(req.orderedItems);
                                                        const items = Array.isArray(parsed) ? parsed : parsed.items;
                                                        if (!Array.isArray(items)) return req.orderedItems;
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
                                    {req.cancellationRequestStatus === 'PENDING' && (
                                        <div className="text-sm text-rose-700 bg-rose-500/10 p-3 rounded-lg border border-rose-500/20 mt-2">
                                            <span className="font-semibold">Khách yêu cầu {req.cancellationRequestType === 'RESCHEDULE' ? 'đổi lịch' : 'hủy'}:</span> {req.cancellationRequestReason}
                                            <p className="mt-1 text-xs">Chính sách: khách gửi trước giờ bắt đầu tối thiểu 24 giờ; chỗ vẫn giữ theo lịch hiện tại đến khi admin xử lý.</p>
                                            {req.cancellationRequestType === 'RESCHEDULE' && req.requestedDate && (
                                                <p className="mt-1">Khung giờ đề xuất: {format(new Date(req.requestedDate), 'dd/MM/yyyy')} · {req.requestedStartTime}–{req.requestedEndTime}</p>
                                            )}
                                            {req.paymentStatus === 'PAID' && (
                                                <p className="mt-1 text-xs">Đã ghi nhận thanh toán. Duyệt yêu cầu không tự hoàn tiền hoặc thay đổi hóa đơn; giữ nguyên khoản tiền và xử lý hoàn riêng qua luồng hoàn hóa đơn nếu cần.</p>
                                            )}
                                        </div>
                                    )}
                                    <div className="text-xs text-foreground-muted pt-1">
                                        Gửi lúc: {format(new Date(req.createdAt), 'HH:mm dd/MM/yyyy')}
                                    </div>
                                </div>
                                <div className="flex flex-row md:flex-col gap-2 shrink-0 justify-end md:justify-center">
                                    {req.cancellationRequestStatus === 'PENDING' && (
                                        <>
                                            <button
                                                onClick={() => cancellationReviewMutation.mutate({ id: req.id, status: 'APPROVED', type: req.cancellationRequestType })}
                                                disabled={cancellationReviewMutation.isPending}
                                                className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
                                            >
                                                {req.cancellationRequestType === 'RESCHEDULE' ? 'Duyệt đổi lịch' : 'Duyệt hủy lịch'}
                                            </button>
                                            <button
                                                onClick={() => cancellationReviewMutation.mutate({ id: req.id, status: 'REJECTED', type: req.cancellationRequestType })}
                                                disabled={cancellationReviewMutation.isPending}
                                                className="bg-background-tertiary hover:bg-background text-foreground-secondary border border-border px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
                                            >
                                                {req.cancellationRequestType === 'RESCHEDULE' ? 'Từ chối đổi lịch' : 'Từ chối hủy'}
                                            </button>
                                        </>
                                    )}
                                    {req.paymentMethod === 'DEPOSIT_TRANSFER' && req.paymentStatus !== 'PAID' && ['PENDING', 'APPROVED', 'EXPIRED'].includes(req.status) && (
                                        <button
                                            onClick={() => {
                                                const total = getBookingRequestTotal(req);
                                                setDepositConfirmModal({ isOpen: true, reqId: req.id, name: req.name, total });
                                                setDepositAmount(String(total));
                                            }}
                                            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
                                        >
                                            {req.status === 'EXPIRED' ? 'Ghi nhận tiền nhận (đã hết hạn)' : req.status === 'APPROVED' ? 'Đối soát khoản còn thiếu' : 'Đối soát & xác nhận'}
                                        </button>
                                    )}
                                    {req.status === 'PENDING' && req.paymentMethod !== 'VNPAY' && (
                                        <>
                                            <button 
                                                onClick={() => updateStatusMutation.mutate({ id: req.id, status: 'APPROVED' })} 
                                                disabled={updateStatusMutation.isPending} 
                                                className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                <Check className="w-4 h-4" /> Đã nhập vào lịch
                                            </button>
                                            <button 
                                                onClick={() => {
                                                    setRejectModal({ isOpen: true, reqId: req.id, name: req.name });
                                                    setRejectReason('');
                                                }} 
                                                disabled={updateStatusMutation.isPending} 
                                                className="bg-error/10 hover:bg-error/20 text-error border border-error/20 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                <X className="w-4 h-4" /> Từ chối
                                            </button>
                                        </>
                                    )}

                                    {req.status === 'PENDING' && req.paymentMethod === 'VNPAY' && (
                                        <div className="bg-amber-500/10 text-amber-500 border border-amber-500/20 px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center text-center">
                                            Chờ khách thanh toán qua VNPAY...
                                        </div>
                                    )}
                                    <button 
                                        onClick={() => deleteMutation.mutate(req.id)} 
                                        disabled={deleteMutation.isPending} 
                                        className="bg-background-tertiary hover:bg-background text-foreground-secondary border border-border px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 mt-auto disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
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
                                <h3 className="text-xl font-bold text-gray-900">Đối soát chuyển khoản</h3>
                                <p className="text-sm text-gray-500 mt-1">Khách hàng: <span className="font-semibold text-gray-800">{depositConfirmModal.name}</span></p>
                                <p className="mt-1 text-xs text-amber-700">Chỉ xác nhận đã thanh toán khi tổng số tiền đã nhận lũy kế đủ tổng đơn ({formatCurrency(depositConfirmModal.total)}). Nếu khách đổi lịch và đã trả một phần, nhập tổng số tiền đã nhận trước và sau khi đổi.</p>
                            </div>
                            <button onClick={() => setDepositConfirmModal({ ...depositConfirmModal, isOpen: false })} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Tổng tiền đã nhận lũy kế (VNĐ)</label>
                                <input 
                                    type="number" 
                                    value={depositAmount} 
                                    onChange={e => setDepositAmount(e.target.value)} 
                                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500"
                                    placeholder="Nhập số tiền..."
                                />
                                <p className="text-xs text-gray-500 mt-1.5">Nhập tổng tiền lũy kế sau khi đối soát. Ảnh khách tải lên không tự động xác nhận thanh toán.</p>
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
                                        if (!Number.isFinite(amount) || amount !== depositConfirmModal.total) {
                                            toast({ title: 'Số tiền xác nhận phải bằng tổng tiền đặt sân', variant: 'error' });
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

            {/* Rejection Modal with Reason */}
            {rejectModal.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="relative bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="text-xl font-bold text-gray-900">Từ chối yêu cầu đặt sân</h3>
                                <p className="text-sm text-gray-500 mt-1">Khách hàng: <span className="font-semibold text-gray-800">{rejectModal.name}</span></p>
                            </div>
                            <button onClick={() => setRejectModal({ ...rejectModal, isOpen: false })} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Lý do từ chối (hiển thị cho khách)</label>
                                <textarea
                                    rows={3}
                                    value={rejectReason}
                                    onChange={e => setRejectReason(e.target.value)}
                                    className="w-full border border-gray-300 rounded-xl p-3 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                                    placeholder="Nhập lý do hoặc chọn gợi ý bên dưới..."
                                />
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                    {[
                                        'Khung giờ đã có người đặt',
                                        'Sân đang bảo trì',
                                        'Khách yêu cầu hủy',
                                        'Chưa nhận được chuyển khoản cọc'
                                    ].map((s) => (
                                        <button
                                            key={s}
                                            type="button"
                                            onClick={() => setRejectReason(s)}
                                            className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2.5 py-1 rounded-full transition-colors"
                                        >
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    onClick={() => setRejectModal({ ...rejectModal, isOpen: false })}
                                    className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-medium hover:bg-gray-50"
                                >
                                    Đóng
                                </button>
                                <button
                                    onClick={() => {
                                        updateStatusMutation.mutate({ 
                                            id: rejectModal.reqId, 
                                            status: 'REJECTED', 
                                            reason: rejectReason.trim() || undefined 
                                        });
                                        setRejectModal({ ...rejectModal, isOpen: false });
                                    }}
                                    disabled={updateStatusMutation.isPending}
                                    className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors disabled:opacity-50"
                                >
                                    {updateStatusMutation.isPending ? 'Đang xử lý...' : 'Xác nhận từ chối'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
