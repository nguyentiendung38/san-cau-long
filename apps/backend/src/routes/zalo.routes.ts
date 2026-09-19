import { Router, Request, Response } from 'express';
import { processChat, ChatMessage } from '../services/chatbot.service.js';
import { zaloService } from '../services/zalo.service.js';

const router = Router();

// Lưu trữ lịch sử chat Zalo tạm thời trong RAM (Nên dùng Redis cho thực tế)
const zaloSessionStore = new Map<string, { messages: ChatMessage[]; updatedAt: Date }>();

// Dọn dẹp session cũ sau 1 giờ
setInterval(() => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    for (const [userId, session] of zaloSessionStore.entries()) {
        if (session.updatedAt < oneHourAgo) {
            zaloSessionStore.delete(userId);
        }
    }
}, 30 * 60 * 1000);

// API GET: Dành cho Zalo verify Webhook (Zalo thỉnh thoảng sẽ gọi để xác thực)
router.get('/webhook', (req: Request, res: Response) => {
    // Trả về challenge string nếu Zalo yêu cầu
    return res.status(200).send('Zalo Webhook Courtify OK');
});

// API POST: Nhận sự kiện từ Zalo khi có người nhắn tin
router.post('/webhook', async (req: Request, res: Response) => {
    try {
        const event = req.body;

        // Chỉ xử lý sự kiện người dùng gửi tin nhắn text
        if (event.event_name === 'user_send_text') {
            const zaloUserId = event.sender?.id;
            const userMessage = event.message?.text;

            if (zaloUserId && userMessage) {
                // Phản hồi Zalo ngay lập tức bằng HTTP 200 để Zalo không gạch tên Webhook
                res.status(200).send('OK');

                // Lấy lịch sử chat của user này
                const existingSession = zaloSessionStore.get(zaloUserId);
                const history: ChatMessage[] = existingSession?.messages || [];

                // Đưa qua AI xử lý
                try {
                    const { reply, updatedHistory } = await processChat(userMessage, history);
                    
                    // Lưu lại lịch sử
                    zaloSessionStore.set(zaloUserId, {
                        messages: updatedHistory,
                        updatedAt: new Date(),
                    });

                    // Gửi tin nhắn trả lời qua Zalo
                    await zaloService.sendMessage(zaloUserId, reply);
                } catch (aiError) {
                    console.error('Lỗi xử lý AI cho Zalo:', aiError);
                    await zaloService.sendMessage(zaloUserId, 'Xin lỗi, hệ thống AI đang bận. Quý khách vui lòng gọi Hotline để đặt sân nhé.');
                }
                return;
            }
        }

        // Bỏ qua các event khác của Zalo (seen, received...)
        return res.status(200).send('OK');
    } catch (error) {
        console.error('Lỗi Zalo Webhook:', error);
        return res.status(500).send('Internal Server Error');
    }
});

export default router;
