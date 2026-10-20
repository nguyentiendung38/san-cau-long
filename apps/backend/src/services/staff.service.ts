import bcrypt from 'bcryptjs';
import prisma from '../config/database.js';
import { AppError } from '../middleware/error.js';
import { UserRole } from '../middleware/auth.js';

export interface CreateStaffInput {
    name: string;
    email: string;
    phone?: string;
    password: string;
    role: UserRole;
    venueIds?: string[];
    isActive?: boolean;
}

export interface UpdateStaffInput {
    name?: string;
    phone?: string | null;
    password?: string;
    role?: UserRole;
    venueIds?: string[];
    isActive?: boolean;
}

export const ROLE_DEFINITIONS = [
    {
        key: 'SUPER_ADMIN',
        name: 'Tổng Quản Trị Hệ Thống',
        badgeColor: 'purple',
        description: 'Toàn quyền kiểm soát cao nhất hệ thống, quản lý tất cả cơ sở và phân quyền nhân sự.',
        permissions: [
            'Toàn quyền quản trị cơ sở dữ liệu và cấu hình hệ thống',
            'Tạo, xóa và phân quyền mọi tài khoản nhân viên & quản lý',
            'Xem toàn bộ báo cáo doanh thu tất cả cơ sở',
            'Cấu hình chính sách giá, ưu đãi sinh viên HUE và ngân hàng thanh toán',
        ],
    },
    {
        key: 'ADMIN',
        name: 'Quản Trị Viên Cơ Sở',
        badgeColor: 'blue',
        description: 'Quản lý toàn diện vận hành sân bãi, khách hàng, ưu đãi học đường và nhân sự cơ sở.',
        permissions: [
            'Quản lý danh sách sân, bảo trì và thiết lập bảng giá theo giờ',
            'Duyệt / Hủy xác thực ưu đãi Sinh viên HUE (-20%)',
            'Quản lý nhân viên (STAFF, MANAGER) tại cơ sở',
            'Xem báo cáo doanh thu, lập và hủy hóa đơn, hoàn tiền',
            'Quản lý kho hàng, dịch vụ đồ uống và phụ kiện cầu lông',
        ],
    },
    {
        key: 'MANAGER',
        name: 'Quản Lý Ca / Trưởng Sân',
        badgeColor: 'amber',
        description: 'Chịu trách nhiệm vận hành ca trực, duyệt yêu cầu booking và kiểm soát kho.',
        permissions: [
            'Duyệt / Từ chối các yêu cầu đặt sân trực tuyến từ khách hàng',
            'Xếp lịch, đổi sân, xử lý sự cố dời ca trong ngày',
            'Thực hiện Check-in QR cho khách đến nhận sân',
            'Kiểm kê hàng hóa nhập/xuất trong ca trực',
            'Xem báo cáo doanh thu và giao ca',
        ],
    },
    {
        key: 'STAFF',
        name: 'Nhân Viên Lễ Tân / Thu Ngân',
        badgeColor: 'emerald',
        description: 'Trực quầy đón tiếp khách, quét mã nhận sân, bán nước/phụ kiện và thanh toán.',
        permissions: [
            'Xem trực quan sơ đồ sân và tình trạng trống/bận',
            'Tạo lịch đặt sân nhanh cho khách vãng lai tại quầy',
            'Quét mã QR Check-in khách vào sân',
            'Lập hóa đơn thanh toán tiền sân và bán lẻ đồ uống',
            'Không được sửa bảng giá, không được xóa hóa đơn hay can thiệp nhân sự',
        ],
    },
];

