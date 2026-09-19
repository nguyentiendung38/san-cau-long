import { useState, useRef, useEffect, useCallback, KeyboardEvent } from 'react'
import { MessageCircle, X, Send, RotateCcw, Bot, User, Loader2, Sparkles } from 'lucide-react'
import { chatbotService } from '@/services/chatbot.service'

interface Message {
    id: string
    role: 'user' | 'bot'
    content: string
    timestamp: Date
}

export function ChatBotWidget() {
    const [isOpen, setIsOpen] = useState(false)
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [sessionId, setSessionId] = useState<string | undefined>()
    const [isAvailable, setIsAvailable] = useState<boolean | null>(null)
    const [hasNewMessage, setHasNewMessage] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLTextAreaElement>(null)

    // Kiểm tra trạng thái chatbot khi mount
    useEffect(() => {
        chatbotService.getStatus()
            .then((status) => setIsAvailable(status.isAvailable))
            .catch(() => setIsAvailable(false))
    }, [])

    // Auto-scroll xuống cuối khi có tin nhắn mới
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    // Focus input khi mở chat
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 300)
            setHasNewMessage(false)
        }
    }, [isOpen])

    // Thêm welcome message khi mở lần đầu
    useEffect(() => {
        if (isOpen && messages.length === 0) {
            setMessages([
                {
                    id: 'welcome',
                    role: 'bot',
                    content:
                        'Xin chào! 🏸 Tôi là **Courtify AI**, trợ lý đặt sân cầu lông thông minh.\n\nTôi có thể giúp bạn:\n• 📅 Đặt sân cầu lông\n• 🔍 Kiểm tra lịch trống\n• 💰 Xem bảng giá\n• 📋 Tra cứu lịch đặt\n\nHãy cho tôi biết bạn cần gì nhé!',
                    timestamp: new Date(),
                },
            ])
        }
    }, [isOpen, messages.length])

    const sendMessage = useCallback(async () => {
        const trimmed = input.trim()
        if (!trimmed || isLoading) return

        // Thêm tin nhắn user
        const userMsg: Message = {
            id: `user-${Date.now()}`,
            role: 'user',
            content: trimmed,
            timestamp: new Date(),
        }
        setMessages((prev) => [...prev, userMsg])
        setInput('')
        setIsLoading(true)

        try {
            const response = await chatbotService.sendMessage(trimmed, sessionId)

            setSessionId(response.sessionId)

            const botMsg: Message = {
                id: `bot-${Date.now()}`,
                role: 'bot',
                content: response.reply,
                timestamp: new Date(),
            }
            setMessages((prev) => [...prev, botMsg])

            // Nếu chat đang đóng, hiện badge
            if (!isOpen) setHasNewMessage(true)
        } catch (error: any) {
            const errorMessage =
                error.response?.data?.message ||
                'Xin lỗi, có lỗi xảy ra. Vui lòng thử lại sau.'
            const errorMsg: Message = {
                id: `error-${Date.now()}`,
                role: 'bot',
                content: `⚠️ ${errorMessage}`,
                timestamp: new Date(),
            }
            setMessages((prev) => [...prev, errorMsg])
        } finally {
            setIsLoading(false)
        }
    }, [input, isLoading, sessionId, isOpen])

    const sendQuickMessage = useCallback((text: string) => {
        if (isLoading) return
        setInput('')
        // Directly create user message and call API
        const userMsg: Message = {
            id: `user-${Date.now()}`,
            role: 'user',
            content: text,
            timestamp: new Date(),
        }
        setMessages((prev) => [...prev, userMsg])
        setIsLoading(true)
        chatbotService.sendMessage(text, sessionId)
            .then((response) => {
                setSessionId(response.sessionId)
                const botMsg: Message = {
                    id: `bot-${Date.now()}`,
                    role: 'bot',
                    content: response.reply,
                    timestamp: new Date(),
                }
                setMessages((prev) => [...prev, botMsg])
            })
            .catch((error: any) => {
                const errorMessage = error.response?.data?.message || 'Xin lỗi, có lỗi xảy ra.'
                setMessages((prev) => [...prev, {
                    id: `error-${Date.now()}`,
                    role: 'bot',
                    content: `⚠️ ${errorMessage}`,
                    timestamp: new Date(),
                }])
            })
            .finally(() => setIsLoading(false))
    }, [isLoading, sessionId])

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            sendMessage()
        }
    }

    const clearChat = async () => {
        if (sessionId) {
            try {
                await chatbotService.clearSession(sessionId)
            } catch { /* ignore */ }
        }
        setMessages([])
        setSessionId(undefined)
    }

    // Render markdown đơn giản (bold, list)
    const renderContent = (text: string) => {
        const lines = text.split('\n')
        return lines.map((line, i) => {
            // Bold
            let processed = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            // Bullet points
            if (processed.startsWith('• ') || processed.startsWith('- ')) {
                return (
                    <div key={i} className="flex gap-1.5 ml-1">
                        <span className="text-green-500 shrink-0">•</span>
                        <span dangerouslySetInnerHTML={{ __html: processed.slice(2) }} />
                    </div>
                )
            }
            // Empty line
            if (processed.trim() === '') return <div key={i} className="h-2" />
            return <div key={i} dangerouslySetInnerHTML={{ __html: processed }} />
        })
    }

    // Không render nếu chatbot không available
    if (isAvailable === false) return null

    return (
        <>
            {/* ======================== CHAT WINDOW ======================== */}
            {isOpen && (
                <div className="fixed bottom-20 right-4 z-50 w-[380px] max-w-[calc(100vw-2rem)] h-[560px] max-h-[calc(100vh-8rem)] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 duration-300">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-4 py-3 flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
                                <Bot className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h3 className="text-white font-semibold text-sm leading-tight">Courtify AI</h3>
                                <div className="flex items-center gap-1">
                                    <div className="w-1.5 h-1.5 rounded-full bg-green-300 animate-pulse" />
                                    <span className="text-green-100 text-xs">Trực tuyến</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={clearChat}
                                className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                                title="Làm mới hội thoại"
                            >
                                <RotateCcw className="w-4 h-4 text-white" />
                            </button>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                                title="Đóng"
                            >
                                <X className="w-4 h-4 text-white" />
                            </button>
                        </div>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-50">
                        {messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                {msg.role === 'bot' && (
                                    <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center shrink-0 mt-0.5">
                                        <Sparkles className="w-3.5 h-3.5 text-green-600" />
                                    </div>
                                )}
                                <div
                                    className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                                        msg.role === 'user'
                                            ? 'bg-green-600 text-white rounded-br-md'
                                            : 'bg-white text-gray-800 shadow-sm border border-gray-100 rounded-bl-md'
                                    }`}
                                >
                                    {msg.role === 'bot' ? renderContent(msg.content) : msg.content}
                                </div>
                                {msg.role === 'user' && (
                                    <div className="w-7 h-7 rounded-full bg-green-600 flex items-center justify-center shrink-0 mt-0.5">
                                        <User className="w-3.5 h-3.5 text-white" />
                                    </div>
                                )}
                            </div>
                        ))}

                        {/* Loading indicator */}
                        {isLoading && (
                            <div className="flex gap-2 justify-start">
                                <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                                    <Sparkles className="w-3.5 h-3.5 text-green-600" />
                                </div>
                                <div className="bg-white rounded-2xl rounded-bl-md px-4 py-3 shadow-sm border border-gray-100">
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-2 h-2 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                        <div className="w-2 h-2 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                        <div className="w-2 h-2 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                    </div>
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* Quick Actions */}
                    {messages.length <= 1 && (
                        <div className="px-3 py-2 bg-gray-50 border-t border-gray-100 flex gap-1.5 flex-wrap">
                            {[
                                '📅 Đặt sân hôm nay',
                                '🔍 Xem lịch trống',
                                '💰 Xem bảng giá',
                                '📋 Tra cứu lịch đặt',
                            ].map((q) => (
                                <button
                                    key={q}
                                    onClick={() => sendQuickMessage(q)}
                                    className="text-xs bg-white border border-gray-200 rounded-full px-2.5 py-1 hover:bg-green-50 hover:border-green-300 hover:text-green-700 transition-colors"
                                >
                                    {q}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Input area */}
                    <div className="p-3 bg-white border-t border-gray-200 shrink-0">
                        <div className="flex items-end gap-2">
                            <textarea
                                ref={inputRef}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Nhập tin nhắn..."
                                rows={1}
                                className="flex-1 resize-none rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent max-h-20 bg-gray-50"
                                style={{
                                    minHeight: '40px',
                                    height: 'auto',
                                }}
                                onInput={(e) => {
                                    const target = e.target as HTMLTextAreaElement
                                    target.style.height = 'auto'
                                    target.style.height = `${Math.min(target.scrollHeight, 80)}px`
                                }}
                                disabled={isLoading}
                            />
                            <button
                                onClick={sendMessage}
                                disabled={isLoading || !input.trim()}
                                className="p-2.5 rounded-xl bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
                            >
                                {isLoading ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Send className="w-4 h-4" />
                                )}
                            </button>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-1.5 text-center">
                            Powered by Gemini AI • Enter để gửi
                        </p>
                    </div>
                </div>
            )}

            {/* ======================== FLOATING BUTTON ======================== */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`fixed bottom-4 right-4 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 hover:scale-110 ${
                    isOpen
                        ? 'bg-gray-600 hover:bg-gray-700 rotate-0'
                        : 'bg-gradient-to-br from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700'
                }`}
                title={isOpen ? 'Đóng chat' : 'Chat với AI'}
            >
                {isOpen ? (
                    <X className="w-6 h-6 text-white" />
                ) : (
                    <>
                        <MessageCircle className="w-6 h-6 text-white" />
                        {hasNewMessage && (
                            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                                <span className="text-[10px] text-white font-bold">!</span>
                            </span>
                        )}
                        {/* Pulse effect */}
                        <span className="absolute inset-0 rounded-full bg-green-400 animate-ping opacity-20" />
                    </>
                )}
            </button>
        </>
    )
}
