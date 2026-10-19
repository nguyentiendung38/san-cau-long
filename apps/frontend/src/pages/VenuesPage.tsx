import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Plus,
    Building2,
    Clock,
    MapPin,
    Phone,
    Pencil,
    Power,
    X,
    Check,
    AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { venueApi, Venue, CreateVenueInput } from '@/services/venue.service';
import { useToast } from '@/hooks/use-toast';

interface VenueFormData {
    name: string;
    address: string;
    phone: string;
    termsAndServices: string;
    bankCode: string;
    bankAccountNumber: string;
    bankAccountName: string;
    logo: string;
    images: string[];
    openTime: string;
    closeTime: string;
}

const defaultFormData: VenueFormData = {
    name: '',
    address: '',
    phone: '',
    termsAndServices: '',
    bankCode: '',
    bankAccountNumber: '',
    bankAccountName: '',
    logo: '',
    images: [],
    openTime: '06:00',
    closeTime: '23:00',
};

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
    
    const now = new Date();
    const currH = now.getHours();
    const currM = now.getMinutes();
    
    const startMins = minH * 60 + minM;
    const endMins = maxH * 60 + maxM;
    const currMins = currH * 60 + currM;
    
    const isOpen = currMins >= startMins && currMins <= endMins;
    
    const pad = (n: number) => n.toString().padStart(2, '0');
    return {
        text: `${pad(minH)}:${pad(minM)} - ${pad(maxH)}:${pad(maxM)}`,
        isOpen
    };
};

const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const MAX_SIZE = 1000;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_SIZE) {
                        height = Math.round((height * MAX_SIZE) / width);
                        width = MAX_SIZE;
                    }
                } else {
                    if (height > MAX_SIZE) {
                        width = Math.round((width * MAX_SIZE) / height);
                        height = MAX_SIZE;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    resolve(e.target?.result as string);
                    return;
                }
                ctx.drawImage(img, 0, 0, width, height);
                // Nén sang JPEG chất lượng 0.8 (~50KB-80KB)
                resolve(canvas.toDataURL('image/jpeg', 0.8));
            };
            img.onerror = () => resolve(e.target?.result as string);
            img.src = e.target?.result as string;
        };
        reader.onerror = () => resolve('');
        reader.readAsDataURL(file);
    });
};