export const PERMISSION_MODULES = [
    {
        module: 'Lịch & Đặt sân',
        actions: [
            { name: 'Xem sơ đồ và trạng thái sân', superAdmin: true, admin: true, manager: true, staff: true },
            { name: 'Đặt sân tại quầy cho khách', superAdmin: true, admin: true, manager: true, staff: true },
            { name: 'Check-in khách qua mã QR', superAdmin: true, admin: true, manager: true, staff: true },
            { name: 'Đổi lịch / Dời sân cho khách', superAdmin: true, admin: true, manager: true, staff: false },
            { name: 'Hủy lịch đặt sân', superAdmin: true, admin: true, manager: true, staff: false },
        ],
    },
    {
        module: 'Yêu cầu đặt sân Online',
        actions: [
            { name: 'Xem danh sách yêu cầu', superAdmin: true, admin: true, manager: true, staff: true },
            { name: 'Duyệt yêu cầu giữ chỗ', superAdmin: true, admin: true, manager: true, staff: false },
            { name: 'Từ chối / Hủy yêu cầu', superAdmin: true, admin: true, manager: true, staff: false },
        ],
    },
    {
        module: 'Khách hàng & Định danh HUE',
        actions: [
            { name: 'Xem danh sách khách hàng', superAdmin: true, admin: true, manager: true, staff: true },
            { name: 'Thêm / Cập nhật khách hàng', superAdmin: true, admin: true, manager: true, staff: true },
            { name: 'Duyệt ưu đãi Sinh viên HUE (-20%)', superAdmin: true, admin: true, manager: true, staff: false },
            { name: 'Xóa hồ sơ khách hàng', superAdmin: true, admin: true, manager: false, staff: false },
        ],
    },
    {
        module: 'Hóa đơn & Thu chi',
        actions: [
            { name: 'Lập hóa đơn tiền sân & dịch vụ', superAdmin: true, admin: true, manager: true, staff: true },
            { name: 'Thu tiền mặt / Quét mã VietQR', superAdmin: true, admin: true, manager: true, staff: true },
            { name: 'Hoàn tiền hóa đơn (Refund)', superAdmin: true, admin: true, manager: false, staff: false },
            { name: 'Hủy hóa đơn', superAdmin: true, admin: true, manager: false, staff: false },
        ],
    },
    {
        module: 'Kho hàng & Dịch vụ',
        actions: [
            { name: 'Bán lẻ nước uống, đồ ăn, cầu lông', superAdmin: true, admin: true, manager: true, staff: true },
            { name: 'Nhập kho & Cập nhật số lượng tồn', superAdmin: true, admin: true, manager: true, staff: false },
            { name: 'Thêm mới / Xóa sản phẩm, dịch vụ', superAdmin: true, admin: true, manager: false, staff: false },
        ],
    },
    {
        module: 'Cấu hình Sân & Bảng giá',
        actions: [
            { name: 'Đóng sân bảo trì tạm thời', superAdmin: true, admin: true, manager: true, staff: false },
            { name: 'Thêm mới / Xóa sân cầu lông', superAdmin: true, admin: true, manager: false, staff: false },
            { name: 'Thiết lập bảng giá theo khung giờ & ngày', superAdmin: true, admin: true, manager: false, staff: false },
        ],
    },
    {
        module: 'Báo cáo & Nhân sự',
        actions: [
            { name: 'Xem báo cáo doanh thu chi tiết & Xuất Excel', superAdmin: true, admin: true, manager: false, staff: false },
            { name: 'Quản lý tài khoản nhân viên & Phân quyền', superAdmin: true, admin: true, manager: false, staff: false },
        ],
    },
];

