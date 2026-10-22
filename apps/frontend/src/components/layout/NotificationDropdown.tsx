import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bell, Check, Clock, X, ChevronRight } from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { bookingRequestApi } from '@/services/booking.service';

interface Notification {
    id: string;
    type: 'info' | 'warning' | 'success' | 'error';
    title: string;
    message: string;
    time: string;
    read: boolean;
    // Link để navigate khi click
    link?: string;
    // Data bổ sung (bookingId, invoiceId, etc.)
    data?: {
        bookingId?: string;
        invoiceId?: string;
        customerId?: string;
        courtId?: string;
    };
}



export function NotificationDropdown() {
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [readIds, setReadIds] = useState<Set<string>>(() => {
        try {
            const storedIds: unknown = JSON.parse(localStorage.getItem('admin_read_booking_notifications') || '[]');
            return new Set(Array.isArray(storedIds) ? storedIds.filter((id): id is string => typeof id === 'string') : []);
        } catch {
            return new Set();
        }
    });

    const [isNotifyEnabled, setIsNotifyEnabled] = useState(localStorage.getItem('setting_notify_new_booking') !== 'false');

    useEffect(() => {
        const handleSettingsChange = () => {
            setIsNotifyEnabled(localStorage.getItem('setting_notify_new_booking') !== 'false');
        };
        window.addEventListener('settings_changed', handleSettingsChange);
        window.addEventListener('storage', handleSettingsChange);
        return () => {
            window.removeEventListener('settings_changed', handleSettingsChange);
            window.removeEventListener('storage', handleSettingsChange);
        };
    }, []);

    const { data: bookingRequests } = useQuery({
        queryKey: ['booking-requests'],
        queryFn: () => bookingRequestApi.getAll(),
        refetchInterval: isNotifyEnabled ? 5000 : false,
        enabled: isNotifyEnabled
    });

    const recentThreshold = Date.now() - 48 * 60 * 60 * 1000;

    const notifications: Notification[] = !isNotifyEnabled ? [] : (bookingRequests || [])
        .filter((req: any) => {
            if (req.status === 'PENDING' || req.cancellationRequestStatus === 'PENDING') return true;
            // Hiển cả các đơn vừa thanh toán VNPAY tự động duyệt (APPROVED) trong 48h gần nhất để Admin nắm bắt
            if (req.status === 'APPROVED' && new Date(req.createdAt).getTime() >= recentThreshold) return true;
            return false;
        })
        .map((req: any) => {
            const hasCancellation = req.cancellationRequestStatus === 'PENDING';
            const isReschedule = req.cancellationRequestType === 'RESCHEDULE';
            const hasProof = req.paymentMethod === 'DEPOSIT_TRANSFER' && req.paymentProof && req.paymentStatus === 'PENDING';
            const isVnpayPaid = req.paymentMethod === 'VNPAY' && req.paymentStatus === 'PAID';
            const isFromZalo = String(req.notes || '').toLowerCase().includes('zalo');
            const sourceTag = isFromZalo ? '[Zalo Mini App]' : '[Website]';
            const courtLabel = req.court?.name ? `${req.court.name} · ` : '';

            const notifId = hasCancellation
                ? `${req.id}:cancel:${req.cancellationRequestedAt || req.updatedAt}`
                : isVnpayPaid
                    ? `${req.id}:vnpay-paid`
                    : req.id;

            let title = `${sourceTag} Yêu cầu đặt sân mới`;
            let type: Notification['type'] = 'info';
            let message = `${req.name} (${req.phone}) đặt ${courtLabel}ngày ${formatDate(req.date)} (${req.startTime}-${req.endTime})`;
            let link = '/booking-requests?status=PENDING';

            if (hasCancellation) {
                type = 'warning';
                title = isReschedule
                    ? `${sourceTag} Khách yêu cầu đổi lịch`
                    : `${sourceTag} Khách yêu cầu hủy lịch`;
                message = isReschedule
                    ? `${req.name} (${req.phone}) xin đổi lịch ${courtLabel}sang ${req.requestedDate ? formatDate(req.requestedDate) : ''} (${req.requestedStartTime}-${req.requestedEndTime})`
                    : `${req.name} (${req.phone}) yêu cầu hủy lịch ${courtLabel}ngày ${formatDate(req.date)} (${req.startTime}-${req.endTime})`;
                link = '/booking-requests?status=CANCEL_REQUESTED';
            } else if (hasProof) {
                type = 'warning';
                title = `${sourceTag} Cần duyệt bill chuyển khoản`;
                message = `${req.name} (${req.phone}) đặt ${courtLabel}ngày ${formatDate(req.date)} (${req.startTime}-${req.endTime}) · Đã gửi ảnh bill`;
                link = '/booking-requests?paymentMethod=DEPOSIT_TRANSFER&paymentStatus=PENDING';
            } else if (isVnpayPaid || req.status === 'APPROVED') {
                type = 'success';
                title = isVnpayPaid
                    ? `${sourceTag} Đặt sân & Đã thanh toán VNPAY`
                    : `${sourceTag} Lịch đặt sân đã xác nhận`;
                message = `${req.name} (${req.phone}) đặt ${courtLabel}ngày ${formatDate(req.date)} (${req.startTime}-${req.endTime})`;
                link = '/booking-requests?status=APPROVED';
            }

            return {
                id: notifId,
                type,
                title,
                message,
                time: new Date(req.cancellationRequestedAt || req.createdAt).toLocaleString('vi-VN'),
                read: readIds.has(notifId),
                link,
            };
        });

    const unreadCount = notifications.filter(n => !n.read).length;

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleNotificationClick = (notification: Notification) => {
        // Mark as read
        setReadIds(prev => {
            const next = new Set(prev);
            next.add(notification.id);
            localStorage.setItem('admin_read_booking_notifications', JSON.stringify([...next]));
            return next;
        });

        // Close dropdown
        setIsOpen(false);

        // Navigate to the relevant page
        if (notification.link) {
            navigate(notification.link);
        }
    };

    const markAllAsRead = () => {
        const next = new Set(notifications.map(n => n.id));
        setReadIds(next);
        localStorage.setItem('admin_read_booking_notifications', JSON.stringify([...next]));
    };

    const getTypeIcon = (type: Notification['type']) => {
        switch (type) {
            case 'info': return <Bell className="w-4 h-4 text-info" />;
            case 'warning': return <Clock className="w-4 h-4 text-warning" />;
            case 'success': return <Check className="w-4 h-4 text-success" />;
            case 'error': return <X className="w-4 h-4 text-error" />;
        }
    };

    const getTypeBgColor = (type: Notification['type']) => {
        switch (type) {
            case 'info': return 'bg-info/10';
            case 'warning': return 'bg-warning/10';
            case 'success': return 'bg-success/10';
            case 'error': return 'bg-error/10';
        }
    };

    return (
        <div ref={dropdownRef} className="relative">
            {/* Bell button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 rounded-lg text-foreground-secondary hover:text-foreground hover:bg-background-tertiary transition-colors"
            >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                    <span className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] bg-error text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown panel */}
            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-96 bg-background-secondary border border-border rounded-xl shadow-2xl overflow-hidden z-50 animate-slideDown">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-background-tertiary/50">
                        <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-foreground">Thông báo</h3>
                            {unreadCount > 0 && (
                                <span className="px-2 py-0.5 bg-primary-500 text-white text-xs rounded-full">
                                    {unreadCount} mới
                                </span>
                            )}
                        </div>
                        {unreadCount > 0 && (
                            <button
                                onClick={markAllAsRead}
                                className="text-xs text-primary-500 hover:underline font-medium"
                            >
                                Đánh dấu đã đọc
                            </button>
                        )}
                    </div>

                    {/* Notifications list */}
                    <div className="max-h-96 overflow-y-auto">
                        {notifications.length === 0 ? (
                            <div className="py-12 text-center text-foreground-muted">
                                <Bell className="w-10 h-10 mx-auto mb-3 opacity-50" />
                                <p className="font-medium">Không có thông báo mới</p>
                                <p className="text-sm mt-1">Khi có thông báo, chúng sẽ hiển thị ở đây</p>
                            </div>
                        ) : (
                            notifications.map(notification => (
                                <button
                                    key={notification.id}
                                    onClick={() => handleNotificationClick(notification)}
                                    className={cn(
                                        'w-full text-left px-4 py-3.5 hover:bg-background-tertiary transition-colors border-b border-border last:border-0 group',
                                        !notification.read && 'bg-primary-500/5'
                                    )}
                                >
                                    <div className="flex gap-3">
                                        <div className={cn('mt-0.5 p-2 rounded-lg', getTypeBgColor(notification.type))}>
                                            {getTypeIcon(notification.type)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className={cn(
                                                    'font-medium text-sm',
                                                    !notification.read ? 'text-foreground' : 'text-foreground-secondary'
                                                )}>
                                                    {notification.title}
                                                </span>
                                                <ChevronRight className="w-4 h-4 text-foreground-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </div>
                                            <p className="text-xs text-foreground-secondary mt-0.5 line-clamp-2">
                                                {notification.message}
                                            </p>
                                            <div className="flex items-center gap-2 mt-1.5">
                                                <span className="text-xs text-foreground-muted">
                                                    {notification.time}
                                                </span>
                                                {!notification.read && (
                                                    <span className="w-1.5 h-1.5 bg-primary-500 rounded-full" />
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>

                    {/* Footer */}
                    <div className="border-t border-border bg-background-tertiary/50">
                        <button
                            onClick={() => {
                                setIsOpen(false);
                                navigate('/booking-requests');
                            }}
                            className="w-full py-3 text-sm text-primary-500 hover:bg-background-tertiary transition-colors font-medium flex items-center justify-center gap-1"
                        >
                            Xem tất cả yêu cầu đặt sân
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes slideDown {
                    from {
                        opacity: 0;
                        transform: translateY(-10px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                .animate-slideDown {
                    animation: slideDown 0.2s ease-out;
                }
            `}</style>
        </div>
    );
}
