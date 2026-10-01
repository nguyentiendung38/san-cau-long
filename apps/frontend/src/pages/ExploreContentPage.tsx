import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Eye, EyeOff } from 'lucide-react';
import {
    exploreContentApi,
    ExploreContent,
    ExploreContentInput,
    ExploreContentType,
    TYPE_LABELS,
    TYPE_ICONS,
} from '@/services/explore-content.service';
import { useToast } from '@/hooks/use-toast';

const ALL_TYPES: ExploreContentType[] = ['EVENT', 'MEMBERSHIP', 'COURSE', 'NEWS', 'DEAL', 'PASS'];

const EMPTY_FORM: ExploreContentInput = {
    type: 'EVENT',
    title: '',
    description: '',
    imageUrl: '',
    price: '',
    badge: '',
    isActive: true,
    sortOrder: 0,
    startDate: '',
    endDate: '',
};

export default function ExploreContentPage() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [filterType, setFilterType] = useState<ExploreContentType | 'all'>('all');
    const [showModal, setShowModal] = useState(false);
    const [editItem, setEditItem] = useState<ExploreContent | null>(null);
    const [form, setForm] = useState<ExploreContentInput>(EMPTY_FORM);
    const [deleteConfirm, setDeleteConfirm] = useState<ExploreContent | null>(null);

    const { data: items = [], isLoading } = useQuery({
        queryKey: ['explore-contents', filterType],
        queryFn: () => exploreContentApi.getAll(filterType === 'all' ? undefined : filterType),
    });

    const createMutation = useMutation({
        mutationFn: (data: ExploreContentInput) => exploreContentApi.create(data),
        onSuccess: () => {
            toast({ title: '✅ Đã tạo nội dung mới', variant: 'success' });
            queryClient.invalidateQueries({ queryKey: ['explore-contents'] });
            closeModal();
        },
        onError: () => toast({ title: 'Lỗi khi tạo', variant: 'error' }),
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<ExploreContentInput> }) =>
            exploreContentApi.update(id, data),
        onSuccess: () => {
            toast({ title: '✅ Đã cập nhật', variant: 'success' });
            queryClient.invalidateQueries({ queryKey: ['explore-contents'] });
            closeModal();
        },
        onError: () => toast({ title: 'Lỗi khi cập nhật', variant: 'error' }),
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => exploreContentApi.delete(id),
        onSuccess: () => {
            toast({ title: '✅ Đã xóa', variant: 'success' });
            queryClient.invalidateQueries({ queryKey: ['explore-contents'] });
            setDeleteConfirm(null);
        },
        onError: () => toast({ title: 'Lỗi khi xóa', variant: 'error' }),
    });

    const toggleActiveMutation = useMutation({
        mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
            exploreContentApi.update(id, { isActive }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['explore-contents'] }),
    });

    const openCreate = () => {
        setEditItem(null);
        setForm(EMPTY_FORM);
        setShowModal(true);
    };

    const openEdit = (item: ExploreContent) => {
        setEditItem(item);
        setForm({
            type: item.type,
            title: item.title,
            description: item.description || '',
            imageUrl: item.imageUrl || '',
            price: item.price || '',
            badge: item.badge || '',
            isActive: item.isActive,
            sortOrder: item.sortOrder,
            startDate: item.startDate ? item.startDate.slice(0, 10) : '',
            endDate: item.endDate ? item.endDate.slice(0, 10) : '',
        });
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditItem(null);
        setForm(EMPTY_FORM);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.title.trim()) return;
        const payload = {
            ...form,
            startDate: form.startDate || undefined,
            endDate: form.endDate || undefined,
        };
        if (editItem) {
            updateMutation.mutate({ id: editItem.id, data: payload });
        } else {
            createMutation.mutate(payload);
        }
    };

    const isSaving = createMutation.isPending || updateMutation.isPending;

    return (
        <div className="p-6 space-y-6 max-w-screen-xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Nội dung Khám phá</h1>
                    <p className="text-sm text-gray-500 mt-1">Quản lý nội dung hiển thị trên trang Khám phá của Portal khách hàng</p>
                </div>
                <button
                    onClick={openCreate}
                    className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-sm"
                >
                    <Plus className="w-4 h-4" />
                    Thêm nội dung
                </button>
            </div>

            {/* Filter tabs */}
            <div className="flex gap-2 flex-wrap">
                <button
                    onClick={() => setFilterType('all')}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                        filterType === 'all' ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                    }`}
                >
                    Tất cả ({items.length})
                </button>
                {ALL_TYPES.map(type => (
                    <button
                        key={type}
                        onClick={() => setFilterType(type)}
                        className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-colors flex items-center gap-1.5 ${
                            filterType === type ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                        }`}
                    >
                        <span>{TYPE_ICONS[type]}</span>
                        {TYPE_LABELS[type]}
                    </button>
                ))}
            </div>

            {/* Content list */}
            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="bg-white rounded-2xl h-48 animate-pulse border border-gray-100" />
                    ))}
                </div>
            ) : items.length === 0 ? (
                <div className="text-center py-20 text-gray-500 bg-white rounded-2xl border border-gray-100">
                    <div className="text-5xl mb-4">📭</div>
                    <p className="font-semibold text-gray-700">Chưa có nội dung nào</p>
                    <p className="text-sm mt-1">Bấm "Thêm nội dung" để bắt đầu</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {items.map(item => (
                        <div
                            key={item.id}
                            className={`bg-white rounded-2xl shadow-sm border overflow-hidden flex flex-col transition-all hover:shadow-md ${
                                item.isActive ? 'border-gray-100' : 'border-gray-200 opacity-60'
                            }`}
                        >
                            {/* Top color band */}
                            <div className="h-2 bg-gradient-to-r from-green-500 to-green-400" />

                            <div className="p-4 flex flex-col flex-1 gap-3">
                                {/* Type + badge */}
                                <div className="flex items-center justify-between">
                                    <span className="flex items-center gap-1.5 text-xs font-bold bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">
                                        {TYPE_ICONS[item.type as ExploreContentType]} {TYPE_LABELS[item.type as ExploreContentType]}
                                    </span>
                                    {item.badge && (
                                        <span className="text-xs font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">{item.badge}</span>
                                    )}
                                </div>

                                {/* Title + description */}
                                <div className="flex-1">
                                    <h3 className="font-bold text-gray-800 leading-tight line-clamp-2">{item.title}</h3>
                                    {item.description && (
                                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">{item.description}</p>
                                    )}
                                </div>

                                {/* Price */}
                                {item.price && (
                                    <p className="text-green-700 font-black text-base">{item.price}</p>
                                )}

                                {/* Dates */}
                                {(item.startDate || item.endDate) && (
                                    <p className="text-xs text-gray-400">
                                        📅 {item.startDate ? new Date(item.startDate).toLocaleDateString('vi-VN') : ''} 
                                        {item.endDate ? ` → ${new Date(item.endDate).toLocaleDateString('vi-VN')}` : ''}
                                    </p>
                                )}

                                {/* Active status + sort */}
                                <div className="flex items-center justify-between pt-2 border-t border-gray-50">
                                    <button
                                        onClick={() => toggleActiveMutation.mutate({ id: item.id, isActive: !item.isActive })}
                                        className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors ${
                                            item.isActive
                                                ? 'bg-green-50 text-green-700 hover:bg-green-100'
                                                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                        }`}
                                    >
                                        {item.isActive ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                                        {item.isActive ? 'Đang hiển thị' : 'Đã ẩn'}
                                    </button>
                                    <span className="text-xs text-gray-400">Thứ tự: {item.sortOrder}</span>
                                </div>

                                {/* Actions */}
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => openEdit(item)}
                                        className="flex-1 flex items-center justify-center gap-1.5 text-sm font-semibold border border-gray-200 hover:border-green-300 hover:text-green-700 py-2 rounded-xl transition-colors"
                                    >
                                        <Pencil className="w-3.5 h-3.5" /> Sửa
                                    </button>
                                    <button
                                        onClick={() => setDeleteConfirm(item)}
                                        className="flex items-center justify-center gap-1.5 text-sm font-semibold text-red-600 border border-red-100 hover:bg-red-50 px-3 py-2 rounded-xl transition-colors"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl">
                        <div className="sticky top-0 bg-white px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                            <h2 className="font-bold text-lg text-gray-800">
                                {editItem ? 'Chỉnh sửa nội dung' : 'Thêm nội dung mới'}
                            </h2>
                            <button onClick={closeModal} className="p-2 hover:bg-gray-100 rounded-lg">✕</button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            {/* Type */}
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-gray-700">Loại nội dung *</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {ALL_TYPES.map(type => (
                                        <button
                                            key={type}
                                            type="button"
                                            onClick={() => setForm(f => ({ ...f, type }))}
                                            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                                                form.type === type ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-600 border-gray-200 hover:border-green-300'
                                            }`}
                                        >
                                            <span>{TYPE_ICONS[type]}</span>
                                            <span className="truncate">{TYPE_LABELS[type]}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Title */}
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-gray-700">Tiêu đề *</label>
                                <input
                                    required
                                    value={form.title}
                                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                                    placeholder="Tiêu đề nội dung..."
                                />
                            </div>

                            {/* Description */}
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-gray-700">Mô tả</label>
                                <textarea
                                    value={form.description}
                                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                                    rows={3}
                                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                                    placeholder="Mô tả chi tiết..."
                                />
                            </div>

                            {/* Price + Badge in 2 columns */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-sm font-semibold text-gray-700">Giá tiền</label>
                                    <input
                                        value={form.price}
                                        onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                                        className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                                        placeholder="VD: 500.000đ/tháng"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-semibold text-gray-700">Badge / Tag</label>
                                    <input
                                        value={form.badge}
                                        onChange={e => setForm(f => ({ ...f, badge: e.target.value }))}
                                        className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                                        placeholder="VD: Phổ biến, HOT..."
                                    />
                                </div>
                            </div>

                            {/* Image URL */}
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-gray-700">URL Hình ảnh</label>
                                <input
                                    value={form.imageUrl}
                                    onChange={e => setForm(f => ({ ...f, imageUrl: e.target.value }))}
                                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                                    placeholder="https://..."
                                />
                            </div>

                            {/* Start/End dates */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-sm font-semibold text-gray-700">Ngày bắt đầu</label>
                                    <input
                                        type="date"
                                        value={form.startDate}
                                        onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                                        className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-semibold text-gray-700">Ngày kết thúc</label>
                                    <input
                                        type="date"
                                        value={form.endDate}
                                        onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                                        className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                                    />
                                </div>
                            </div>

                            {/* Sort order + Active */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-sm font-semibold text-gray-700">Thứ tự hiển thị</label>
                                    <input
                                        type="number"
                                        value={form.sortOrder}
                                        onChange={e => setForm(f => ({ ...f, sortOrder: Number(e.target.value) }))}
                                        className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                                        min={0}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-semibold text-gray-700">Trạng thái</label>
                                    <button
                                        type="button"
                                        onClick={() => setForm(f => ({ ...f, isActive: !f.isActive }))}
                                        className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
                                            form.isActive
                                                ? 'bg-green-50 text-green-700 border-green-300'
                                                : 'bg-gray-100 text-gray-500 border-gray-300'
                                        }`}
                                    >
                                        {form.isActive ? <><Eye className="w-4 h-4" /> Hiển thị</> : <><EyeOff className="w-4 h-4" /> Ẩn</>}
                                    </button>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-semibold hover:bg-gray-50 transition-colors"
                                >
                                    Hủy
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className="flex-1 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold transition-colors"
                                >
                                    {isSaving ? 'Đang lưu...' : editItem ? 'Cập nhật' : 'Tạo mới'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete confirmation */}
            {deleteConfirm && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
                        <div className="text-center">
                            <div className="text-5xl mb-4">🗑️</div>
                            <h3 className="font-bold text-lg text-gray-800 mb-2">Xóa nội dung?</h3>
                            <p className="text-sm text-gray-500 mb-6">
                                Bạn có chắc muốn xóa <strong>"{deleteConfirm.title}"</strong>? Hành động này không thể hoàn tác.
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setDeleteConfirm(null)}
                                    className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-semibold hover:bg-gray-50"
                                >
                                    Hủy
                                </button>
                                <button
                                    onClick={() => deleteMutation.mutate(deleteConfirm.id)}
                                    disabled={deleteMutation.isPending}
                                    className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold disabled:opacity-50"
                                >
                                    {deleteMutation.isPending ? 'Đang xóa...' : 'Xóa'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

