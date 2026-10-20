import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
    Users, ShieldCheck, UserPlus, Search, Edit2, Trash2, Lock, Unlock, 
    Building2, CheckCircle2, XCircle, KeyRound, AlertCircle, RefreshCw, 
    Crown, UserCheck, ShieldAlert, X
} from 'lucide-react';
import { staffApi, StaffUser, UserRole, CreateStaffPayload, UpdateStaffPayload } from '@/services/staff.service';
import { venueApi } from '@/services/venue.service';
import { useAuthStore } from '@/stores/auth.store';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const ROLE_BADGES: Record<UserRole, { label: string; bg: string; text: string; border: string; icon: any }> = {
    SUPER_ADMIN: {
        label: 'Tổng Quản Trị',
        bg: 'bg-purple-950/60',
        text: 'text-purple-300',
        border: 'border-purple-800',
        icon: Crown,
    },
    ADMIN: {
        label: 'Quản Trị Viên',
        bg: 'bg-blue-950/60',
        text: 'text-blue-300',
        border: 'border-blue-800',
        icon: ShieldCheck,
    },
    MANAGER: {
        label: 'Quản Lý Ca',
        bg: 'bg-amber-950/60',
        text: 'text-amber-300',
        border: 'border-amber-800',
        icon: UserCheck,
    },
    STAFF: {
        label: 'Nhân Viên Lễ Tân',
        bg: 'bg-emerald-950/60',
        text: 'text-emerald-300',
        border: 'border-emerald-800',
        icon: Users,
    },
};

