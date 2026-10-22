import { useState, useEffect } from 'react';
import { X, Calendar, Clock, User, FileText, AlertCircle, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { bookingApi, CreateBookingInput, PricingResult, AvailabilityResult } from '@/services/booking.service';
import { voucherApi } from '@/services/voucher.service';
import { customerApi, Customer } from '@/services/customer.service';
import { Court } from '@/services/booking.service';

interface NewBookingModalProps {
    isOpen: boolean;
    onClose: () => void;
    courts: Court[];
    selectedDate?: Date;
    selectedCourtId?: string;
    selectedTime?: string;
    onSuccess: () => void;
}

function getLocalDateString(d = new Date()) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getNextUpcomingSlot() {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    let nextHour = currentHour;
    let nextMinute = currentMinute < 30 ? 30 : 0;
    if (currentMinute >= 30) {
        nextHour += 1;
    }
    if (nextHour < 6) {
        nextHour = 6;
        nextMinute = 0;
    }
    if (nextHour >= 23) {
        nextHour = 22;
        nextMinute = 0;
    }
    const startTime = `${String(nextHour).padStart(2, '0')}:${String(nextMinute).padStart(2, '0')}`;
    const endHour = Math.min(nextHour + 1, 23);
    const endTime = `${String(endHour).padStart(2, '0')}:${String(nextMinute).padStart(2, '0')}`;
    return { startTime, endTime };
}

function isPastSlot(dateStr: string, startTimeStr: string): boolean {
    if (!dateStr || !startTimeStr) return false;
    const todayStr = getLocalDateString();
    if (dateStr < todayStr) return true;
    if (dateStr > todayStr) return false;

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const [h, m] = startTimeStr.split(':').map(Number);
    const slotMinutes = (h || 0) * 60 + (m || 0);
    return slotMinutes <= currentMinutes;
}

const TIME_OPTIONS = Array.from({ length: 34 }, (_, i) => {
    const hour = Math.floor(i / 2) + 6;
    const minute = (i % 2) * 30;
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
});

export function NewBookingModal({
    isOpen,
    onClose,
    courts,
    selectedDate,
    selectedCourtId = '',
    selectedTime = '',
    onSuccess,
}: NewBookingModalProps) {
    const getInitialDateAndTime = () => {
        const todayStr = getLocalDateString();
        const rawDate = selectedDate ? getLocalDateString(selectedDate) : todayStr;
        const validDate = rawDate < todayStr ? todayStr : rawDate;
        let validStart = selectedTime;
        let validEnd = selectedTime ?
            `${String(parseInt(selectedTime.split(':')[0]) + 1).padStart(2, '0')}:${selectedTime.split(':')[1]}`
            : '';
        if (validDate === todayStr) {
            if (!validStart || isPastSlot(validDate, validStart)) {
                const upcoming = getNextUpcomingSlot();
                validStart = upcoming.startTime;
                validEnd = upcoming.endTime;
            }
        } else if (!validStart) {
            validStart = '08:00';
            validEnd = '09:00';
        }
        return { validDate, validStart, validEnd };
    };

    const [formData, setFormData] = useState(() => {
        const { validDate, validStart, validEnd } = getInitialDateAndTime();
        return {
            courtId: selectedCourtId,
            customerId: '',
            date: validDate,
            startTime: validStart,
            endTime: validEnd,
            notes: '',
        };
    });

    const [customers, setCustomers] = useState<Customer[]>([]);
    const [customerSearch, setCustomerSearch] = useState('');
    const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [showQuickNewCustomer, setShowQuickNewCustomer] = useState(false);
    const [newCustomerName, setNewCustomerName] = useState('');
    const [newCustomerPhone, setNewCustomerPhone] = useState('');
    const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);

    const [pricing, setPricing] = useState<PricingResult | null>(null);
    const [isLoadingPrice, setIsLoadingPrice] = useState(false);
    const [availability, setAvailability] = useState<AvailabilityResult | null>(null);
    const [loadingAvailability, setLoadingAvailability] = useState(false);
    const [voucherCode, setVoucherCode] = useState('');
    const [voucherValid, setVoucherValid] = useState(false);
    const [voucherMessage, setVoucherMessage] = useState('');
    const [discountAmount, setDiscountAmount] = useState(0);
    const [isApplyingVoucher, setIsApplyingVoucher] = useState(false);

    const handleApplyVoucher = async () => {
        if (!voucherCode.trim() || !pricing) return;
        setIsApplyingVoucher(true);
        setVoucherMessage('');
        try {
            const res = await voucherApi.validate(voucherCode.trim(), pricing.total);
            if (res.valid) {
                setVoucherValid(true);
                setDiscountAmount(res.discountAmount);
                setVoucherMessage(`Áp dụng thành công, giảm ${new Intl.NumberFormat('vi-VN').format(res.discountAmount)}đ`);
            } else {
                setVoucherValid(false);
                setDiscountAmount(0);
                setVoucherMessage('Mã không hợp lệ hoặc đã hết hạn');
            }
        } catch (e: any) {
            setVoucherValid(false);
            setDiscountAmount(0);
            setVoucherMessage(e.response?.data?.message || 'Lỗi kiểm tra mã giảm giá');
        } finally {
            setIsApplyingVoucher(false);
        }
    };


    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Reset form when modal opens
    useEffect(() => {
        if (isOpen) {
            const { validDate, validStart, validEnd } = getInitialDateAndTime();
            setFormData({
                courtId: selectedCourtId || courts[0]?.id || '',
                customerId: '',
                date: validDate,
                startTime: validStart,
                endTime: validEnd,
                notes: '',
            });
            setSelectedCustomer(null);
            setCustomerSearch('');
            setPricing(null);
            setAvailability(null);
            setErrors({});
            setVoucherCode('');
            setVoucherValid(false);
            setVoucherMessage('');
            setDiscountAmount(0);
            setShowQuickNewCustomer(false);
            setNewCustomerName('');
            setNewCustomerPhone('');
        }
    }, [isOpen, selectedCourtId, selectedDate, selectedTime, courts]);

    // Load customers
    useEffect(() => {
        customerApi.getAll({ limit: 100 }).then(res => {
            setCustomers(res.data);
        });
    }, []);

    // Check availability and price when court/date/time changes
    useEffect(() => {
        if (formData.courtId && formData.date && formData.startTime && formData.endTime) {
            // Check availability
            setLoadingAvailability(true);
            bookingApi.checkAvailability(
                formData.courtId,
                formData.date,
                formData.startTime,
                formData.endTime
            ).then(result => {
                setAvailability(result);
                setLoadingAvailability(false);
            }).catch(() => {
                setLoadingAvailability(false);
            });

            // Calculate price
            setIsLoadingPrice(true);
            bookingApi.calculatePrice(
                formData.courtId,
                formData.date,
                formData.startTime,
                formData.endTime
            ).then(result => {
                setPricing(result);
                setIsLoadingPrice(false);
            }).catch(() => {
                setIsLoadingPrice(false);
            });
        }
    }, [formData.courtId, formData.date, formData.startTime, formData.endTime]);

    const filteredCustomers = customers.filter(c =>
        c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
        c.phone.includes(customerSearch)
    );

    const validate = (): boolean => {
        const newErrors: Record<string, string> = {};

        if (!formData.courtId) newErrors.courtId = 'Vui lòng chọn sân';
        if (!formData.date) newErrors.date = 'Vui lòng chọn ngày';
        if (!formData.startTime) newErrors.startTime = 'Vui lòng chọn giờ bắt đầu';
        if (!formData.endTime) newErrors.endTime = 'Vui lòng chọn giờ kết thúc';

        if (formData.startTime >= formData.endTime) {
            newErrors.endTime = 'Giờ kết thúc phải sau giờ bắt đầu';
        }

        const todayStr = getLocalDateString();
        if (formData.date && formData.date < todayStr) {
            newErrors.date = 'Không thể đặt sân vào ngày đã qua';
        } else if (formData.date && formData.startTime && isPastSlot(formData.date, formData.startTime)) {
            newErrors.startTime = 'Khung giờ này đã qua thời gian hiện tại';
        }

        if (availability && !availability.available) {
            newErrors.availability = availability.isPast
                ? 'Khung giờ đã qua thời gian hiện tại'
                : 'Khung giờ này đã có người đặt';
        }

        if (pricing && pricing.total === 0 && pricing.appliedRule === 'Chưa thiết lập giá') {
            newErrors.availability = 'Khung giờ này ngoài giờ hoạt động (chưa thiết lập giá)';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validate()) return;

        setIsSubmitting(true);
        try {
            const input: CreateBookingInput = {
                courtId: formData.courtId,
                customerId: selectedCustomer?.id,
                date: formData.date,
                startTime: formData.startTime,
                endTime: formData.endTime,
                notes: formData.notes || undefined,
                voucherCode: voucherValid && voucherCode.trim() ? voucherCode.trim() : undefined,
                discountAmount: voucherValid && discountAmount > 0 ? discountAmount : undefined,
            };

            await bookingApi.create(input);
            onSuccess();
            onClose();
        } catch (error: any) {
            const message = error.response?.data?.message || 'Không thể tạo lịch đặt. Vui lòng thử lại.';
            setErrors({ submit: message });
        } finally {
            setIsSubmitting(false);
        }
    };

    const selectCustomer = (customer: Customer) => {
        setSelectedCustomer(customer);
        setFormData(prev => ({ ...prev, customerId: customer.id }));
        setCustomerSearch(customer.name);
        setShowCustomerDropdown(false);
        setShowQuickNewCustomer(false);
    };

    const handleQuickCreateCustomer = async () => {
        if (!newCustomerName.trim() || !newCustomerPhone.trim()) {
            setErrors(prev => ({ ...prev, customer: 'Vui lòng nhập tên và số điện thoại khách hàng mới' }));
            return;
        }
        setIsCreatingCustomer(true);
        setErrors(prev => {
            const { customer: _, ...rest } = prev;
            return rest;
        });
        try {
            const created = await customerApi.create({
                name: newCustomerName.trim(),
                phone: newCustomerPhone.trim(),
            });
            setCustomers(prev => [created, ...prev]);
            selectCustomer(created);
            setNewCustomerName('');
            setNewCustomerPhone('');
        } catch (error: any) {
            setErrors(prev => ({
                ...prev,
                customer: error.response?.data?.message || 'Không thể tạo khách hàng mới (có thể SĐT đã tồn tại)',
            }));
        } finally {
            setIsCreatingCustomer(false);
        }
    };

    const isPast = isPastSlot(formData.date, formData.startTime);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative w-full max-w-xl mx-4 bg-background-secondary border border-border rounded-xl shadow-2xl max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border bg-background-tertiary">
                    <h2 className="text-lg font-semibold text-foreground">Đặt sân mới</h2>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-lg hover:bg-background transition-colors"
                    >
                        <X className="w-5 h-5 text-foreground-secondary" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-140px)]">
                    {/* Court Selection */}
                    <div>
                        <label className="flex items-center gap-2 text-sm font-medium text-foreground mb-2">
                            <Calendar className="w-4 h-4 text-primary-500" />
                            Chọn sân *
                        </label>
                        <select
                            value={formData.courtId}
                            onChange={(e) => setFormData(prev => ({ ...prev, courtId: e.target.value }))}
                            className={cn(
                                "w-full bg-background-tertiary border rounded-lg px-3 py-2.5 text-foreground",
                                "focus:outline-none focus:ring-2 focus:ring-primary-500",
                                errors.courtId ? 'border-red-500' : 'border-border'
                            )}
                        >
                            <option value="">-- Chọn sân --</option>
                            {courts.map(court => (
                                <option key={court.id} value={court.id}>
                                    {court.name}
                                </option>
                            ))}
                        </select>
                        {errors.courtId && (
                            <p className="text-red-400 text-sm mt-1">{errors.courtId}</p>
                        )}
                    </div>

                    {/* Date */}
                    <div>
                        <label className="flex items-center gap-2 text-sm font-medium text-foreground mb-2">
                            <Calendar className="w-4 h-4 text-primary-500" />
                            Ngày đặt *
                        </label>
                        <input
                            type="date"
                            min={getLocalDateString()}
                            value={formData.date}
                            onChange={(e) => {
                                const newDate = e.target.value;
                                setFormData(prev => {
                                    let newStart = prev.startTime;
                                    let newEnd = prev.endTime;
                                    if (newDate === getLocalDateString() && isPastSlot(newDate, newStart)) {
                                        const upcoming = getNextUpcomingSlot();
                                        newStart = upcoming.startTime;
                                        newEnd = upcoming.endTime;
                                    }
                                    return { ...prev, date: newDate, startTime: newStart, endTime: newEnd };
                                });
                            }}
                            className={cn(
                                "w-full bg-background-tertiary border rounded-lg px-3 py-2.5 text-foreground",
                                "focus:outline-none focus:ring-2 focus:ring-primary-500",
                                errors.date ? 'border-red-500' : 'border-border'
                            )}
                        />
                        {errors.date && (
                            <p className="text-red-400 text-sm mt-1">{errors.date}</p>
                        )}
                    </div>

                    {/* Time Selection */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="flex items-center gap-2 text-sm font-medium text-foreground mb-2">
                                <Clock className="w-4 h-4 text-primary-500" />
                                Giờ bắt đầu *
                            </label>
                            <input
                                type="time"
                                value={formData.startTime}
                                onChange={(e) => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
                                className={cn(
                                    "w-full bg-background-tertiary border rounded-lg px-3 py-2 text-foreground",
                                    "focus:outline-none focus:ring-2 focus:ring-primary-500",
                                    errors.startTime ? 'border-red-500' : 'border-border'
                                )}
                            />
                        </div>
                        <div>
                            <label className="flex items-center gap-2 text-sm font-medium text-foreground mb-2">
                                <Clock className="w-4 h-4 text-primary-500" />
                                Giờ kết thúc *
                            </label>
                            <input
                                type="time"
                                value={formData.endTime}
                                onChange={(e) => setFormData(prev => ({ ...prev, endTime: e.target.value }))}
                                className={cn(
                                    "w-full bg-background-tertiary border rounded-lg px-3 py-2 text-foreground",
                                    "focus:outline-none focus:ring-2 focus:ring-primary-500",
                                    errors.endTime ? 'border-red-500' : 'border-border'
                                )}
                            />
                            {errors.endTime && (
                                <p className="text-red-400 text-sm mt-1">{errors.endTime}</p>
                            )}
                        </div>
                    </div>

                    {/* Availability Status */}
                    {formData.courtId && formData.date && formData.startTime && (
                        <div className={cn(
                            "p-3 rounded-lg border flex items-center gap-3",
                            loadingAvailability ? 'border-border bg-background-tertiary' :
                                isPast ? 'border-amber-500/30 bg-amber-500/10' :
                                pricing && pricing.total === 0 && pricing.appliedRule === 'Chưa thiết lập giá' ? 'border-red-500/30 bg-red-500/10' :
                                availability?.available ? 'border-green-500/30 bg-green-500/10' :
                                    'border-red-500/30 bg-red-500/10'
                        )}>
                            {loadingAvailability ? (
                                <>
                                    <Loader2 className="w-5 h-5 text-foreground-secondary animate-spin" />
                                    <span className="text-foreground-secondary text-sm">Đang kiểm tra...</span>
                                </>
                            ) : isPast ? (
                                <>
                                    <AlertCircle className="w-5 h-5 text-amber-500" />
                                    <span className="text-amber-400 text-sm">Khung giờ đã qua thời gian hiện tại, không thể đặt</span>
                                </>
                            ) : pricing && pricing.total === 0 && pricing.appliedRule === 'Chưa thiết lập giá' ? (
                                <>
                                    <AlertCircle className="w-5 h-5 text-red-500" />
                                    <span className="text-red-400 text-sm">Ngoài giờ hoạt động (chưa thiết lập giá)</span>
                                </>
                            ) : availability?.available ? (
                                <>
                                    <Check className="w-5 h-5 text-green-500" />
                                    <span className="text-green-400 text-sm">Khung giờ trống, có thể đặt</span>
                                </>
                            ) : (
                                <>
                                    <AlertCircle className="w-5 h-5 text-red-500" />
                                    <span className="text-red-400 text-sm">
                                        Khung giờ đã có người đặt
                                        {availability && availability.conflicts && availability.conflicts.length > 0 && (
                                            <span> ({availability.conflicts.filter(c => c.id !== 'past-slot').map(c => `${c.startTime}-${c.endTime}`).join(', ')})</span>
                                        )}
                                    </span>
                                </>
                            )}
                        </div>
                    )}

                    {/* Customer Selection */}
                    <div className="relative">
                        <div className="flex items-center justify-between mb-2">
                            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                                <User className="w-4 h-4 text-primary-500" />
                                Khách hàng (không bắt buộc)
                            </label>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowQuickNewCustomer(prev => !prev);
                                    setShowCustomerDropdown(false);
                                }}
                                className="text-xs font-semibold text-primary-500 hover:underline"
                            >
                                {showQuickNewCustomer ? 'Đóng tạo nhanh' : '+ Thêm khách mới nhanh'}
                            </button>
                        </div>

                        {showQuickNewCustomer ? (
                            <div className="p-3 bg-background-tertiary border border-border rounded-lg space-y-2.5">
                                <div className="grid grid-cols-2 gap-2">
                                    <input
                                        type="text"
                                        value={newCustomerName}
                                        onChange={(e) => setNewCustomerName(e.target.value)}
                                        placeholder="Tên khách hàng *"
                                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500"
                                    />
                                    <input
                                        type="tel"
                                        value={newCustomerPhone}
                                        onChange={(e) => setNewCustomerPhone(e.target.value)}
                                        placeholder="Số điện thoại *"
                                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500"
                                    />
                                </div>
                                {errors.customer && (
                                    <p className="text-red-400 text-xs">{errors.customer}</p>
                                )}
                                <div className="flex justify-end gap-2">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setShowQuickNewCustomer(false)}
                                    >
                                        Hủy
                                    </Button>
                                    <Button
                                        type="button"
                                        size="sm"
                                        disabled={isCreatingCustomer}
                                        onClick={handleQuickCreateCustomer}
                                    >
                                        {isCreatingCustomer ? 'Đang lưu...' : 'Lưu & Chọn khách'}
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <input
                                    type="text"
                                    value={customerSearch}
                                    onChange={(e) => {
                                        setCustomerSearch(e.target.value);
                                        setShowCustomerDropdown(true);
                                        if (!e.target.value) {
                                            setSelectedCustomer(null);
                                            setFormData(prev => ({ ...prev, customerId: '' }));
                                        }
                                    }}
                                    onFocus={() => setShowCustomerDropdown(true)}
                                    placeholder="Tìm theo tên hoặc số điện thoại..."
                                    className="w-full bg-background-tertiary border border-border rounded-lg px-3 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500"
                                />

                                {/* Customer Dropdown */}
                                {showCustomerDropdown && customerSearch && (
                                    <div className="absolute z-10 w-full mt-1 bg-background-tertiary border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                        {filteredCustomers.length === 0 ? (
                                            <div className="p-3 text-center text-foreground-secondary text-sm space-y-2">
                                                <p>Không tìm thấy khách hàng</p>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const isPhone = /^[0-9+\s]{8,15}$/.test(customerSearch.trim());
                                                        if (isPhone) {
                                                            setNewCustomerPhone(customerSearch.trim());
                                                        } else {
                                                            setNewCustomerName(customerSearch.trim());
                                                        }
                                                        setShowQuickNewCustomer(true);
                                                        setShowCustomerDropdown(false);
                                                    }}
                                                    className="text-xs font-semibold text-primary-500 hover:underline"
                                                >
                                                    + Tạo khách mới với "{customerSearch}"
                                                </button>
                                            </div>
                                        ) : (
                                            filteredCustomers.slice(0, 5).map(customer => (
                                                <button
                                                    key={customer.id}
                                                    type="button"
                                                    onClick={() => selectCustomer(customer)}
                                                    className="w-full flex items-center gap-3 p-3 hover:bg-background transition-colors text-left"
                                                >
                                                    <div className="w-8 h-8 rounded-full bg-primary-500/20 flex items-center justify-center text-primary-500 font-medium">
                                                        {customer.name.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-medium text-foreground">{customer.name}</p>
                                                        <p className="text-xs text-foreground-secondary">{customer.phone}</p>
                                                    </div>
                                                    {customer.membershipTier && (
                                                        <span className={cn(
                                                            "ml-auto text-xs px-2 py-0.5 rounded",
                                                            customer.membershipTier === 'GOLD' && 'bg-yellow-500/20 text-yellow-400',
                                                            customer.membershipTier === 'SILVER' && 'bg-gray-400/20 text-gray-300',
                                                            customer.membershipTier === 'PLATINUM' && 'bg-purple-500/20 text-purple-400',
                                                            customer.membershipTier === 'BRONZE' && 'bg-orange-500/20 text-orange-400',
                                                        )}>
                                                            {customer.membershipTier}
                                                        </span>
                                                    )}
                                                </button>
                                            ))
                                        )}
                                    </div>
                                )}
                            </>
                        )}

                        {selectedCustomer && (
                            <div className="mt-2 flex items-center gap-2 text-sm text-primary-400">
                                <Check className="w-4 h-4" />
                                Đã chọn: {selectedCustomer.name} ({selectedCustomer.phone})
                            </div>
                        )}
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="flex items-center gap-2 text-sm font-medium text-foreground mb-2">
                            <FileText className="w-4 h-4 text-primary-500" />
                            Ghi chú
                        </label>
                        <textarea
                            value={formData.notes}
                            onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                            placeholder="Ghi chú thêm về lịch đặt..."
                            rows={3}
                            className="w-full bg-background-tertiary border border-border rounded-lg px-3 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                        />
                    </div>

                    {/* Pricing Summary */}
                    {pricing && (
                        <div className="p-4 rounded-lg bg-gradient-to-r from-primary-500/10 to-cyan-500/10 border border-primary-500/30">
                            <div className="flex justify-between items-center">
                                <span className="text-foreground-secondary">Thời lượng:</span>
                                <span className="font-medium text-foreground">{pricing.duration} giờ</span>
                            </div>
                            <div className="flex justify-between items-center mt-2">
                                <span className="text-foreground-secondary">Giá/giờ:</span>
                                <span className="font-medium text-foreground">
                                    {new Intl.NumberFormat('vi-VN').format(pricing.pricePerHour)} đ
                                </span>
                            </div>
                            {pricing.appliedRule && (
                                <div className="flex justify-between items-center mt-2">
                                    <span className="text-foreground-secondary">Áp dụng:</span>
                                    <span className="text-sm text-primary-400">{pricing.appliedRule}</span>
                                </div>
                            )}

                            {/* Voucher Input */}
                            <div className="mt-4 flex gap-2">
                                <input
                                    type="text"
                                    placeholder="Nhập mã giảm giá..."
                                    value={voucherCode}
                                    onChange={(e) => {
                                        setVoucherCode(e.target.value.toUpperCase());
                                        if (voucherValid) {
                                            setVoucherValid(false);
                                            setDiscountAmount(0);
                                            setVoucherMessage('');
                                        }
                                    }}
                                    className="flex-1 bg-background border border-border rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:border-primary-500 uppercase"
                                />
                                <Button 
                                    type="button"
                                    size="sm"
                                    onClick={handleApplyVoucher}
                                    disabled={!voucherCode || isApplyingVoucher}
                                >
                                    {isApplyingVoucher ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Áp dụng'}
                                </Button>
                            </div>
                            {voucherMessage && (
                                <p className={`text-xs mt-1 ${voucherValid ? 'text-green-500' : 'text-red-500'}`}>
                                    {voucherMessage}
                                </p>
                            )}

                            {voucherValid && discountAmount > 0 && (
                                <div className="flex justify-between items-center mt-2 text-green-500">
                                    <span>Giảm giá:</span>
                                    <span>-{new Intl.NumberFormat('vi-VN').format(discountAmount)} đ</span>
                                </div>
                            )}

                            <div className="flex justify-between items-center mt-3 pt-3 border-t border-border">
                                <span className="font-semibold text-foreground">Tổng cộng:</span>
                                <span className="text-xl font-bold text-primary-400">
                                    {new Intl.NumberFormat('vi-VN').format(Math.max(0, pricing.total - discountAmount))} đ
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Error Message */}
                    {errors.submit && (
                        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center gap-2 text-red-400 text-sm">
                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                            {errors.submit}
                        </div>
                    )}
                </form>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-4 border-t border-border bg-background-tertiary">
                    <Button variant="ghost" onClick={onClose}>
                        Hủy
                    </Button>
                    <Button
                        type="submit"
                        onClick={handleSubmit}
                        disabled={isSubmitting || loadingAvailability || isLoadingPrice || isPast || (availability !== null && !availability.available)}
                        className="gap-2"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Đang tạo...
                            </>
                        ) : (
                            <>
                                <Check className="w-4 h-4" />
                                Đặt sân
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}

export default NewBookingModal;
