import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Settings,
    Building2,
    Clock,
    DollarSign,
    Bell,
    Shield,
    Save,
    Plus,
    Trash2,
    Edit2,
    X,
    MapPin,
    Phone,
    Mail,
    Loader2,
    Ticket
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Input } from '@/components/ui/input';
import { venueApi, Venue } from '@/services/venue.service';
import { pricingRuleApi, PricingRule } from '@/services/inventory.service';
import { operatingHourApi, OperatingHour } from '@/services/operating-hour.service';
import { voucherApi, Voucher } from '@/services/voucher.service';
import { useToast } from '@/hooks/use-toast';

interface TabProps {
    active: boolean;
    icon: React.ElementType;
    label: string;
    onClick: () => void;
}

const dayOfWeekLabels: Record<string, string> = {
    MONDAY: 'Thứ Hai',
    TUESDAY: 'Thứ Ba',
    WEDNESDAY: 'Thứ Tư',
    THURSDAY: 'Thứ Năm',
    FRIDAY: 'Thứ Sáu',
    SATURDAY: 'Thứ Bảy',
    SUNDAY: 'Chủ Nhật',
};
const allDaysLabel = Object.values(dayOfWeekLabels).join(', ');
const notificationSettings = [
    { key: 'setting_notify_new_booking', label: 'Thông báo khi có đặt sân mới', defaultEnabled: true },
    { key: 'setting_notify_booking_cancelled', label: 'Thông báo khi khách hủy sân', defaultEnabled: true },
    { key: 'setting_notify_booking_reminder', label: 'Nhắc nhở trước giờ đặt sân', defaultEnabled: false },
    { key: 'setting_notify_daily_report', label: 'Báo cáo doanh thu hàng ngày', defaultEnabled: true },
    { key: 'setting_notify_email_marketing', label: 'Email marketing cho khách hàng', defaultEnabled: false },
] as const;

function getNotificationSettings() {
    return Object.fromEntries(
        notificationSettings.map(({ key, defaultEnabled }) => [
            key,
            localStorage.getItem(key) === null ? defaultEnabled : localStorage.getItem(key) === 'true',
        ])
    ) as Record<(typeof notificationSettings)[number]['key'], boolean>;
}

function Tab({ active, icon: Icon, label, onClick }: TabProps) {
    return (
        <button
            onClick={onClick}
            className={cn(
                'flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors w-full text-left rounded-lg',
                active
                    ? 'bg-primary-500/20 text-primary-500'
                    : 'text-foreground-secondary hover:bg-background-hover hover:text-foreground'
            )}
        >
            <Icon className="w-4 h-4" />
            {label}
        </button>
    );
}

// Venue Form Modal
interface VenueFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    venue?: Venue | null;
    onSave: (data: Partial<Venue>) => Promise<void>;
}

function VenueFormModal({ isOpen, onClose, venue, onSave }: VenueFormModalProps) {
    const [formData, setFormData] = useState({
        name: venue?.name || '',
        address: venue?.address || '',
        phone: venue?.phone || '',
        email: venue?.email || '',
        openTime: venue?.openTime || '06:00',
        closeTime: venue?.closeTime || '23:00',
    });
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setFormData({
                name: venue?.name || '',
                address: venue?.address || '',
                phone: venue?.phone || '',
                email: venue?.email || '',
                openTime: venue?.openTime || '06:00',
                closeTime: venue?.closeTime || '23:00',
            });
            setIsSaving(false);
        }
    }, [venue, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            await onSave(formData);
            onClose();
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <>
            <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            <div className="fixed inset-x-4 top-[10%] z-50 mx-auto max-w-lg animate-scaleIn">
                <div className="bg-background-secondary rounded-2xl border border-border shadow-2xl overflow-hidden">
                    <div className="flex items-center justify-between p-4 border-b border-border">
                        <h2 className="font-semibold text-foreground">
                            {venue ? 'Sửa thông tin cơ sở' : 'Thêm cơ sở mới'}
                        </h2>
                        <button onClick={onClose} className="p-2 hover:bg-background-tertiary rounded-lg">
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="p-4 space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-foreground mb-1">
                                Tên cơ sở *
                            </label>
                            <Input
                                value={formData.name}
                                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                placeholder="Sân cầu lông ABC"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-foreground mb-1">
                                Địa chỉ *
                            </label>
                            <Input
                                value={formData.address}
                                onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                                placeholder="123 Đường XYZ, Quận 1, TP.HCM"
                                required
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">
                                    Số điện thoại
                                </label>
                                <Input
                                    value={formData.phone}
                                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                                    placeholder="0912345678"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">
                                    Email
                                </label>
                                <Input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                                    placeholder="contact@example.com"
                                />
                            </div>
                        </div>

                        

                        <div className="flex gap-3 pt-4 border-t border-border">
                            <Button variant="ghost" type="button" className="flex-1" onClick={onClose}>
                                Hủy
                            </Button>
                            <Button type="submit" className="flex-1 gap-2" disabled={isSaving}>
                                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                {venue ? 'Cập nhật' : 'Thêm mới'}
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </>
    );
}


