import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { staffService } from '../services/staff.service.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

// Validation Schemas
const createStaffSchema = z.object({
    name: z.string().min(2, 'Tên nhân viên phải có ít nhất 2 ký tự'),
    email: z.string().email('Email không đúng định dạng'),
    phone: z.string().optional(),
    password: z.string().min(6, 'Mật khẩu phải có ít nhất 6 ký tự'),
    role: z.enum(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'STAFF']),
    venueIds: z.array(z.string()).optional(),
    isActive: z.boolean().optional(),
});

const updateStaffSchema = z.object({
    name: z.string().min(2, 'Tên nhân viên phải có ít nhất 2 ký tự').optional(),
    phone: z.string().optional().nullable(),
    password: z.string().min(6, 'Mật khẩu phải có ít nhất 6 ký tự').optional().or(z.literal('')),
    role: z.enum(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'STAFF']).optional(),
    venueIds: z.array(z.string()).optional(),
    isActive: z.boolean().optional(),
});

// All staff management routes require authenticate and ADMIN or SUPER_ADMIN role
router.use(authenticate);

// Get predefined roles & permissions matrix (all authenticated staff can view permissions)
router.get('/roles', (req: Request, res: Response) => {
    res.json({
        success: true,
        data: staffService.getRoles(),
    });
});

// List all staff (ADMIN, SUPER_ADMIN, MANAGER)
router.get('/', authorize('SUPER_ADMIN', 'ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { search, role, isActive, venueId } = req.query;
        const staffList = await staffService.getAll({
            search: search as string,
            role: role as string,
            isActive: isActive as string,
            venueId: venueId as string,
        });

        res.json({
            success: true,
            data: staffList,
        });
    } catch (err) {
        next(err);
    }
});

// Get single staff member
router.get('/:id', authorize('SUPER_ADMIN', 'ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const staff = await staffService.getById(req.params.id);
        res.json({
            success: true,
            data: staff,
        });
    } catch (err) {
        next(err);
    }
});

// Create new staff member (ADMIN, SUPER_ADMIN)
router.post('/', authorize('SUPER_ADMIN', 'ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = createStaffSchema.parse(req.body);
        const newStaff = await staffService.create(data);
        res.status(201).json({
            success: true,
            message: `Tạo tài khoản nhân viên ${newStaff.name} thành công`,
            data: newStaff,
        });
    } catch (err) {
        next(err);
    }
});

// Update staff member (ADMIN, SUPER_ADMIN)
router.put('/:id', authorize('SUPER_ADMIN', 'ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = updateStaffSchema.parse(req.body);
        const updated = await staffService.update(req.params.id, data, req.user!.userId);
        res.json({
            success: true,
            message: `Cập nhật thông tin nhân viên ${updated.name} thành công`,
            data: updated,
        });
    } catch (err) {
        next(err);
    }
});

// Toggle status active/inactive (ADMIN, SUPER_ADMIN)
router.patch('/:id/status', authorize('SUPER_ADMIN', 'ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await staffService.toggleStatus(req.params.id, req.user!.userId);
        res.json({
            success: true,
            message: `${result.isActive ? 'Kích hoạt' : 'Tạm khóa'} tài khoản ${result.name} thành công`,
            data: result,
        });
    } catch (err) {
        next(err);
    }
});

// Delete staff member (SUPER_ADMIN, ADMIN)
router.delete('/:id', authorize('SUPER_ADMIN', 'ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await staffService.delete(req.params.id, req.user!.userId);
        res.json({
            success: true,
            message: result.message,
        });
    } catch (err) {
        next(err);
    }
});

export default router;

