import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth.js';
import { processChat, ChatMessage } from '../services/chatbot.service.js';

const router = Router();

// Lưu trữ session đơn giản trong bộ nhớ (production nên dùng Redis)
const sessionStore = new Map<string, { messages: ChatMessage[]; updatedAt: Date }>();

function getProviderStatus(error: unknown): number | undefined {
    if (!error || typeof error !== 'object') return undefined;
    const providerError = error as {
        status?: unknown;
        statusCode?: unknown;
        response?: { status?: unknown };
    };
    const status = providerError.status ?? providerError.statusCode ?? providerError.response?.status;
    return typeof status === 'number' ? status : undefined;
}

function getProviderErrorReasons(error: unknown): string[] {
    if (!error || typeof error !== 'object') return [];
    const details = (error as { errorDetails?: unknown }).errorDetails;
    if (!Array.isArray(details)) return [];
    return details
        .filter((detail): detail is Record<string, unknown> => !!detail && typeof detail === 'object')
        .map((detail) => detail.reason)
        .filter((reason): reason is string => typeof reason === 'string');
}

function getProviderRetryAfterSeconds(error: unknown): number | undefined {
    if (!error || typeof error !== 'object') return undefined;
    const retryAfterSeconds = (error as { retryAfterSeconds?: unknown }).retryAfterSeconds;
    return typeof retryAfterSeconds === 'number' && Number.isFinite(retryAfterSeconds)
        ? retryAfterSeconds
        : undefined;
}

function formatRetryAfter(retryAfterSeconds: number): string {
    const totalMinutes = Math.ceil(retryAfterSeconds / 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours === 0) return `${minutes} phút`;
    if (minutes === 0) return `${hours} giờ`;
    return `${hours} giờ ${minutes} phút`;
}

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
        const { reply, updatedHistory, bookingCreated } = await processChat(message.trim(), history);

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
                bookingCreated,
            },
        });
    } catch (error: unknown) {
        const providerStatus = getProviderStatus(error);

        // Lỗi Gemini API key
        if (error instanceof Error && error.message.includes('GEMINI_API_KEY')) {
            return res.status(503).json({
                success: false,
                message: 'Chatbot AI chưa được cấu hình. Vui lòng liên hệ quản trị viên để thêm GEMINI_API_KEY vào .env',
            });
        }

        if (providerStatus === 429) {
            const retryAfterSeconds = getProviderRetryAfterSeconds(error);
            console.warn('[Chatbot] Gemini rate limit response', {
                status: providerStatus,
                reasons: getProviderErrorReasons(error),
                retryAfterSeconds,
            });
            if (retryAfterSeconds) res.setHeader('Retry-After', String(retryAfterSeconds));
            return res.status(429).json({
                success: false,
                message: retryAfterSeconds
                    ? `Gemini đang tạm từ chối yêu cầu của chatbot; điều này không nhất thiết có nghĩa là toàn bộ API bị lỗi. Nhà cung cấp báo thử lại sau khoảng ${formatRetryAfter(retryAfterSeconds)}. Quản trị viên nên kiểm tra giới hạn của model/project đang dùng.`
                    : 'Gemini đang tạm giới hạn yêu cầu chatbot. Vui lòng chờ một chút rồi thử lại.',
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
            model: 'gemini-3.6-flash',
            message: hasApiKey
                ? 'Chatbot AI sẵn sàng phục vụ 🏸'
                : 'Chưa cấu hình GEMINI_API_KEY',
        },
    });
});

export default router;