const getOperatingStatus = (venue: any) => {
    if (!venue.operatingHours || venue.operatingHours.length === 0) {
        return { text: "Chưa cập nhật giờ", isOpen: false };
    }
    let minH = 24, minM = 59;
    let maxH = 0, maxM = 0;
    
    venue.operatingHours.forEach((oh: any) => {
        const [sH, sM] = oh.startTime.split(':').map(Number);
        const [eH, eM] = oh.endTime.split(':').map(Number);
        
        if (sH < minH || (sH === minH && sM < minM)) { minH = sH; minM = sM; }
        if (eH > maxH || (eH === maxH && eM > maxM)) { maxH = eH; maxM = eM; }
    });
    
    const pad = (n: number) => n.toString().padStart(2, '0');
    return {
        text: `${pad(minH)}:${pad(minM)} - ${pad(maxH)}:${pad(maxM)}`,
        isOpen: true
    };
};

export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState('venue');
    const [notificationPreferences, setNotificationPreferences] = useState(getNotificationSettings);
    const [isVenueModalOpen, setIsVenueModalOpen] = useState(false);
    const [editingVenue, setEditingVenue] = useState<Venue | null>(null);
    const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);
    const [editingPricingRule, setEditingPricingRule] = useState<PricingRule | null>(null);
    
    const [isOperatingHourModalOpen, setIsOperatingHourModalOpen] = useState(false);
    const [editingOperatingHour, setEditingOperatingHour] = useState<OperatingHour | null>(null);
    const [operatingHourForm, setOperatingHourForm] = useState({
        venueId: '',
        startTime: '06:00',
        endTime: '23:00',
        daysOfWeek: '[1,2,3,4,5,6,0]', // Default all days
    });

    
    const [deletingVenue, setDeletingVenue] = useState<Venue | null>(null);
    const [deletingPricingRule, setDeletingPricingRule] = useState<PricingRule | null>(null);
    const [deletingOperatingHourId, setDeletingOperatingHourId] = useState<string | null>(null);
    const [deletingVoucherId, setDeletingVoucherId] = useState<string | null>(null);

    const [isVoucherModalOpen, setIsVoucherModalOpen] = useState(false);
    const [editingVoucher, setEditingVoucher] = useState<Voucher | null>(null);
    const [voucherForm, setVoucherForm] = useState<Partial<Voucher>>({
        code: '',
        discountType: 'PERCENTAGE',
        discountValue: 0,
        minOrderValue: 0,
        maxDiscount: 0,
        usageLimit: 0,
        isActive: true,
    });

    const [pricingForm, setPricingForm] = useState({
        venueId: '',
        name: '',
        description: '',
        dayOfWeek: '',
        startTime: '',
        endTime: '',
        pricePerHour: 150000,
        priority: 0,
    });
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const updateNotificationPreference = (key: (typeof notificationSettings)[number]['key'], enabled: boolean) => {
        localStorage.setItem(key, String(enabled));
        setNotificationPreferences((current) => ({ ...current, [key]: enabled }));
        window.dispatchEvent(new Event('settings_changed'));
    };

    useEffect(() => {
        const syncNotificationPreferences = () => setNotificationPreferences(getNotificationSettings());
        window.addEventListener('storage', syncNotificationPreferences);
        return () => window.removeEventListener('storage', syncNotificationPreferences);
    }, []);

        // Fetch venues
    const { data: venuesData, isLoading: loadingVenues } = useQuery({
        queryKey: ['venues'],
        queryFn: () => venueApi.getAll({ isActive: true }),
    });

    const { data: pricingRulesData, isLoading: loadingPricingRules } = useQuery({
        queryKey: ['pricing-rules'],
        queryFn: () => pricingRuleApi.getAll({ isActive: true }),
    });

    const { data: operatingHoursData, isLoading: loadingOperatingHours } = useQuery({
        queryKey: ['operating-hours'],
        queryFn: () => operatingHourApi.getAll({ isActive: true }),
    });

    const { data: vouchersData, isLoading: loadingVouchers } = useQuery({
        queryKey: ['vouchers'],
        queryFn: () => voucherApi.getAll(),
        enabled: activeTab === 'vouchers',
    });

    const venues = venuesData?.data || [];
    const pricingRules = pricingRulesData?.data || [];
    const operatingHours = operatingHoursData?.data || [];
    const vouchers = vouchersData || [];

    // Create/Update venue mutation
    const saveMutation = useMutation({
        mutationFn: async (data: Partial<Venue>) => {
            if (editingVenue) {
                return venueApi.update(editingVenue.id, data);
            } else {
                return venueApi.create(data as any);
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['venues'] });
            toast({
                title: 'Thành công',
                description: editingVenue ? 'Đã cập nhật thông tin cơ sở' : 'Đã thêm cơ sở mới',
                variant: 'success',
            });
            setEditingVenue(null);
        },
        onError: () => {
            toast({
                title: 'Lỗi',
                description: 'Không thể lưu thông tin. Vui lòng thử lại.',
                variant: 'error',
            });
        },
    });

    // Delete venue mutation
    const deleteMutation = useMutation({
        mutationFn: (id: string) => venueApi.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['venues'] });
            toast({
                title: 'Đã xóa',
                description: 'Đã xóa cơ sở thành công',
                variant: 'success',
            });
        },
    });

    const handleAddVenue = () => {
        setEditingVenue(null);
        setIsVenueModalOpen(true);
    };

    const handleEditVenue = (venue: Venue) => {
        setEditingVenue(venue);
        setIsVenueModalOpen(true);
    };

    const handleDeleteVenue = (venue: Venue) => {
        setDeletingVenue(venue);
    };

    const handleSaveVenue = async (data: Partial<Venue>) => {
        await saveMutation.mutateAsync(data);
    };

    const resetPricingForm = () => {
        const firstVenueId = venues[0]?.id || '';
        setPricingForm({
            venueId: firstVenueId,
            name: '',
            description: '',
            dayOfWeek: '',
            startTime: '',
            endTime: '',
            pricePerHour: 150000,
            priority: 0,
        });
    };

    const savePricingRule = async () => {
        if (!pricingForm.venueId || !pricingForm.name.trim()) {
            toast({
                title: 'Thiếu thông tin',
                description: 'Vui lòng chọn cơ sở và nhập tên khung giá',
                variant: 'error',
            });
            return;
        }

        const payload = {
            venueId: pricingForm.venueId,
            name: pricingForm.name.trim(),
            description: pricingForm.description.trim() || null,
            dayOfWeek: pricingForm.dayOfWeek || null,
            startTime: pricingForm.startTime || null,
            endTime: pricingForm.endTime || null,
            pricePerHour: Number(pricingForm.pricePerHour) || 0,
            priority: Number(pricingForm.priority) || 0,
        };

        try {
            if (editingPricingRule) {
                await pricingRuleApi.update(editingPricingRule.id, payload);
                toast({ title: 'Thành công', description: 'Đã cập nhật khung giá', variant: 'success' });
            } else {
                await pricingRuleApi.create(payload);
                toast({ title: 'Thành công', description: 'Đã thêm khung giá mới', variant: 'success' });
            }

            queryClient.invalidateQueries({ queryKey: ['pricing-rules'] });
            queryClient.invalidateQueries({ queryKey: ['venue'] });
            setEditingPricingRule(null);
            setIsPricingModalOpen(false);
            resetPricingForm();
        } catch (error: any) {
            toast({
                title: 'Không thể lưu khung giá',
                description: error?.response?.data?.message || 'Vui lòng kiểm tra thông tin và thử lại.',
                variant: 'error',
            });
        }
    };

    const removePricingRule = async (rule: PricingRule) => {
        setDeletingPricingRule(rule);
        try {
            if (false) await pricingRuleApi.delete(rule.id);
            queryClient.invalidateQueries({ queryKey: ['pricing-rules'] });
            queryClient.invalidateQueries({ queryKey: ['venue'] });
            toast({ title: 'Đã xóa', description: 'Đã xóa khung giá thành công', variant: 'success' });
        } catch {
            toast({ title: 'Lỗi', description: 'Không thể xóa khung giá', variant: 'error' });
        }
    };

    const openPricingModal = (rule?: PricingRule) => {
        if (rule) {
            setEditingPricingRule(rule);
            setPricingForm({
                venueId: rule.venueId,
                name: rule.name,
                description: rule.description || '',
                dayOfWeek: rule.dayOfWeek || '',
                startTime: rule.startTime || '',
                endTime: rule.endTime || '',
                pricePerHour: rule.pricePerHour,
                priority: rule.priority,
            });
        } else {
            setEditingPricingRule(null);
            resetPricingForm();
        }
        setIsPricingModalOpen(true);
    };

    const openOperatingHourModal = (oh?: OperatingHour) => {
        if (oh) {
            setEditingOperatingHour(oh);
            setOperatingHourForm({
                venueId: oh.venueId,
                startTime: oh.startTime,
                endTime: oh.endTime,
                daysOfWeek: oh.daysOfWeek,
            });
        } else {
            setEditingOperatingHour(null);
            setOperatingHourForm({
                venueId: venues[0]?.id || '',
                startTime: '06:00',
                endTime: '23:00',
                daysOfWeek: '[1,2,3,4,5,6,0]',
            });
        }
        setIsOperatingHourModalOpen(true);
    };

    const saveOperatingHour = async () => {
        if (!operatingHourForm.venueId || !operatingHourForm.startTime || !operatingHourForm.endTime) {
            toast({ title: 'Thiếu thông tin', variant: 'error' });
            return;
        }

        const payload = {
            venueId: operatingHourForm.venueId,
            startTime: operatingHourForm.startTime,
            endTime: operatingHourForm.endTime,
            daysOfWeek: operatingHourForm.daysOfWeek,
        };

        if (editingOperatingHour) {
            await operatingHourApi.update(editingOperatingHour.id, payload);
            toast({ title: 'Đã cập nhật khung giờ', variant: 'success' });
        } else {
            await operatingHourApi.create(payload);
            toast({ title: 'Đã thêm khung giờ', variant: 'success' });
        }
        setIsOperatingHourModalOpen(false);
        queryClient.invalidateQueries({ queryKey: ['operating-hours'] });
        queryClient.invalidateQueries({ queryKey: ['venues'] });
    };

    const deleteOperatingHour = async (id: string) => {
        setDeletingOperatingHourId(id);
        if (false) await operatingHourApi.delete(id);
        toast({ title: 'Đã xóa khung giờ', variant: 'success' });
        queryClient.invalidateQueries({ queryKey: ['operating-hours'] });
        queryClient.invalidateQueries({ queryKey: ['venues'] });
    };

    const openVoucherModal = (voucher?: Voucher) => {
        if (voucher) {
            setEditingVoucher(voucher);
            setVoucherForm({ ...voucher });
        } else {
            setEditingVoucher(null);
            setVoucherForm({
                code: '',
                discountType: 'PERCENTAGE',
                discountValue: 0,
                minOrderValue: 0,
                maxDiscount: 0,
                usageLimit: 0,
                isActive: true,
            });
        }
        setIsVoucherModalOpen(true);
    };

    const saveVoucher = async () => {
        if (!voucherForm.code || !voucherForm.discountValue) {
            toast({ title: 'Thiếu thông tin bắt buộc', variant: 'error' });
            return;
        }

        try {
            if (editingVoucher) {
                await voucherApi.update(editingVoucher.id, voucherForm);
                toast({ title: 'Đã cập nhật mã ưu đãi', variant: 'success' });
            } else {
                await voucherApi.create(voucherForm);
                toast({ title: 'Đã tạo mã ưu đãi', variant: 'success' });
            }
            setIsVoucherModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ['vouchers'] });
        } catch (error: any) {
            toast({ title: error?.response?.data?.message || 'Lỗi khi lưu mã ưu đãi', variant: 'error' });
        }
    };

    const deleteVoucher = async (id: string) => {
        setDeletingVoucherId(id);
        if (false) await voucherApi.delete(id);
        toast({ title: 'Đã xóa mã ưu đãi', variant: 'success' });
        queryClient.invalidateQueries({ queryKey: ['vouchers'] });
    };

    const tabs = [
        { id: 'venue', icon: Building2, label: 'Thông tin cơ sở' },
        { id: 'hours', icon: Clock, label: 'Giờ hoạt động' },
        { id: 'pricing', icon: DollarSign, label: 'Bảng giá' },
        { id: 'vouchers', icon: Ticket, label: 'Khuyến mãi' },
        { id: 'notifications', icon: Bell, label: 'Thông báo' },
        { id: 'security', icon: Shield, label: 'Bảo mật' },
    ];

    return (
        <div className="p-6">
            <div className="flex flex-col lg:flex-row gap-6">
                {/* Sidebar */}
                <div className="w-full lg:w-64 shrink-0">
                    <div className="bg-background-secondary border border-border rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-4 pb-4 border-b border-border">
                            <Settings className="w-5 h-5 text-primary-500" />
                            <h2 className="font-semibold text-foreground">Cài đặt</h2>
                        </div>
                        <div className="space-y-1">
                            {tabs.map((tab) => (
                                <Tab
                                    key={tab.id}
                                    active={activeTab === tab.id}
                                    icon={tab.icon}
                                    label={tab.label}
                                    onClick={() => setActiveTab(tab.id)}
                                />
                            ))}
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    {/* Venue Settings */}
                    {activeTab === 'venue' && (
                        <div className="bg-background-secondary border border-border rounded-xl p-6">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h3 className="text-lg font-semibold text-foreground">Thông tin cơ sở</h3>
                                    <p className="text-sm text-foreground-secondary">Quản lý các cơ sở sân cầu lông</p>
                                </div>
                                <Button onClick={handleAddVenue} className="gap-2">
                                    <Plus className="w-4 h-4" />
                                    Thêm cơ sở
                                </Button>
                            </div>

                            {loadingVenues ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
                                </div>
                            ) : venues.length === 0 ? (
                                <div className="text-center py-12">
                                    <Building2 className="w-12 h-12 mx-auto mb-4 text-foreground-muted opacity-50" />
                                    <p className="text-foreground-secondary mb-4">Chưa có cơ sở nào</p>
                                    <Button onClick={handleAddVenue} variant="outline" className="gap-2">
                                        <Plus className="w-4 h-4" />
                                        Thêm cơ sở đầu tiên
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {venues.map((venue: Venue) => (
                                        <div key={venue.id} className="border border-border rounded-xl p-5 hover:border-primary-500/30 transition-colors">
                                            <div className="flex justify-between items-start mb-4">
                                                <div>
                                                    <h4 className="font-semibold text-foreground text-lg">{venue.name}</h4>
                                                    <div className="flex items-center gap-1 text-sm text-foreground-secondary mt-1">
                                                        <MapPin className="w-3.5 h-3.5" />
                                                        {venue.address}
                                                    </div>
                                                    

                                                </div>
                                                <div className="flex gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleEditVenue(venue)}
                                                        className="gap-1.5"
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                        Sửa
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                                        onClick={() => handleDeleteVenue(venue)}
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                                                <div className="flex items-center gap-2">
                                                    <Phone className="w-4 h-4 text-foreground-muted" />
                                                    <span className="text-foreground">{venue.phone || 'Chưa cập nhật'}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Mail className="w-4 h-4 text-foreground-muted" />
                                                    <span className="text-foreground">{venue.email || 'Chưa cập nhật'}</span>
                                                </div>
                                                
                                                {(() => {
                                                    const status = getOperatingStatus(venue);
                                                    return (
                                                        <div className="flex items-center gap-2">
                                                            <Clock className="w-4 h-4 text-foreground-muted" />
                                                            <span className="text-foreground">{status.text}</span>
                                                        </div>
                                                    );
                                                })()}

                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Operating Hours */}
                    {activeTab === 'hours' && (
                        <div className="bg-background-secondary border border-border rounded-xl p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-lg font-semibold text-foreground">Giờ hoạt động</h3>
                                <Button className="gap-2" onClick={() => openOperatingHourModal()}>
                                    <Plus className="w-4 h-4" />
                                    Thêm khung giờ
                                </Button>
                            </div>

                            {loadingOperatingHours ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
                                </div>
                            ) : operatingHours.length === 0 ? (
                                <div className="text-center py-12">
                                    <Clock className="w-12 h-12 mx-auto mb-4 text-foreground-muted opacity-50" />
                                    <p className="text-foreground-secondary">Chưa có khung giờ hoạt động nào</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {operatingHours.map((oh: OperatingHour) => {
                                        let daysText = 'Tất cả các ngày';
                                        try {
                                            const days = JSON.parse(oh.daysOfWeek);
                                            if (days.length < 7) {
                                                const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
                                                daysText = days.map((d: number) => dayNames[d]).join(', ');
                                            }
                                        } catch(e) {}

                                        return (
                                            <div key={oh.id} className="flex flex-wrap items-center justify-between gap-4 p-4 bg-background-tertiary/50 border border-border rounded-xl hover:border-primary-500/30 transition-colors">
                                                <div>
                                                    <h4 className="font-semibold text-foreground mb-1">{oh.startTime} - {oh.endTime}</h4>
                                                    <div className="flex items-center gap-4 text-sm text-foreground-secondary">
                                                        <span className="flex items-center gap-1"><Building2 className="w-4 h-4" /> {venues.find((v: any) => v.id === oh.venueId)?.name}</span>
                                                        <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {daysText}</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Button variant="outline" size="sm" onClick={() => openOperatingHourModal(oh)}>
                                                        <Edit2 className="w-4 h-4" />
                                                    </Button>
                                                    <Button variant="destructive" size="sm" onClick={() => deleteOperatingHour(oh.id)}>
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Pricing */}
                    {activeTab === 'pricing' && (
                        <div className="bg-background-secondary border border-border rounded-xl p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-lg font-semibold text-foreground">Bảng giá</h3>
                                <Button className="gap-2" onClick={() => openPricingModal()}>
                                    <Plus className="w-4 h-4" />
                                    Thêm khung giá
                                </Button>
                            </div>

                            {loadingPricingRules ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
                                </div>
                            ) : pricingRules.length === 0 ? (
                                <div className="text-center py-12">
                                    <DollarSign className="w-12 h-12 mx-auto mb-4 text-foreground-muted opacity-50" />
                                    <p className="text-foreground-secondary">Chưa có khung giá nào</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {pricingRules.map((rule) => {
                                        const days = rule.dayOfWeek
                                            ? dayOfWeekLabels[rule.dayOfWeek] || rule.dayOfWeek
                                            : `Tất cả các ngày (${allDaysLabel})`;
                                        const timeRange = rule.startTime && rule.endTime
                                            ? `${rule.startTime} - ${rule.endTime}`
                                            : 'Tất cả khung giờ';

                                        return (
                                            <div key={rule.id} className="flex items-center justify-between p-4 border border-border rounded-xl">
                                                <div>
                                                    <h4 className="font-medium text-foreground">{rule.name}</h4>
                                                    <p className="text-sm text-foreground-secondary">{days} · {timeRange}</p>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <span className="font-semibold text-primary-500">{formatCurrency(rule.pricePerHour)}/giờ</span>
                                                    <Button variant="ghost" size="sm" onClick={() => openPricingModal(rule)}>
                                                        <Edit2 className="w-4 h-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="sm" className="text-red-400" onClick={() => removePricingRule(rule)}>
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Vouchers */}
                    {activeTab === 'vouchers' && (
                        <div className="bg-background-secondary border border-border rounded-xl p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-lg font-semibold text-foreground">Quản lý Mã khuyến mãi (Voucher)</h3>
                                <Button onClick={() => openVoucherModal()} className="bg-green-600 hover:bg-green-700 text-white gap-2">
                                    <Plus className="w-4 h-4" /> Thêm mã mới
                                </Button>
                            </div>
                            
                            <div className="space-y-4">
                                {loadingVouchers ? (
                                    <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-foreground-secondary" /></div>
                                ) : vouchers.length === 0 ? (
                                    <div className="p-8 text-center text-foreground-secondary border border-dashed border-border rounded-xl">
                                        Chưa có mã khuyến mãi nào
                                    </div>
                                ) : (
                                    vouchers.map(v => (
                                        <div key={v.id} className="flex flex-col sm:flex-row gap-4 p-4 border border-border rounded-xl bg-background hover:border-green-500 transition-colors">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-bold text-lg text-green-600 bg-green-50 px-2 rounded">{v.code}</span>
                                                    {!v.isActive && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">Đã tắt</span>}
                                                </div>
                                                <p className="text-sm font-semibold text-foreground mb-1">
                                                    Giảm {v.discountType === 'FIXED' ? formatCurrency(v.discountValue) : `${v.discountValue}%`}
                                                    {v.discountType === 'PERCENTAGE' && v.maxDiscount ? ` (tối đa ${formatCurrency(v.maxDiscount)})` : ''}
                                                </p>
                                                <p className="text-xs text-foreground-secondary">
                                                    {v.minOrderValue ? `Đơn tối thiểu ${formatCurrency(v.minOrderValue)}. ` : 'Không yêu cầu đơn tối thiểu. '}
                                                    {v.usageLimit ? `Đã dùng: ${v.usageCount}/${v.usageLimit}. ` : `Đã dùng: ${v.usageCount}. `}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Button variant="outline" size="sm" onClick={() => openVoucherModal(v)}>
                                                    <Edit2 className="w-4 h-4" />
                                                </Button>
                                                <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => deleteVoucher(v.id)}>
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {/* Notifications */}
                    {activeTab === 'notifications' && (
                        <div className="bg-background-secondary border border-border rounded-xl p-6">
                            <h3 className="text-lg font-semibold text-foreground mb-6">Thông báo</h3>
                            <p className="text-sm text-foreground-secondary mb-4">
                                Chuông báo trong ứng dụng hiện hiển thị yêu cầu đặt sân mới. Các loại thông báo khác chưa có luồng gửi tương ứng.
                            </p>
                            <div className="space-y-4">
                                {notificationSettings.map((setting) => (
                                    <div key={setting.key} className="flex items-center justify-between p-4 border border-border rounded-xl">
                                        <span className="text-foreground">{setting.label}</span>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={notificationPreferences[setting.key]}
                                                onChange={(event) => updateNotificationPreference(setting.key, event.target.checked)}
                                                className="sr-only peer"
                                            />
                                            <div className="w-11 h-6 bg-background-tertiary peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
                                        </label>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Security */}
                    {activeTab === 'security' && (
                        <div className="bg-background-secondary border border-border rounded-xl p-6">
                            <h3 className="text-lg font-semibold text-foreground mb-6">Bảo mật</h3>
                            <div className="space-y-6">
                                <div>
                                    <h4 className="font-medium text-foreground mb-4">Đổi mật khẩu</h4>
                                    <div className="space-y-4 max-w-md">
                                        <div>
                                            <label className="block text-sm text-foreground-secondary mb-1">Mật khẩu hiện tại</label>
                                            <Input type="password" placeholder="••••••••" />
                                        </div>
                                        <div>
                                            <label className="block text-sm text-foreground-secondary mb-1">Mật khẩu mới</label>
                                            <Input type="password" placeholder="••••••••" />
                                        </div>
                                        <div>
                                            <label className="block text-sm text-foreground-secondary mb-1">Xác nhận mật khẩu mới</label>
                                            <Input type="password" placeholder="••••••••" />
                                        </div>
                                        <Button className="gap-2">
                                            <Save className="w-4 h-4" />
                                            Cập nhật mật khẩu
                                        </Button>
                                    </div>
                                </div>

                                <div className="border-t border-border pt-6">
                                    <h4 className="font-medium text-foreground mb-4">Phiên đăng nhập</h4>
                                    <p className="text-sm text-foreground-secondary mb-4">
                                        Bạn đang đăng nhập từ 1 thiết bị. Nhấn nút bên dưới để đăng xuất khỏi tất cả thiết bị khác.
                                    </p>
                                    <Button variant="destructive">
                                        Đăng xuất tất cả thiết bị khác
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Venue Modal */}
            <VenueFormModal
                isOpen={isVenueModalOpen}
                onClose={() => {
                    setIsVenueModalOpen(false);
                    setEditingVenue(null);
                }}
                venue={editingVenue}
                onSave={handleSaveVenue}
            />

            {isOperatingHourModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="w-full max-w-xl rounded-2xl border border-border bg-background-secondary p-6 shadow-2xl">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-semibold text-foreground">
                                {editingOperatingHour ? 'Sửa khung giờ' : 'Thêm khung giờ'}
                            </h3>
                            <button onClick={() => { setIsOperatingHourModalOpen(false); setEditingOperatingHour(null); }} className="p-2 hover:bg-background-tertiary rounded-lg">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="space-y-4 max-h-[85vh] overflow-y-auto overscroll-contain touch-pan-y pr-2">
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">Cơ sở</label>
                                <select
                                    className="w-full bg-background-tertiary border border-border rounded-lg px-3 py-2 text-foreground"
                                    value={operatingHourForm.venueId}
                                    onChange={(e) => setOperatingHourForm(prev => ({ ...prev, venueId: e.target.value }))}
                                >
                                    {venues.map((venue: Venue) => (
                                        <option key={venue.id} value={venue.id}>{venue.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1">Từ giờ</label>
                                    <Input
                                        type="time"
                                        value={operatingHourForm.startTime}
                                        onChange={(e) => setOperatingHourForm(prev => ({ ...prev, startTime: e.target.value }))}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1">Đến giờ</label>
                                    <Input
                                        type="time"
                                        value={operatingHourForm.endTime}
                                        onChange={(e) => setOperatingHourForm(prev => ({ ...prev, endTime: e.target.value }))}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-2">Áp dụng cho ngày</label>
                                <div className="flex flex-wrap gap-2">
                                    {[1, 2, 3, 4, 5, 6, 0].map(day => {
                                        const labels = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
                                        let currentDays: number[] = [];
                                        try { currentDays = JSON.parse(operatingHourForm.daysOfWeek); } catch(e) {}
                                        const isSelected = currentDays.includes(day);

                                        return (
                                            <button
                                                key={day}
                                                className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${isSelected ? 'bg-primary border-primary text-primary-foreground' : 'bg-background-tertiary border-border text-foreground-secondary'}`}
                                                onClick={() => {
                                                    const newDays = isSelected ? currentDays.filter((d: number) => d !== day) : [...currentDays, day];
                                                    setOperatingHourForm(prev => ({ ...prev, daysOfWeek: JSON.stringify(newDays.sort()) }));
                                                }}
                                            >
                                                {labels[day]}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            <div className="flex justify-end gap-2 pt-4">
                                <Button variant="outline" onClick={() => { setIsOperatingHourModalOpen(false); setEditingOperatingHour(null); }}>Hủy</Button>
                                <Button onClick={saveOperatingHour}>Lưu</Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {isPricingModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="w-full max-w-xl rounded-2xl border border-border bg-background-secondary p-6 shadow-2xl">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-semibold text-foreground">
                                {editingPricingRule ? 'Sửa khung giá' : 'Thêm khung giá'}
                            </h3>
                            <button onClick={() => { setIsPricingModalOpen(false); setEditingPricingRule(null); }} className="p-2 hover:bg-background-tertiary rounded-lg">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">Cơ sở *</label>
                                <select
                                    value={pricingForm.venueId}
                                    onChange={(e) => setPricingForm(prev => ({ ...prev, venueId: e.target.value }))}
                                    className="w-full rounded-lg border border-border bg-background-tertiary px-3 py-2 text-foreground"
                                >
                                    <option value="">Chọn cơ sở</option>
                                    {venues.map((venue) => (
                                        <option key={venue.id} value={venue.id}>{venue.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">Tên khung giá *</label>
                                <Input
                                    value={pricingForm.name}
                                    onChange={(e) => setPricingForm(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="Giá mặc định"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">Mô tả</label>
                                <Input
                                    value={pricingForm.description}
                                    onChange={(e) => setPricingForm(prev => ({ ...prev, description: e.target.value }))}
                                    placeholder="Ví dụ: Áp dụng từ 17:00 đến 21:00"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1">Ngày trong tuần</label>
                                    <select
                                        value={pricingForm.dayOfWeek}
                                        onChange={(e) => setPricingForm(prev => ({ ...prev, dayOfWeek: e.target.value }))}
                                        className="w-full rounded-lg border border-border bg-background-tertiary px-3 py-2 text-foreground"
                                    >
                                        <option value="">Tất cả các ngày</option>
                                        <option value="MONDAY">Thứ Hai</option>
                                        <option value="TUESDAY">Thứ Ba</option>
                                        <option value="WEDNESDAY">Thứ Tư</option>
                                        <option value="THURSDAY">Thứ Năm</option>
                                        <option value="FRIDAY">Thứ Sáu</option>
                                        <option value="SATURDAY">Thứ Bảy</option>
                                        <option value="SUNDAY">Chủ Nhật</option>
                                    </select>
                                    <p className="mt-1 text-xs text-foreground-secondary">
                                        Áp dụng cho: {pricingForm.dayOfWeek ? dayOfWeekLabels[pricingForm.dayOfWeek] || pricingForm.dayOfWeek : allDaysLabel}
                                    </p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1">Ưu tiên</label>
                                    <Input
                                        type="number"
                                        value={pricingForm.priority}
                                        onChange={(e) => setPricingForm(prev => ({ ...prev, priority: Number(e.target.value) || 0 }))}
                                    />
                                    <p className="mt-1 text-xs text-foreground-secondary">
                                        Khi nhiều khung giá cùng khớp, số lớn hơn được áp dụng trước.
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1">Giờ bắt đầu</label>
                                    <Input
                                        type="time"
                                        value={pricingForm.startTime}
                                        onChange={(e) => setPricingForm(prev => ({ ...prev, startTime: e.target.value }))}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1">Giờ kết thúc</label>
                                    <Input
                                        type="time"
                                        value={pricingForm.endTime}
                                        onChange={(e) => setPricingForm(prev => ({ ...prev, endTime: e.target.value }))}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">Giá / giờ</label>
                                <Input
                                    type="number"
                                    value={pricingForm.pricePerHour}
                                    onChange={(e) => setPricingForm(prev => ({ ...prev, pricePerHour: Number(e.target.value) || 0 }))}
                                />
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-border">
                                <Button variant="ghost" onClick={() => setIsPricingModalOpen(false)}>Hủy</Button>
                                <Button onClick={savePricingRule}>{editingPricingRule ? 'Cập nhật' : 'Thêm mới'}</Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {isVoucherModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50">
                    <div className="bg-background-secondary rounded-2xl w-full max-w-md overflow-hidden">
                        <div className="flex items-center justify-between p-4 border-b border-border">
                            <h3 className="text-lg font-bold text-foreground">{editingVoucher ? 'Sửa mã ưu đãi' : 'Thêm mã ưu đãi'}</h3>
                            <button onClick={() => setIsVoucherModalOpen(false)} className="p-2 hover:bg-background rounded-full transition-colors">
                                <X className="w-5 h-5 text-foreground-secondary" />
                            </button>
                        </div>
                        <div className="p-4 space-y-4 max-h-[85vh] overflow-y-auto overscroll-contain touch-pan-y">
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">Mã (Code)</label>
                                <Input
                                    value={voucherForm.code}
                                    onChange={(e) => setVoucherForm(prev => ({ ...prev, code: e.target.value.toUpperCase().replace(/\s/g, '') }))}
                                    placeholder="VD: SUMMER20"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">Loại giảm giá</label>
                                <select 
                                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                                    value={voucherForm.discountType}
                                    onChange={(e) => setVoucherForm(prev => ({ ...prev, discountType: e.target.value as 'PERCENTAGE' | 'FIXED' }))}
                                >
                                    <option value="PERCENTAGE">Theo phần trăm (%)</option>
                                    <option value="FIXED">Số tiền cố định (VNĐ)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">
                                    {voucherForm.discountType === 'PERCENTAGE' ? 'Phần trăm giảm (%)' : 'Số tiền giảm (VNĐ)'}
                                </label>
                                <Input
                                    type="number"
                                    value={voucherForm.discountValue || ''}
                                    onChange={(e) => setVoucherForm(prev => ({ ...prev, discountValue: Number(e.target.value) }))}
                                />
                            </div>
                            {voucherForm.discountType === 'PERCENTAGE' && (
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1">Giảm tối đa (VNĐ)</label>
                                    <Input
                                        type="number"
                                        placeholder="Để trống nếu không giới hạn"
                                        value={voucherForm.maxDiscount || ''}
                                        onChange={(e) => setVoucherForm(prev => ({ ...prev, maxDiscount: Number(e.target.value) || undefined }))}
                                    />
                                </div>
                            )}
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">Đơn tối thiểu (VNĐ)</label>
                                <Input
                                    type="number"
                                    placeholder="Để trống nếu không yêu cầu"
                                    value={voucherForm.minOrderValue || ''}
                                    onChange={(e) => setVoucherForm(prev => ({ ...prev, minOrderValue: Number(e.target.value) || undefined }))}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">Số lượt dùng tối đa</label>
                                <Input
                                    type="number"
                                    placeholder="Để trống nếu không giới hạn"
                                    value={voucherForm.usageLimit || ''}
                                    onChange={(e) => setVoucherForm(prev => ({ ...prev, usageLimit: Number(e.target.value) || undefined }))}
                                />
                            </div>
                            <div className="flex items-center gap-2 pt-2">
                                <input 
                                    type="checkbox" 
                                    id="isActive"
                                    checked={voucherForm.isActive} 
                                    onChange={(e) => setVoucherForm(prev => ({ ...prev, isActive: e.target.checked }))} 
                                />
                                <label htmlFor="isActive" className="text-sm font-medium text-foreground cursor-pointer">Kích hoạt mã này</label>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-border">
                                <Button variant="ghost" onClick={() => setIsVoucherModalOpen(false)}>Hủy</Button>
                                <Button onClick={saveVoucher}>{editingVoucher ? 'Cập nhật' : 'Thêm mới'}</Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmModal isOpen={!!deletingVenue} onClose={() => setDeletingVenue(null)} onConfirm={() => deletingVenue && deleteMutation.mutate(deletingVenue.id)} title="Xóa cơ sở" description={`Bạn có chắc chắn muốn xóa "${deletingVenue?.name}"?`} confirmText="Xóa vĩnh viễn" />
            <ConfirmModal isOpen={!!deletingPricingRule} onClose={() => setDeletingPricingRule(null)} onConfirm={() => deletingPricingRule && (async () => { try { await pricingRuleApi.delete(deletingPricingRule.id); queryClient.invalidateQueries({ queryKey: ['pricing-rules'] }); toast({ title: 'Đã xóa bảng giá', variant: 'success' }); } catch(e) {} setDeletingPricingRule(null); })()} title="Xóa bảng giá" description={`Bạn có chắc chắn muốn xóa "${deletingPricingRule?.name}"?`} confirmText="Xóa vĩnh viễn" />
            <ConfirmModal isOpen={!!deletingOperatingHourId} onClose={() => setDeletingOperatingHourId(null)} onConfirm={() => deletingOperatingHourId && (async () => { try { await operatingHourApi.delete(deletingOperatingHourId); queryClient.invalidateQueries({ queryKey: ['operating-hours'] }); queryClient.invalidateQueries({ queryKey: ['venues'] });
        queryClient.invalidateQueries({ queryKey: ['venues'] }); toast({ title: 'Đã xóa khung giờ', variant: 'success' }); } catch(e) {} setDeletingOperatingHourId(null); })()} title="Xóa khung giờ" description="Bạn có chắc chắn muốn xóa khung giờ này?" confirmText="Xóa vĩnh viễn" />
            <ConfirmModal isOpen={!!deletingVoucherId} onClose={() => setDeletingVoucherId(null)} onConfirm={() => deletingVoucherId && (async () => { try { await voucherApi.delete(deletingVoucherId); queryClient.invalidateQueries({ queryKey: ['vouchers'] }); toast({ title: 'Đã xóa mã ưu đãi', variant: 'success' }); } catch(e) {} setDeletingVoucherId(null); })()} title="Xóa mã ưu đãi" description="Bạn có chắc chắn muốn xóa mã này?" confirmText="Xóa vĩnh viễn" />

        </div>
    );
}