export default function VenuesPage() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [showModal, setShowModal] = useState(false);
    const [editingVenue, setEditingVenue] = useState<Venue | null>(null);
    const [formData, setFormData] = useState<VenueFormData>(defaultFormData);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

    // Fetch venues
    const { data: venuesData, isLoading } = useQuery({
        queryKey: ['venues'],
        queryFn: () => venueApi.getAll({}),
    });

    // Create mutation
    const createMutation = useMutation({
        mutationFn: (data: CreateVenueInput) => venueApi.create(data),
        onSuccess: () => {
            toast({ title: 'Đã tạo cơ sở mới!' });
            queryClient.invalidateQueries({ queryKey: ['venues'] });
            handleCloseModal();
        },
        onError: () => {
            toast({ title: 'Lỗi khi tạo cơ sở', variant: 'error' });
        },
    });

    // Update mutation
    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<CreateVenueInput> }) =>
            venueApi.update(id, data),
        onSuccess: () => {
            toast({ title: 'Đã cập nhật cơ sở!' });
            queryClient.invalidateQueries({ queryKey: ['venues'] });
            handleCloseModal();
        },
        onError: () => {
            toast({ title: 'Lỗi khi cập nhật cơ sở', variant: 'error' });
        },
    });

    // Archive or restore a venue without deleting its operational history.
    const activeMutation = useMutation({
        mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
            venueApi.update(id, { isActive }),
        onSuccess: (_, variables) => {
            toast({ title: variables.isActive ? 'Đã kích hoạt lại cơ sở' : 'Đã lưu trữ cơ sở' });
            queryClient.invalidateQueries({ queryKey: ['venues'] });
            setDeleteConfirm(null);
        },
        onError: () => {
            toast({ title: 'Không thể cập nhật trạng thái cơ sở', variant: 'error' });
        },
    });

    const handleOpenModal = (venue?: Venue) => {
        if (venue) {
            setEditingVenue(venue);
            setFormData({
                name: venue.name,
                address: venue.address,
                phone: venue.phone || '',
                termsAndServices: venue.termsAndServices || '',
                bankCode: venue.bankCode || '',
                bankAccountNumber: venue.bankAccountNumber || '',
                bankAccountName: venue.bankAccountName || '',
                logo: venue.logo || '',
                images: Array.isArray(venue.images) ? venue.images : (typeof venue.images === 'string' ? (() => { try { const p = JSON.parse(venue.images); return Array.isArray(p) ? p : [venue.images]; } catch { return [venue.images]; } })() : []),
                openTime: venue.openTime,
                closeTime: venue.closeTime,
            });
        } else {
            setEditingVenue(null);
            setFormData(defaultFormData);
        }
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setEditingVenue(null);
        setFormData(defaultFormData);
    };

    const handleRemoveGalleryImage = (indexToRemove: number) => {
        setFormData((prev) => ({
            ...prev,
            images: prev.images.filter((_, idx) => idx !== indexToRemove),
        }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.name.trim()) {
            toast({ title: 'Vui lòng nhập tên cơ sở', variant: 'error' });
            return;
        }

        if (!formData.address.trim()) {
            toast({ title: 'Vui lòng nhập địa chỉ', variant: 'error' });
            return;
        }
        const hasBankDetails = [formData.bankCode, formData.bankAccountNumber, formData.bankAccountName]
            .some((value) => value.trim());
        if (hasBankDetails && [formData.bankCode, formData.bankAccountNumber, formData.bankAccountName]
            .some((value) => !value.trim())) {
            toast({ title: 'Vui lòng nhập đầy đủ ngân hàng, số tài khoản và tên chủ tài khoản', variant: 'error' });
            return;
        }

        const data: CreateVenueInput = {
            name: formData.name.trim(),
            address: formData.address.trim(),
            phone: formData.phone.trim() || undefined,
            termsAndServices: formData.termsAndServices.trim() || undefined,
            bankCode: formData.bankCode.trim().toUpperCase() || null,
            bankAccountNumber: formData.bankAccountNumber.trim() || null,
            bankAccountName: formData.bankAccountName.trim().toUpperCase() || null,
            logo: formData.logo.trim() || undefined,
            images: formData.images,
            openTime: formData.openTime,
            closeTime: formData.closeTime,
        };

        if (editingVenue) {
            updateMutation.mutate({ id: editingVenue.id, data });
        } else {
            createMutation.mutate(data);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Quản lý cơ sở</h1>
                    <p className="text-foreground-secondary">Quản lý các cơ sở, chi nhánh của bạn</p>
                </div>
                <Button onClick={() => handleOpenModal()}>
                    <Plus className="w-4 h-4 mr-2" />
                    Thêm cơ sở mới
                </Button>
            </div>

            {/* Venues Grid */}
            {isLoading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
                </div>
            ) : venuesData?.data.length === 0 ? (
                <div className="bg-background-secondary rounded-xl border border-border p-12 text-center">
                    <Building2 className="w-12 h-12 text-foreground-muted mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-foreground mb-2">Chưa có cơ sở nào</h3>
                    <p className="text-foreground-secondary mb-4">Tạo cơ sở đầu tiên để bắt đầu quản lý</p>
                    
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {venuesData?.data.map((venue: Venue) => (
                        <div
                            key={venue.id}
                            className={`bg-background-secondary rounded-xl border border-border p-4 hover:border-primary-500/50 transition-colors ${venue.isActive ? '' : 'opacity-75'}`}
                        >
                            {/* Venue Header */}
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 bg-primary-500/20 rounded-xl flex items-center justify-center">
                                        <Building2 className="w-6 h-6 text-primary-500" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-foreground">{venue.name}</h3>
                                        <div className="text-xs text-foreground-muted mt-0.5">{venue._count?.courts || 0} Sân</div>
                                        {!venue.isActive && <div className="text-xs text-amber-500 mt-1">Đã lưu trữ</div>}
                                        
                                    </div>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => handleOpenModal(venue)}
                                        className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                        title="Chỉnh sửa"
                                    >
                                        <Pencil className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => venue.isActive
                                            ? setDeleteConfirm(venue.id)
                                            : activeMutation.mutate({ id: venue.id, isActive: true })}
                                        className={`p-2 rounded-lg transition-colors ${venue.isActive ? 'text-gray-500 hover:text-red-600 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'}`}
                                        title={venue.isActive ? 'Ngừng hoạt động' : 'Kích hoạt lại'}
                                    >
                                        <Power className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Venue Info */}
                            <div className="space-y-3 text-sm">
                                <div className="flex items-start gap-2">
                                    <MapPin className="w-4 h-4 text-foreground-muted mt-0.5" />
                                    <span className="text-foreground-secondary">{venue.address}</span>
                                </div>
                                {venue.phone && (
                                    <div className="flex items-center gap-2">
                                        <Phone className="w-4 h-4 text-foreground-muted" />
                                        <span className="text-foreground-secondary">{venue.phone}</span>
                                    </div>
                                )}
                                
                                {(() => {
                                    const status = getOperatingStatus(venue);
                                    return (
                                        <div className="flex items-center gap-2">
                                            <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${status.isOpen ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                                <div className={`w-1.5 h-1.5 rounded-full ${status.isOpen ? 'bg-green-400' : 'bg-red-400'}`} />
                                                {status.isOpen ? 'Đang mở cửa' : 'Đóng cửa'}
                                            </div>
                                            <div className="flex items-center gap-1 text-foreground-muted">
                                                <Clock className="w-4 h-4" />
                                                <span>{venue.isActive ? status.text : 'Đang ngừng hoạt động'}</span>
                                            </div>
                                        </div>
                                    );
                                })()}

                            </div>

                            

                            {/* Delete Confirmation */}
                            {deleteConfirm === venue.id && (
                                <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                                    <div className="flex items-center gap-2 text-amber-500 mb-2">
                                        <AlertCircle className="w-4 h-4" />
                                        <span className="text-sm font-medium">Ngừng hoạt động cơ sở?</span>
                                    </div>
                                    <p className="text-sm text-foreground-secondary mb-3">
                                        Cơ sở sẽ không nhận đặt mới. Lịch đặt và hóa đơn hiện có vẫn được giữ lại; bạn có thể kích hoạt lại sau.
                                    </p>
                                    <div className="flex gap-2">
                                        <Button
                                            size="sm"
                                            variant="secondary"
                                            onClick={() => setDeleteConfirm(null)}
                                        >
                                            Hủy
                                        </Button>
                                        <Button
                                            size="sm"
                                            onClick={() => activeMutation.mutate({ id: venue.id, isActive: false })}
                                            isLoading={activeMutation.isPending}
                                        >
                                            Ngừng hoạt động
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Add/Edit Modal */}
            {showModal && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
                        onClick={handleCloseModal}
                    />

                    {/* Modal */}
                    <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
                        <div
                            className="bg-background-secondary rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Header */}
                            <div className="flex shrink-0 items-center justify-between p-4 border-b border-border">
                                <h2 className="text-lg font-semibold text-foreground">
                                    {editingVenue ? 'Chỉnh sửa cơ sở' : 'Thêm cơ sở mới'}
                                </h2>
                                <button
                                    onClick={handleCloseModal}
                                    className="p-1 rounded-lg hover:bg-background-tertiary transition-colors"
                                >
                                    <X className="w-5 h-5 text-foreground-secondary" />
                                </button>
                            </div>

                            {/* Form */}
                            <form onSubmit={handleSubmit} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-foreground-secondary mb-1.5">
                                        Tên cơ sở *
                                    </label>
                                    <Input
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="VD: Courtify Phú Nhuận"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-foreground-secondary mb-1.5">
                                        Địa chỉ *
                                    </label>
                                    <Input
                                        value={formData.address}
                                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                        placeholder="VD: 123 Nguyễn Văn Trỗi, Quận Phú Nhuận"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-foreground-secondary mb-1.5">
                                        Số điện thoại
                                    </label>
                                    <Input
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        placeholder="VD: 0901234567"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-foreground-secondary mb-1.5">
                                        Điều khoản & dịch vụ dành cho khách hàng
                                    </label>
                                    <textarea
                                        value={formData.termsAndServices}
                                        onChange={(e) => setFormData({ ...formData, termsAndServices: e.target.value })}
                                        placeholder={'Nhập các điều khoản, quy định sử dụng sân và dịch vụ...\nCó thể xuống dòng để trình bày từng mục.'}
                                        rows={6}
                                        maxLength={10000}
                                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-primary-500"
                                    />
                                    <p className="mt-1 text-xs text-foreground-muted">
                                        Nội dung sẽ hiển thị công khai trong trang chi tiết cơ sở.
                                    </p>
                                </div>

                                <div className="space-y-3 rounded-xl border border-border p-3">
                                    <div>
                                        <h3 className="text-sm font-semibold text-foreground">Tài khoản nhận chuyển khoản</h3>
                                        <p className="mt-1 text-xs text-foreground-muted">
                                            Thông tin này dùng để tạo QR tại bước đặt sân. Để trống cả 3 trường nếu chưa nhận chuyển khoản qua QR.
                                        </p>
                                    </div>
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        <div>
                                            <label className="mb-1.5 block text-sm font-medium text-foreground-secondary">Mã ngân hàng VietQR</label>
                                            <Input
                                                value={formData.bankCode}
                                                onChange={(e) => setFormData({ ...formData, bankCode: e.target.value })}
                                                placeholder="VD: MB"
                                            />
                                        </div>
                                        <div>
                                            <label className="mb-1.5 block text-sm font-medium text-foreground-secondary">Số tài khoản</label>
                                            <Input
                                                value={formData.bankAccountNumber}
                                                onChange={(e) => setFormData({ ...formData, bankAccountNumber: e.target.value })}
                                                placeholder="Nhập số tài khoản"
                                                inputMode="numeric"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="mb-1.5 block text-sm font-medium text-foreground-secondary">Tên chủ tài khoản</label>
                                        <Input
                                            value={formData.bankAccountName}
                                            onChange={(e) => setFormData({ ...formData, bankAccountName: e.target.value })}
                                            placeholder="VD: NGUYEN VAN A"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-foreground-secondary mb-1.5">
                                        Ảnh đại diện (Link/URL)
                                    </label>
                                    <Input
                                        value={formData.logo}
                                        onChange={(e) => setFormData({ ...formData, logo: e.target.value })}
                                        placeholder="VD: https://imgur.com/my-venue.jpg"
                                    />
                                </div>

                                {/* Khu vực quản lý bộ sưu tập ảnh (Gallery) */}
                                <div className="space-y-2.5 pt-1">
                                    <label className="block text-sm font-medium text-foreground-secondary">
                                        Hình ảnh cơ sở (Gallery)
                                    </label>

                                    {/* Khung tải ảnh từ file */}
                                    <div className="p-3 rounded-xl border border-dashed border-border bg-background-tertiary/40 space-y-2">
                                        <Input
                                            accept="image/*"
                                            className="cursor-pointer"
                                            multiple
                                            type="file"
                                            onChange={async (e) => {
                                                const files = e.target.files;
                                                if (!files || files.length === 0) return;

                                                // Nén và đọc ảnh trực tiếp từ máy tính
                                                const compressedImages = await Promise.all(
                                                    Array.from(files).map((file) => compressImage(file))
                                                );
                                                const validImages = compressedImages.filter(Boolean);

                                                setFormData((prev) => ({
                                                    ...prev,
                                                    images: [...prev.images, ...validImages],
                                                }));

                                                e.target.value = ''; // Reset input
                                            }}
                                        />
                                        <p className="text-[11px] text-foreground-muted">
                                            Chọn ảnh từ máy tính (hệ thống sẽ tự động tối ưu & nén sắc nét) ({formData.images.length} ảnh)
                                        </p>
                                    </div>

                                    {/* Phần hiển thị (Preview) */}
                                    {formData.images.length > 0 && (
                                        <div className="grid grid-cols-4 gap-2 pt-1 max-h-48 overflow-y-auto pr-1">
                                            {formData.images.map((imgUrl, index) => (
                                                <div
                                                    key={`${imgUrl}-${index}`}
                                                    className="relative group aspect-square rounded-md overflow-hidden border border-border bg-background-tertiary"
                                                >
                                                    <img
                                                        src={imgUrl}
                                                        alt={`Gallery ${index + 1}`}
                                                        className="w-full h-full aspect-square object-cover rounded-md"
                                                        onError={(e) => {
                                                            (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&q=80&w=400';
                                                        }}
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveGalleryImage(index)}
                                                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-md transition-transform active:scale-95"
                                                        title="Xóa ảnh"
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="hidden grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-sm font-medium text-foreground-secondary mb-1.5">
                                            Giờ mở cửa
                                        </label>
                                        <Input
                                            type="time"
                                            value={formData.openTime}
                                            onChange={(e) => setFormData({ ...formData, openTime: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-foreground-secondary mb-1.5">
                                            Giờ đóng cửa
                                        </label>
                                        <Input
                                            type="time"
                                            value={formData.closeTime}
                                            onChange={(e) => setFormData({ ...formData, closeTime: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </form>

                            {/* Footer */}
                            <div className="flex shrink-0 items-center justify-end gap-3 p-4 border-t border-border bg-background-tertiary rounded-b-2xl">
                                <Button variant="secondary" onClick={handleCloseModal}>
                                    Hủy
                                </Button>
                                <Button
                                    onClick={handleSubmit}
                                    isLoading={createMutation.isPending || updateMutation.isPending}
                                >
                                    <Check className="w-4 h-4 mr-2" />
                                    {editingVenue ? 'Cập nhật' : 'Tạo cơ sở'}
                                </Button>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