export const staffService = {
    async getAll(query: { search?: string; role?: string; isActive?: string; venueId?: string }) {
        const where: any = {};

        if (query.role) {
            where.role = query.role;
        }

        if (query.isActive !== undefined && query.isActive !== '') {
            where.isActive = query.isActive === 'true';
        }

        if (query.search) {
            const s = query.search.trim();
            where.OR = [
                { name: { contains: s } },
                { email: { contains: s } },
                { phone: { contains: s } },
            ];
        }

        if (query.venueId) {
            where.venues = {
                some: { venueId: query.venueId },
            };
        }

        const staffList = await prisma.user.findMany({
            where,
            orderBy: [{ role: 'asc' }, { createdAt: 'desc' }],
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                avatar: true,
                role: true,
                isActive: true,
                lastLoginAt: true,
                createdAt: true,
                venues: {
                    select: {
                        venueId: true,
                        role: true,
                        venue: {
                            select: { id: true, name: true, address: true },
                        },
                    },
                },
            },
        });

        return staffList;
    },

    async getById(id: string) {
        const user = await prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                avatar: true,
                role: true,
                isActive: true,
                lastLoginAt: true,
                createdAt: true,
                venues: {
                    select: {
                        venueId: true,
                        role: true,
                        venue: {
                            select: { id: true, name: true, address: true },
                        },
                    },
                },
            },
        });

        if (!user) throw new AppError(404, 'Không tìm thấy tài khoản nhân viên');
        return user;
    },

    async create(input: CreateStaffInput) {
        const email = input.email.trim().toLowerCase();
        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
            throw new AppError(409, `Email ${email} đã được sử dụng cho một tài khoản khác`);
        }

        const passwordHash = await bcrypt.hash(input.password || '123456', 12);

        const user = await prisma.user.create({
            data: {
                name: input.name.trim(),
                email,
                phone: input.phone?.trim() || null,
                passwordHash,
                role: input.role || 'STAFF',
                isActive: input.isActive !== undefined ? input.isActive : true,
                venues: input.venueIds && input.venueIds.length > 0 ? {
                    create: input.venueIds.map(venueId => ({
                        venueId,
                        role: input.role || 'STAFF',
                    })),
                } : undefined,
            },
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                role: true,
                isActive: true,
                createdAt: true,
                venues: {
                    select: {
                        venueId: true,
                        role: true,
                        venue: { select: { id: true, name: true } },
                    },
                },
            },
        });

        return user;
    },

    async update(id: string, input: UpdateStaffInput, currentUserId: string) {
        const user = await prisma.user.findUnique({ where: { id } });
        if (!user) throw new AppError(404, 'Không tìm thấy tài khoản nhân viên');

        // Cannot deactivate or demote self
        if (id === currentUserId) {
            if (input.isActive === false) {
                throw new AppError(400, 'Bạn không thể tự vô hiệu hóa tài khoản của chính mình');
            }
            if (input.role && input.role !== user.role && (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN')) {
                throw new AppError(400, 'Bạn không thể tự hạ quyền vai trò của chính mình');
            }
        }

        const data: any = {};
        if (input.name) data.name = input.name.trim();
        if (input.phone !== undefined) data.phone = input.phone ? input.phone.trim() : null;
        if (input.role) data.role = input.role;
        if (input.isActive !== undefined) data.isActive = input.isActive;
        if (input.password && input.password.trim().length >= 6) {
            data.passwordHash = await bcrypt.hash(input.password.trim(), 12);
        }

        // Update venues if provided
        if (input.venueIds !== undefined) {
            await prisma.venueStaff.deleteMany({ where: { userId: id } });
            if (input.venueIds.length > 0) {
                await prisma.venueStaff.createMany({
                    data: input.venueIds.map(venueId => ({
                        userId: id,
                        venueId,
                        role: input.role || user.role,
                    })),
                });
            }
        }

        const updated = await prisma.user.update({
            where: { id },
            data,
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                role: true,
                isActive: true,
                updatedAt: true,
                venues: {
                    select: {
                        venueId: true,
                        role: true,
                        venue: { select: { id: true, name: true } },
                    },
                },
            },
        });

        return updated;
    },

    async toggleStatus(id: string, currentUserId: string) {
        const user = await prisma.user.findUnique({ where: { id } });
        if (!user) throw new AppError(404, 'Không tìm thấy tài khoản nhân viên');
        if (id === currentUserId) {
            throw new AppError(400, 'Bạn không thể tự khóa tài khoản của chính mình');
        }

        const updated = await prisma.user.update({
            where: { id },
            data: { isActive: !user.isActive },
            select: { id: true, name: true, email: true, isActive: true },
        });

        return updated;
    },

    async delete(id: string, currentUserId: string) {
        if (id === currentUserId) {
            throw new AppError(400, 'Bạn không thể tự xóa tài khoản của chính mình');
        }

        const user = await prisma.user.findUnique({ where: { id } });
        if (!user) throw new AppError(404, 'Không tìm thấy tài khoản nhân viên');

        // Check if there are other admins
        if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') {
            const adminCount = await prisma.user.count({
                where: {
                    role: { in: ['SUPER_ADMIN', 'ADMIN'] },
                    isActive: true,
                    id: { not: id },
                },
            });
            if (adminCount === 0) {
                throw new AppError(400, 'Không thể xóa Quản trị viên duy nhất của hệ thống');
            }
        }

        await prisma.venueStaff.deleteMany({ where: { userId: id } });
        await prisma.refreshToken.deleteMany({ where: { userId: id } });
        await prisma.user.delete({ where: { id } });

        return { success: true, message: `Đã xóa tài khoản ${user.name}` };
    },

    getRoles() {
        return {
            roles: ROLE_DEFINITIONS,
            modules: PERMISSION_MODULES,
        };
    },
};
