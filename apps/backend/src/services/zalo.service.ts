import axios from 'axios';

const ZALO_API_URL = 'https://openapi.zalo.me/v3.0/oa/message/cs';

export const zaloService = {
    /**
     * Gửi tin nhắn văn bản lại cho người dùng qua Zalo OA
     */
    async sendMessage(userId: string, text: string): Promise<boolean> {
        const accessToken = process.env.ZALO_OA_ACCESS_TOKEN;
        
        if (!accessToken) {
            console.error('LỖI: Chưa cấu hình ZALO_OA_ACCESS_TOKEN');
            return false;
        }

        try {
            const response = await axios.post(
                ZALO_API_URL,
                {
                    recipient: { user_id: userId },
                    message: { text: text }
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'access_token': accessToken
                    }
                }
            );

            if (response.data.error) {
                console.error('Lỗi từ Zalo API:', response.data.message);
                return false;
            }

            return true;
        } catch (error: any) {
            console.error('Lỗi khi gọi Zalo API:', error.message);
            return false;
        }
    }
};