export default function StaffPage() {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { user: currentUser } = useAuthStore();

    // Tab state
    const [activeTab, setActiveTab] = useState<'staff' | 'matrix'>('staff');

    // Filter states
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRole, setSelectedRole] = useState<string>('');
    const [selectedStatus, setSelectedStatus] = useState<string>('');
    const [selectedVenueId, setSelectedVenueId] = useState<string>('');

    // Modal states
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingStaff, setEditingStaff] = useState<StaffUser | null>(null);
    const [deletingStaff, setDeletingStaff] = useState<StaffUser | null>(null);

    // Queries
    const { data: staffList = [], isLoading: isLoadingStaff, refetch: refetchStaff } = useQuery({
        queryKey: ['staff', searchTerm, selectedRole, selectedStatus, selectedVenueId],
        queryFn: () => staffApi.getAll({
            search: searchTerm,
            role: selectedRole,
            isActive: selectedStatus,
            venueId: selectedVenueId,
        }),
    });

    const { data: rolesData, isLoading: isLoadingRoles } = useQuery({
        queryKey: ['staff-roles'],
        queryFn: () => staffApi.getRoles(),
    });

    const { data: venuesData } = useQuery({
        queryKey: ['venues-list'],
        queryFn: () => venueApi.getAll({}),
    });
    const venues = venuesData?.data || [];

    // Mutations
    const toggleStatusMutation = useMutation({
        mutationFn: (id: string) => staffApi.toggleStatus(id),
        onSuccess: (res) => {
            queryClient.invalidateQueries({ queryKey: ['staff'] });
            toast({
                title: 'Thành công',
                description: `${res.isActive ? 'Kích hoạt' : 'Tạm khóa'} tài khoản ${res.name} thành công`,
                variant: 'success',
            });
        },
        onError: (err: any) => {
            toast({
                title: 'Lỗi',
                description: err.response?.data?.message || 'Không thể thay đổi trạng thái',
                variant: 'error',
            });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => staffApi.delete(id),
        onSuccess: (res) => {
            queryClient.invalidateQueries({ queryKey: ['staff'] });
            setDeletingStaff(null);
            toast({
                title: 'Thành công',
                description: res.message || 'Đã xóa tài khoản nhân viên',
                variant: 'success',
            });
        },
        onError: (err: any) => {
            toast({
                title: 'Lỗi',
                description: err.response?.data?.message || 'Không thể xóa tài khoản',
                variant: 'error',
            });
        },
    });

    // KPI Counters
    const totalStaff = staffList.length;
    const adminCount = staffList.filter(s => s.role === 'SUPER_ADMIN' || s.role === 'ADMIN').length;
    const managerCount = staffList.filter(s => s.role === 'MANAGER').length;
    const staffOnlyCount = staffList.filter(s => s.role === 'STAFF').length;
    const activeCount = staffList.filter(s => s.isActive).length;

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
                        <ShieldCheck className="w-7 h-7 text-primary-500" />
                        <span>Quản lý Nhân viên & Phân quyền</span>
                    </h1>
                    <p className="text-sm text-foreground-secondary mt-1">
                        Quản lý danh sách nhân sự, phân bổ cơ sở trực thuộc và kiểm soát ma trận quyền hạn hệ thống.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => refetchStaff()}
                        className="p-2.5 text-foreground-secondary hover:text-foreground border border-border rounded-xl hover:bg-background-secondary transition"
                        title="Tải lại danh sách"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="px-4 py-2.5 bg-primary-600 hover:bg-primary-500 text-white text-sm font-semibold rounded-xl shadow-md transition flex items-center gap-2"
                    >
                        <UserPlus className="w-4 h-4" />
                        <span>Thêm nhân viên mới</span>
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
                <div className="p-4 rounded-2xl bg-background-secondary border border-border shadow-xs">
                    <span className="text-xs font-semibold text-foreground-secondary">Tổng nhân sự</span>
                    <p className="text-2xl font-black text-foreground mt-1">{totalStaff}</p>
                </div>
                <div className="p-4 rounded-2xl bg-background-secondary border border-border shadow-xs">
                    <span className="text-xs font-semibold text-purple-400">Quản trị viên</span>
                    <p className="text-2xl font-black text-purple-400 mt-1">{adminCount}</p>
                </div>
                <div className="p-4 rounded-2xl bg-background-secondary border border-border shadow-xs">
                    <span className="text-xs font-semibold text-amber-400">Quản lý ca (Manager)</span>
                    <p className="text-2xl font-black text-amber-400 mt-1">{managerCount}</p>
                </div>
                <div className="p-4 rounded-2xl bg-background-secondary border border-border shadow-xs">
                    <span className="text-xs font-semibold text-emerald-400">Lễ tân / Thu ngân</span>
                    <p className="text-2xl font-black text-emerald-400 mt-1">{staffOnlyCount}</p>
                </div>
                <div className="p-4 rounded-2xl bg-background-secondary border border-border shadow-xs col-span-2 sm:col-span-1">
                    <span className="text-xs font-semibold text-primary-400">Đang hoạt động</span>
                    <p className="text-2xl font-black text-primary-400 mt-1">{activeCount} / {totalStaff}</p>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-border gap-6">
                <button
                    onClick={() => setActiveTab('staff')}
                    className={cn(
                        'pb-3 text-sm font-bold border-b-2 transition flex items-center gap-2',
                        activeTab === 'staff'
                            ? 'border-primary-500 text-primary-500'
                            : 'border-transparent text-foreground-secondary hover:text-foreground'
                    )}
                >
                    <Users className="w-4 h-4" />
                    <span>Danh sách Nhân sự ({totalStaff})</span>
                </button>
                <button
                    onClick={() => setActiveTab('matrix')}
                    className={cn(
                        'pb-3 text-sm font-bold border-b-2 transition flex items-center gap-2',
                        activeTab === 'matrix'
                            ? 'border-primary-500 text-primary-500'
                            : 'border-transparent text-foreground-secondary hover:text-foreground'
                    )}
                >
                    <ShieldAlert className="w-4 h-4" />
                    <span>Ma trận Phân quyền & Vai trò</span>
                </button>
            </div>

            {/* TAB 1: DANH SÁCH NHÂN VIÊN */}
            {activeTab === 'staff' && (
                <div className="space-y-4">
                    {/* Filters */}
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-background-secondary p-3.5 rounded-2xl border border-border shadow-xs">
                        <div className="relative">
                            <Search className="w-4 h-4 text-foreground-muted absolute left-3 top-3" />
                            <input
                                type="text"
                                placeholder="Tìm theo tên, email, sđt..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-border bg-background text-foreground outline-none focus:border-primary-500"
                            />
                        </div>
                        <div>
                            <select
                                value={selectedRole}
                                onChange={(e) => setSelectedRole(e.target.value)}
                                className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background text-foreground outline-none focus:border-primary-500"
                            >
                                <option value="">Tất cả vai trò</option>
                                <option value="SUPER_ADMIN">Tổng Quản Trị (SUPER_ADMIN)</option>
                                <option value="ADMIN">Quản Trị Viên (ADMIN)</option>
                                <option value="MANAGER">Quản Lý Ca (MANAGER)</option>
                                <option value="STAFF">Nhân Viên Lễ Tân (STAFF)</option>
                            </select>
                        </div>
                        <div>
                            <select
                                value={selectedVenueId}
                                onChange={(e) => setSelectedVenueId(e.target.value)}
                                className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background text-foreground outline-none focus:border-primary-500"
                            >
                                <option value="">Tất cả cơ sở</option>
                                {venues.map((v: any) => (
                                    <option key={v.id} value={v.id}>{v.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <select
                                value={selectedStatus}
                                onChange={(e) => setSelectedStatus(e.target.value)}
                                className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background text-foreground outline-none focus:border-primary-500"
                            >
                                <option value="">Tất cả trạng thái</option>
                                <option value="true">Đang hoạt động</option>
                                <option value="false">Tạm khóa</option>
                            </select>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="bg-background-secondary rounded-2xl border border-border shadow-xs overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-background-tertiary/70 border-b border-border text-xs uppercase text-foreground-secondary font-semibold">
                                    <tr>
                                        <th className="py-3 px-4">Nhân viên</th>
                                        <th className="py-3 px-4">Vai trò hệ thống</th>
                                        <th className="py-3 px-4">Cơ sở trực thuộc</th>
                                        <th className="py-3 px-4">Trạng thái</th>
                                        <th className="py-3 px-4">Đăng nhập gần nhất</th>
                                        <th className="py-3 px-4 text-right">Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {isLoadingStaff ? (
                                        <tr>
                                            <td colSpan={6} className="py-8 text-center text-foreground-secondary">
                                                Đang tải danh sách nhân viên...
                                            </td>
                                        </tr>
                                    ) : staffList.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="py-8 text-center text-foreground-secondary">
                                                Không tìm thấy nhân viên nào phù hợp bộ lọc.
                                            </td>
                                        </tr>
                                    ) : (
                                        staffList.map((staff) => {
                                            const roleCfg = ROLE_BADGES[staff.role] || ROLE_BADGES.STAFF;
                                            const RoleIcon = roleCfg.icon;
                                            const isSelf = staff.id === currentUser?.id;

                                            return (
                                                <tr key={staff.id} className="hover:bg-background-hover transition">
                                                    <td className="py-3 px-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-9 h-9 rounded-full bg-primary-950 text-primary-300 font-black flex items-center justify-center shrink-0 border border-primary-800">
                                                                {staff.name.charAt(0).toUpperCase()}
                                                            </div>
                                                            <div>
                                                                <div className="font-bold text-foreground flex items-center gap-1.5">
                                                                    <span>{staff.name}</span>
                                                                    {isSelf && (
                                                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary-950 text-primary-300 border border-primary-800">
                                                                            Bạn
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div className="text-xs text-foreground-secondary">{staff.email}</div>
                                                                {staff.phone && (
                                                                    <div className="text-[11px] text-foreground-muted">{staff.phone}</div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <span className={cn(
                                                            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border',
                                                            roleCfg.bg, roleCfg.text, roleCfg.border
                                                        )}>
                                                            <RoleIcon className="w-3.5 h-3.5" />
                                                            <span>{roleCfg.label}</span>
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        {staff.venues && staff.venues.length > 0 ? (
                                                            <div className="flex flex-wrap gap-1">
                                                                {staff.venues.map((v) => (
                                                                    <span
                                                                        key={v.venueId}
                                                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs bg-background-tertiary text-foreground-secondary border border-border"
                                                                    >
                                                                        <Building2 className="w-3 h-3 text-foreground-muted" />
                                                                        <span>{v.venue.name}</span>
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <span className="text-xs text-foreground-muted italic">Toàn bộ cơ sở</span>
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        {staff.isActive ? (
                                                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-800">
                                                                <CheckCircle2 className="w-3 h-3" />
                                                                <span>Hoạt động</span>
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-400 bg-rose-950/60 px-2 py-0.5 rounded-full border border-rose-800">
                                                                <XCircle className="w-3 h-3" />
                                                                <span>Đã khóa</span>
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-4 text-xs text-foreground-secondary">
                                                        {staff.lastLoginAt ? new Date(staff.lastLoginAt).toLocaleString('vi-VN') : 'Chưa đăng nhập'}
                                                    </td>
                                                    <td className="py-3 px-4 text-right">
                                                        <div className="flex items-center justify-end gap-1.5">
                                                            <button
                                                                type="button"
                                                                onClick={() => setEditingStaff(staff)}
                                                                className="p-1.5 text-foreground-secondary hover:text-primary-400 hover:bg-background-tertiary rounded-lg transition"
                                                                title="Chỉnh sửa nhân viên"
                                                            >
                                                                <Edit2 className="w-4 h-4" />
                                                            </button>
                                                            {!isSelf && (
                                                                <>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => toggleStatusMutation.mutate(staff.id)}
                                                                        className={cn(
                                                                            'p-1.5 rounded-lg transition',
                                                                            staff.isActive
                                                                                ? 'text-amber-400 hover:bg-amber-950/40'
                                                                                : 'text-emerald-400 hover:bg-emerald-950/40'
                                                                        )}
                                                                        title={staff.isActive ? 'Khóa tài khoản' : 'Mở khóa'}
                                                                    >
                                                                        {staff.isActive ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setDeletingStaff(staff)}
                                                                        className="p-1.5 text-foreground-secondary hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition"
                                                                        title="Xóa nhân viên"
                                                                    >
                                                                        <Trash2 className="w-4 h-4" />
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: MA TRẬN PHÂN QUYỀN */}
            {activeTab === 'matrix' && (
                <div className="space-y-6">
                    {/* Role cards overview */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {rolesData?.roles.map((r) => {
                            const badge = ROLE_BADGES[r.key] || ROLE_BADGES.STAFF;
                            const Icon = badge.icon;
                            return (
                                <div key={r.key} className="bg-background-secondary rounded-2xl border border-border p-4 shadow-xs flex flex-col justify-between">
                                    <div>
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className={cn('p-2 rounded-xl border', badge.bg, badge.text, badge.border)}>
                                                <Icon className="w-4 h-4" />
                                            </span>
                                            <div>
                                                <h3 className="font-bold text-sm text-foreground">{r.name}</h3>
                                                <span className="text-[11px] font-mono font-semibold text-foreground-muted">{r.key}</span>
                                            </div>
                                        </div>
                                        <p className="text-xs text-foreground-secondary leading-relaxed mt-2">{r.description}</p>
                                    </div>
                                    <div className="mt-4 pt-3 border-t border-border space-y-1.5">
                                        <div className="text-[11px] font-bold uppercase text-foreground">Đặc quyền chính:</div>
                                        {r.permissions.map((p, idx) => (
                                            <div key={idx} className="flex items-start gap-1.5 text-xs text-foreground-secondary">
                                                <CheckCircle2 className="w-3.5 h-3.5 text-primary-400 shrink-0 mt-0.5" />
                                                <span>{p}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Detailed Permission Matrix Table */}
                    <div className="bg-background-secondary rounded-2xl border border-border shadow-xs overflow-hidden">
                        <div className="p-4 border-b border-border bg-background-tertiary/40">
                            <h3 className="font-bold text-base text-foreground">Ma trận Phân quyền Chi tiết (RBAC)</h3>
                            <p className="text-xs text-foreground-secondary mt-0.5">
                                Quy định quyền hạn thực thi của từng cấp bậc nhân sự trên toàn bộ phân hệ chức năng.
                            </p>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-background-tertiary/70 border-b border-border text-xs uppercase text-foreground-secondary font-semibold">
                                    <tr>
                                        <th className="py-3 px-4 w-1/3">Hành động / Phân hệ</th>
                                        <th className="py-3 px-4 text-center text-purple-300">SUPER_ADMIN</th>
                                        <th className="py-3 px-4 text-center text-blue-300">ADMIN</th>
                                        <th className="py-3 px-4 text-center text-amber-300">MANAGER</th>
                                        <th className="py-3 px-4 text-center text-emerald-300">STAFF</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rolesData?.modules.map((mod, modIdx) => (
                                        <React.Fragment key={modIdx}>
                                            <tr className="bg-background-tertiary/40 border-t border-border font-bold text-xs uppercase tracking-wider text-foreground">
                                                <td colSpan={5} className="py-2.5 px-4 bg-background-tertiary/60">
                                                    📁 {mod.module}
                                                </td>
                                            </tr>
                                            {mod.actions.map((act, actIdx) => (
                                                <tr key={actIdx} className="border-t border-border hover:bg-background-hover transition">
                                                    <td className="py-2.5 px-6 text-xs text-foreground font-medium">
                                                        • {act.name}
                                                    </td>
                                                    <td className="py-2.5 px-4 text-center">
                                                        {act.superAdmin ? (
                                                            <CheckCircle2 className="w-4 h-4 text-purple-400 mx-auto" />
                                                        ) : (
                                                            <span className="text-foreground-muted text-xs">—</span>
                                                        )}
                                                    </td>
                                                    <td className="py-2.5 px-4 text-center">
                                                        {act.admin ? (
                                                            <CheckCircle2 className="w-4 h-4 text-blue-400 mx-auto" />
                                                        ) : (
                                                            <span className="text-foreground-muted text-xs">—</span>
                                                        )}
                                                    </td>
                                                    <td className="py-2.5 px-4 text-center">
                                                        {act.manager ? (
                                                            <CheckCircle2 className="w-4 h-4 text-amber-400 mx-auto" />
                                                        ) : (
                                                            <span className="text-foreground-muted text-xs">—</span>
                                                        )}
                                                    </td>
                                                    <td className="py-2.5 px-4 text-center">
                                                        {act.staff ? (
                                                            <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" />
                                                        ) : (
                                                            <span className="text-foreground-muted text-xs">—</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </React.Fragment>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL: TẠO / SỬA NHÂN VIÊN (Phủ đen nền chắc chắn, hộp thoại màu nền đậm đặc) */}
            {(isCreateModalOpen || editingStaff) && (
                <StaffFormModal
                    isOpen={Boolean(isCreateModalOpen || editingStaff)}
                    onClose={() => {
                        setIsCreateModalOpen(false);
                        setEditingStaff(null);
                    }}
                    staff={editingStaff}
                    venues={venues}
                    onSuccess={() => {
                        queryClient.invalidateQueries({ queryKey: ['staff'] });
                        setIsCreateModalOpen(false);
                        setEditingStaff(null);
                    }}
                />
            )}

            {/* MODAL: XÁC NHẬN XÓA */}
            {deletingStaff && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in">
                    <div className="w-full max-w-md rounded-2xl bg-[#171717] p-6 shadow-2xl border border-border">
                        <div className="flex items-center gap-3 text-rose-500 mb-3">
                            <AlertCircle className="w-6 h-6 shrink-0" />
                            <h3 className="font-bold text-lg text-foreground">Xóa tài khoản nhân viên</h3>
                        </div>
                        <p className="text-sm text-foreground-secondary leading-relaxed">
                            Bạn có chắc chắn muốn xóa tài khoản của <strong className="text-foreground">{deletingStaff.name}</strong> ({deletingStaff.email})? 
                            Hành động này không thể hoàn tác.
                        </p>
                        <div className="flex items-center justify-end gap-3 mt-6">
                            <button
                                type="button"
                                onClick={() => setDeletingStaff(null)}
                                className="px-4 py-2 text-sm font-semibold rounded-xl border border-border text-foreground hover:bg-background-tertiary transition"
                            >
                                Hủy
                            </button>
                            <button
                                type="button"
                                disabled={deleteMutation.isPending}
                                onClick={() => deleteMutation.mutate(deletingStaff.id)}
                                className="px-4 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition"
                            >
                                {deleteMutation.isPending ? 'Đang xóa...' : 'Xóa vĩnh viễn'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// SUB-COMPONENT: FORM MODAL FOR CREATE & UPDATE
interface StaffFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    staff: StaffUser | null;
    venues: any[];
    onSuccess: () => void;
}

function StaffFormModal({ isOpen, onClose, staff, venues, onSuccess }: StaffFormModalProps) {
    const { toast } = useToast();
    const isEdit = Boolean(staff);

    const [name, setName] = useState(staff?.name || '');
    const [email, setEmail] = useState(staff?.email || '');
    const [phone, setPhone] = useState(staff?.phone || '');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState<UserRole>(staff?.role || 'STAFF');
    const [selectedVenues, setSelectedVenues] = useState<string[]>(
        staff?.venues ? staff.venues.map(v => v.venueId) : []
    );
    const [isActive, setIsActive] = useState(staff ? staff.isActive : true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            if (isEdit && staff) {
                const payload: UpdateStaffPayload = {
                    name,
                    phone: phone || null,
                    role,
                    venueIds: selectedVenues,
                    isActive,
                };
                if (password.trim()) {
                    payload.password = password.trim();
                }
                await staffApi.update(staff.id, payload);
                toast({ title: 'Thành công', description: `Cập nhật thông tin nhân viên ${name} thành công`, variant: 'success' });
            } else {
                const payload: CreateStaffPayload = {
                    name,
                    email,
                    phone: phone || undefined,
                    password: password || '123456',
                    role,
                    venueIds: selectedVenues,
                    isActive,
                };
                await staffApi.create(payload);
                toast({ title: 'Thành công', description: `Tạo tài khoản nhân viên ${name} thành công`, variant: 'success' });
            }
            onSuccess();
        } catch (err: any) {
            toast({
                title: 'Lỗi',
                description: err.response?.data?.message || 'Có lỗi xảy ra khi lưu nhân viên',
                variant: 'error',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const toggleVenue = (venueId: string) => {
        setSelectedVenues(prev => 
            prev.includes(venueId) ? prev.filter(id => id !== venueId) : [...prev, venueId]
        );
    };

    return (
        <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div className="w-full max-w-lg rounded-2xl bg-[#171717] p-6 shadow-2xl border border-[#2e2e2e] relative max-h-[92vh] overflow-y-auto">
                <div className="flex items-center justify-between pb-3 border-b border-[#2e2e2e]">
                    <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                        <Users className="w-5 h-5 text-primary-500" />
                        <span>{isEdit ? 'Chỉnh sửa nhân viên' : 'Thêm nhân viên mới'}</span>
                    </h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-foreground-secondary hover:text-foreground p-1.5 rounded-lg hover:bg-background-tertiary transition"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div className="col-span-2 sm:col-span-1">
                            <label className="block text-xs font-bold uppercase text-foreground-secondary mb-1">Họ và tên *</label>
                            <input
                                type="text"
                                required
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Ví dụ: Nguyễn Văn A"
                                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#333333] bg-[#0a0a0a] text-foreground outline-none focus:border-primary-500 transition"
                            />
                        </div>
                        <div className="col-span-2 sm:col-span-1">
                            <label className="block text-xs font-bold uppercase text-foreground-secondary mb-1">Số điện thoại</label>
                            <input
                                type="text"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                placeholder="0901234567"
                                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#333333] bg-[#0a0a0a] text-foreground outline-none focus:border-primary-500 transition"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase text-foreground-secondary mb-1">Email đăng nhập *</label>
                        <input
                            type="email"
                            required
                            disabled={isEdit}
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="nhanvien@san-cau-long.local"
                            className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#333333] bg-[#0a0a0a] text-foreground outline-none focus:border-primary-500 disabled:opacity-50 transition"
                        />
                        {isEdit && <p className="text-[11px] text-foreground-muted mt-1">Không thể thay đổi email đã đăng ký</p>}
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase text-foreground-secondary mb-1">
                            {isEdit ? 'Mật khẩu mới (bỏ trống nếu giữ nguyên)' : 'Mật khẩu khởi tạo *'}
                        </label>
                        <div className="relative">
                            <input
                                type="password"
                                required={!isEdit}
                                minLength={6}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder={isEdit ? 'Nhập mật khẩu mới...' : 'Mặc định: 123456'}
                                className="w-full pl-3.5 pr-9 py-2.5 text-sm rounded-xl border border-[#333333] bg-[#0a0a0a] text-foreground outline-none focus:border-primary-500 transition"
                            />
                            <KeyRound className="w-4 h-4 text-foreground-muted absolute right-3 top-3" />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase text-foreground-secondary mb-1">Vai trò hệ thống *</label>
                        <select
                            value={role}
                            onChange={(e) => setRole(e.target.value as UserRole)}
                            className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#333333] bg-[#0a0a0a] text-foreground outline-none focus:border-primary-500 font-semibold transition"
                        >
                            <option value="STAFF">Nhân viên Lễ tân / Thu ngân (STAFF)</option>
                            <option value="MANAGER">Quản lý Ca / Trưởng sân (MANAGER)</option>
                            <option value="ADMIN">Quản Trị Viên Cơ Sở (ADMIN)</option>
                            <option value="SUPER_ADMIN">Tổng Quản Trị Hệ Thống (SUPER_ADMIN)</option>
                        </select>
                        <div className="mt-1.5 p-2.5 rounded-xl bg-[#0a0a0a] border border-[#262626] text-xs text-foreground-secondary leading-relaxed">
                            {role === 'STAFF' && '• Trực quầy, quét mã QR Check-in khách, bán nước và thanh toán tiền sân.'}
                            {role === 'MANAGER' && '• Quản lý lịch sân, duyệt yêu cầu booking trực tuyến và kiểm kê hàng hóa.'}
                            {role === 'ADMIN' && '• Toàn quyền quản trị cơ sở, thiết lập bảng giá, duyệt ưu đãi HUE và nhân sự.'}
                            {role === 'SUPER_ADMIN' && '• Toàn quyền cao nhất toàn hệ thống, quản lý tất cả các cơ sở.'}
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase text-foreground-secondary mb-1.5">Cơ sở được phân công</label>
                        <div className="space-y-1.5 max-h-36 overflow-y-auto border border-[#333333] p-2.5 rounded-xl bg-[#0a0a0a]">
                            {venues.map((v: any) => (
                                <label key={v.id} className="flex items-center gap-2.5 text-xs text-foreground cursor-pointer hover:bg-[#1f1f1f] p-1.5 rounded-lg transition">
                                    <input
                                        type="checkbox"
                                        checked={selectedVenues.includes(v.id)}
                                        onChange={() => toggleVenue(v.id)}
                                        className="w-4 h-4 rounded border-border text-primary-500 focus:ring-primary-500"
                                    />
                                    <span className="font-medium">{v.name}</span>
                                </label>
                            ))}
                            {venues.length === 0 && (
                                <span className="text-xs text-foreground-muted italic">Chưa có cơ sở nào</span>
                            )}
                        </div>
                        <p className="text-[11px] text-foreground-muted mt-1">Nếu không chọn cơ sở nào, nhân viên sẽ có quyền trên toàn bộ cơ sở.</p>
                    </div>

                    <div className="flex items-center gap-2.5 pt-1">
                        <input
                            type="checkbox"
                            id="isActiveStaff"
                            checked={isActive}
                            onChange={(e) => setIsActive(e.target.checked)}
                            className="w-4 h-4 rounded border-border text-primary-500 focus:ring-primary-500 cursor-pointer"
                        />
                        <label htmlFor="isActiveStaff" className="text-xs font-bold text-foreground cursor-pointer select-none">
                            Kích hoạt tài khoản ngay (Cho phép đăng nhập)
                        </label>
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#2e2e2e]">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2.5 text-sm font-semibold rounded-xl border border-border text-foreground hover:bg-background-tertiary transition"
                        >
                            Hủy
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-5 py-2.5 text-sm font-bold text-white bg-primary-600 hover:bg-primary-500 rounded-xl shadow-md transition"
                        >
                            {isSubmitting ? 'Đang lưu...' : (isEdit ? 'Lưu thay đổi' : 'Tạo tài khoản')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
