import { api } from './api'

export interface ChatResponse {
    reply: string
    sessionId: string
    messageCount: number
}

export interface ChatStatusResponse {
    isAvailable: boolean
    model: string
    message: string
}

export const chatbotService = {
    async sendMessage(message: string, sessionId?: string): Promise<ChatResponse> {
        const { data } = await api.post('/chatbot/message', { message, sessionId })
        return data.data
    },

    async getStatus(): Promise<ChatStatusResponse> {
        const { data } = await api.get('/chatbot/status')
        return data.data
    },

    async clearSession(sessionId: string): Promise<void> {
        await api.delete(`/chatbot/session/${sessionId}`)
    },
}
