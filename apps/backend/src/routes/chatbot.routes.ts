import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth.js';
import { processChat, ChatMessage } from '../services/chatbot.service.js';

const router = Router();

// Lưu trữ session đơn giản trong bộ nhớ (production nên dùng Redis)
const sessionStore = new Map<string, { messages: ChatMessage[]; updatedAt: Date }>();

// Dọn session cũ mỗi 30 phút
setInterval(() => {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    for (const [key, session] of sessionStore.entries()) {
        if (session.updatedAt < thirtyMinutesAgo) {
            sessionStore.delete(key);
        }
    }
}, 15 * 60 * 1000);

// POST /chatbot/message — Gửi tin nhắn và nhận phản hồi
router.post('/message', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { message, sessionId } = req.body;

        if (!message || typeof message !== 'string' || message.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Tin nhắn không được để trống',
            });
        }

        if (message.trim().length > 1000) {
            return res.status(400).json({
                success: false,
                message: 'Tin nhắn quá dài (tối đa 1000 ký tự)',
            });
        }

        // Lấy hoặc tạo session. Public thì dùng session ID random nếu user ko gửi lên
        const sid = sessionId || `guest-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        const existingSession = sessionStore.get(sid);
        const history: ChatMessage[] = existingSession?.messages || [];

        // Xử lý tin nhắn
        const { reply, updatedHistory } = await processChat(message.trim(), history);

        // Lưu session
        sessionStore.set(sid, {
            messages: updatedHistory,
            updatedAt: new Date(),
        });

        return res.json({
            success: true,
            data: {
                reply,
                sessionId: sid,
                messageCount: updatedHistory.length,
            },
        });
    } catch (error: any) {
        // Lỗi Gemini API key
        if (error.message?.includes('GEMINI_API_KEY')) {
            return res.status(503).json({
                success: false,
                message: 'Chatbot AI chưa được cấu hình. Vui lòng liên hệ quản trị viên để thêm GEMINI_API_KEY vào .env',
            });
        }

        // Lỗi API quota
        if (error.status === 429) {
            return res.status(429).json({
                success: false,
                message: 'Chatbot đang bận, vui lòng thử lại sau vài giây',
            });
        }

        next(error);
    }
});

// DELETE /chatbot/session/:sessionId — Xóa session (reset chat)
router.delete('/session/:sessionId', (req: Request, res: Response) => {
    const { sessionId } = req.params;
    sessionStore.delete(sessionId);
    return res.json({
        success: true,
        message: 'Đã xóa lịch sử hội thoại',
    });
});

// GET /chatbot/status — Kiểm tra chatbot có hoạt động không
router.get('/status', (req: Request, res: Response) => {
    const hasApiKey = !!process.env.GEMINI_API_KEY;
    return res.json({
        success: true,
        data: {
            isAvailable: hasApiKey,
            model: 'gemini-1.5-pro',
            message: hasApiKey
                ? 'Chatbot AI sẵn sàng phục vụ 🏸'
                : 'Chưa cấu hình GEMINI_API_KEY',
        },
    });
});

export default router;
