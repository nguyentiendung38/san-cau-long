import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, MessageSquareQuote, Star, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { VenueReviewStatus, venueReviewApi } from '@/services/venue-review.service';

const statusLabels: Record<VenueReviewStatus, string> = {
    PENDING: 'Chờ duyệt',
    APPROVED: 'Đã duyệt',
    REJECTED: 'Đã từ chối',
};

const statusClasses: Record<VenueReviewStatus, string> = {
    PENDING: 'bg-amber-100 text-amber-800',
    APPROVED: 'bg-green-100 text-green-800',
    REJECTED: 'bg-red-100 text-red-800',
};

export default function VenueReviewsPage() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [filter, setFilter] = useState<'ALL' | VenueReviewStatus>('ALL');
    const { data: reviews = [], isLoading, isError, refetch } = useQuery({
        queryKey: ['venue-reviews-admin'],
        queryFn: venueReviewApi.getAll,
    });
    const updateStatusMutation = useMutation({
        mutationFn: ({ id, status }: { id: string; status: VenueReviewStatus }) => venueReviewApi.updateStatus(id, status),
        onSuccess: () => {
            toast({ title: 'Đã cập nhật trạng thái đánh giá' });
            queryClient.invalidateQueries({ queryKey: ['venue-reviews-admin'] });
            queryClient.invalidateQueries({ queryKey: ['venue-reviews-public'] });
        },
        onError: (error: any) => {
            toast({
                title: 'Không thể cập nhật đánh giá',
                description: error?.response?.data?.message || 'Vui lòng thử lại.',
                variant: 'error',
            });
        },
    });

    const visibleReviews = filter === 'ALL' ? reviews : reviews.filter((review) => review.status === filter);
    const counts = {
        ALL: reviews.length,
        PENDING: reviews.filter((review) => review.status === 'PENDING').length,
        APPROVED: reviews.filter((review) => review.status === 'APPROVED').length,
        REJECTED: reviews.filter((review) => review.status === 'REJECTED').length,
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-foreground">Đánh giá sân</h1>
                <p className="mt-1 text-sm text-foreground-secondary">Xem, duyệt hoặc từ chối đánh giá và hình ảnh khách hàng gửi.</p>
            </div>

            <div className="flex flex-wrap gap-2">
                {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((status) => (
                    <button
                        key={status}
                        onClick={() => setFilter(status)}
                        className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                            filter === status ? 'bg-primary-500 text-white' : 'bg-background-secondary text-foreground-secondary hover:bg-background-hover'
                        }`}
                    >
                        {status === 'ALL' ? 'Tất cả' : statusLabels[status]} ({counts[status]})
                    </button>
                ))}
            </div>

            {isLoading ? (
                <div className="py-16 text-center text-foreground-secondary">Đang tải đánh giá...</div>
            ) : isError ? (
                <div className="rounded-xl border border-error/20 bg-background-secondary p-8 text-center">
                    <p className="text-foreground">Không thể tải danh sách đánh giá.</p>
                    <button onClick={() => void refetch()} className="mt-3 font-medium text-primary-500">Thử tải lại</button>
                </div>
            ) : visibleReviews.length === 0 ? (
                <div className="rounded-xl border border-border bg-background-secondary p-12 text-center">
                    <MessageSquareQuote className="mx-auto h-10 w-10 text-foreground-muted" />
                    <p className="mt-3 text-foreground-secondary">Chưa có đánh giá trong mục này.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {visibleReviews.map((review) => (
                        <article key={review.id} className="rounded-xl border border-border bg-background-secondary p-5 shadow-sm">
                            <div className="flex flex-wrap items-start justify-between gap-4">
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h2 className="font-semibold text-foreground">{review.customerName}</h2>
                                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClasses[review.status]}`}>
                                            {statusLabels[review.status]}
                                        </span>
                                    </div>
                                    <p className="mt-1 text-sm text-foreground-secondary">
                                        {review.customerPhone} <span className="mx-1">·</span> {review.venue?.name || 'Cơ sở đã xóa'}
                                    </p>
                                    <div className="mt-2 flex items-center gap-0.5" aria-label={`${review.rating} trên 5 sao`}>
                                        {[1, 2, 3, 4, 5].map((rating) => (
                                            <Star key={rating} className={`h-4 w-4 ${rating <= review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-foreground-muted'}`} />
                                        ))}
                                        <time className="ml-2 text-xs text-foreground-muted">{new Date(review.createdAt).toLocaleString('vi-VN')}</time>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    {review.status !== 'APPROVED' && (
                                        <button
                                            disabled={updateStatusMutation.isPending}
                                            onClick={() => updateStatusMutation.mutate({ id: review.id, status: 'APPROVED' })}
                                            className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
                                        >
                                            <Check className="h-4 w-4" /> Duyệt
                                        </button>
                                    )}
                                    {review.status !== 'REJECTED' && (
                                        <button
                                            disabled={updateStatusMutation.isPending}
                                            onClick={() => updateStatusMutation.mutate({ id: review.id, status: 'REJECTED' })}
                                            className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
                                        >
                                            <X className="h-4 w-4" /> Từ chối
                                        </button>
                                    )}
                                </div>
                            </div>
                            <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-foreground">{review.content}</p>
                            {!!review.images.length && (
                                <div className="mt-4 flex flex-wrap gap-2">
                                    {review.images.map((image, index) => (
                                        <a key={index} href={image} target="_blank" rel="noreferrer">
                                            <img src={image} alt={`Ảnh đính kèm ${index + 1}`} className="h-24 w-24 rounded-lg border border-border object-cover" />
                                        </a>
                                    ))}
                                </div>
                            )}
                        </article>
                    ))}
                </div>
            )}
        </div>
    );
}
