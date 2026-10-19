import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../config/database.js';
import { config } from '../config/index.js';

interface PortalCustomerPayload {
    id: string;
    role: 'CUSTOMER';
}

declare global {
    namespace Express {
        interface Request {
            portalCustomer?: { id: string; phone: string };
        }
    }
}

export const authenticatePortalCustomer = async (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: 'Vui lòng đăng nhập để tiếp tục' });
    }

    let payload: PortalCustomerPayload;
    try {
        const decoded = jwt.verify(authHeader.slice(7), config.jwt.secret);
        if (
            typeof decoded === 'string' ||
            typeof decoded.id !== 'string' ||
            decoded.role !== 'CUSTOMER'
        ) {
            return res.status(401).json({ success: false, message: 'Phiên đăng nhập khách hàng không hợp lệ' });
        }
        payload = { id: decoded.id, role: 'CUSTOMER' };
    } catch {
        return res.status(401).json({ success: false, message: 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại' });
    }

    try {
        const customer = await prisma.customer.findUnique({
            where: { id: payload.id },
            select: { id: true, phone: true, isActive: true },
        });
        if (!customer || !customer.isActive) {
            return res.status(401).json({ success: false, message: 'Tài khoản khách hàng không còn hoạt động' });
        }

        req.portalCustomer = { id: customer.id, phone: customer.phone };
        next();
    } catch (error) {
        next(error);
    }
};
