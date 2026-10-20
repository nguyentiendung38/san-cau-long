import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Mail, Lock, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuthStore } from '@/stores/auth.store'
import { authService } from '@/services/auth.service'
import { useToast } from '@/hooks/use-toast'

const loginSchema = z.object({
    email: z.string().email('Email không hợp lệ'),
    password: z.string().min(6, 'Mật khẩu phải có ít nhất 6 ký tự'),
})

type LoginForm = z.infer<typeof loginSchema>

export default function LoginPage() {
    const [showPassword, setShowPassword] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const navigate = useNavigate()
    const { login } = useAuthStore()
    const { toast } = useToast()

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<LoginForm>({
        resolver: zodResolver(loginSchema),
    })

    const onSubmit = async (data: LoginForm) => {
        setIsLoading(true)
        try {
            const response = await authService.login(data)
            if (response.success && response.data) {
                login(response.data.user, response.data.accessToken, response.data.refreshToken)
                toast({
                    title: 'Đăng nhập thành công',
                    variant: 'success',
                })
                navigate('/')
            }
        } catch (error: any) {
            toast({
                title: 'Đăng nhập thất bại',
                description: error.response?.data?.message || 'Đã xảy ra lỗi',
                variant: 'error',
            })
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="h-screen max-h-screen flex overflow-hidden">
            {/* Left - Hero with Campus Showcase */}
            <div className="hidden lg:flex lg:w-1/2 p-6 xl:p-8 flex-col justify-between relative overflow-hidden bg-gradient-to-br from-[#063d2c] via-[#085a3c] to-[#04281c] text-white">
                {/* Decorative background glow */}
                <div className="absolute -right-20 -top-20 w-80 h-80 rounded-full bg-emerald-400/10 blur-3xl pointer-events-none" />
                <div className="absolute -left-20 -bottom-20 w-80 h-80 rounded-full bg-lime-400/10 blur-3xl pointer-events-none" />

                {/* Header Logo */}
                <div className="flex items-center gap-3 relative z-10">
                    <img src="/logo-hue.jpg" alt="Logo Trường Đại học Kinh tế Huế" className="w-11 h-11 rounded-full object-contain bg-white p-0.5 shadow-md border-2 border-white/40" />
                    <div>
                        <span className="text-xl font-black text-white tracking-tight block">SÂN CẦU LÔNG HUẾ</span>
                        <span className="text-xs font-semibold text-lime-300 tracking-wider uppercase">Trường Đại học Kinh tế Huế</span>
                    </div>
                </div>

                {/* Prominent Campus Photo Showcase - 100% rõ nét, không bị che khuất */}
                <div className="relative z-10 my-2 xl:my-3">
                    <div className="overflow-hidden rounded-2xl border border-white/30 bg-white/10 p-1.5 shadow-xl backdrop-blur-md">
                        <img
                            src="/nha-thi-dau-hue.jpg"
                            alt="Nhà Thi Đấu Đa Năng HUE - Gắn kết để phát triển"
                            className="w-full h-36 xl:h-44 object-cover rounded-xl shadow-md transition-transform duration-500 hover:scale-[1.01]"
                        />
                        <div className="mt-2 px-1.5 flex items-center justify-between text-[11px]">
                            <span className="font-bold text-white flex items-center gap-1">
                                🏟️ Nhà Thi Đấu Đa Năng HUE
                            </span>
                            <span className="font-semibold text-lime-300 bg-black/40 px-2 py-0.5 rounded-full border border-lime-300/30">
                                Gắn kết để phát triển
                            </span>
                        </div>
                    </div>
                </div>

                {/* Bottom System Info & Stats */}
                <div className="relative z-10 bg-black/35 rounded-2xl p-3.5 xl:p-4 border border-white/20 backdrop-blur-md shadow-lg">
                    <div className="flex items-center justify-between mb-1.5">
                        <h2 className="text-sm font-extrabold text-white">
                            Hệ Thống Quản Lý Sân Cầu Lông HUE
                        </h2>
                        <span className="text-[10px] font-bold text-lime-300 bg-white/10 px-2 py-0.5 rounded-full">
                            Khu Thể Thao Trường
                        </span>
                    </div>
                    <p className="text-[11px] text-emerald-100/85 leading-snug mb-2.5 line-clamp-2">
                        Quản lý toàn diện đặt sân, thanh toán và vận hành cơ sở thể thao trường Đại học Kinh tế Huế.
                    </p>
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/15 text-center">
                        <div>
                            <p className="text-lg xl:text-xl font-black text-lime-300 leading-tight">500+</p>
                            <p className="text-[10px] text-white/70">Khách hàng</p>
                        </div>
                        <div>
                            <p className="text-lg xl:text-xl font-black text-lime-300 leading-tight">50+</p>
                            <p className="text-[10px] text-white/70">Sân hoạt động</p>
                        </div>
                        <div>
                            <p className="text-lg xl:text-xl font-black text-lime-300 leading-tight">10K+</p>
                            <p className="text-[10px] text-white/70">Lượt đặt</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right - Form */}
            <div className="flex-1 flex items-center justify-center p-6 bg-background overflow-y-auto">
                <div className="w-full max-w-md">
                    {/* Mobile logo */}
                    <div className="lg:hidden flex flex-col items-center gap-3 mb-6 justify-center">
                        <div className="flex items-center gap-3">
                            <img src="/logo-hue.jpg" alt="Logo Trường Đại học Kinh tế Huế" className="w-12 h-12 rounded-full object-contain bg-white p-0.5 shadow-md border border-slate-200" />
                            <div>
                                <span className="text-xl font-black text-emerald-700 block">SÂN CẦU LÔNG HUẾ</span>
                                <span className="text-xs text-slate-500 font-medium">Trường Đại học Kinh tế Huế</span>
                            </div>
                        </div>
                        {/* Mobile Campus Card */}
                        <div className="w-full mt-2 overflow-hidden rounded-xl border border-slate-200 shadow-sm bg-white p-1">
                            <img
                                src="/nha-thi-dau-hue.jpg"
                                alt="Nhà Thi Đấu Đa Năng HUE"
                                className="w-full h-36 object-cover rounded-lg"
                            />
                            <p className="text-[11px] text-center text-slate-600 font-semibold py-1">
                                🏟️ Nhà Thi Đấu Đa Năng HUE · Gắn kết để phát triển
                            </p>
                        </div>
                    </div>

                    <div className="mb-4">
                        <h2 className="text-2xl font-black text-foreground">Đăng nhập</h2>
                        <p className="text-foreground-secondary mt-2">
                            Nhập thông tin tài khoản để truy cập hệ thống
                        </p>
                    </div>

                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5">
                        <Input
                            label="Email"
                            type="email"
                            placeholder="admin@gmail.com"
                            icon={<Mail className="w-4 h-4" />}
                            error={errors.email?.message}
                            {...register('email')}
                        />

                        <div className="relative">
                            <Input
                                label="Mật khẩu"
                                type={showPassword ? 'text' : 'password'}
                                placeholder="••••••••"
                                icon={<Lock className="w-4 h-4" />}
                                error={errors.password?.message}
                                {...register('password')}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-[38px] text-foreground-muted hover:text-foreground transition-colors"
                            >
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>

                        <div className="flex items-center justify-between">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="w-4 h-4 rounded border-border bg-background-secondary text-primary-500 focus:ring-primary-500"
                                />
                                <span className="text-sm text-foreground-secondary">Ghi nhớ đăng nhập</span>
                            </label>
                            <Link to="/forgot-password" className="text-sm text-primary-500 hover:underline">
                                Quên mật khẩu?
                            </Link>
                        </div>

                        <Button
                            type="submit"
                            className="w-full"
                            size="lg"
                            isLoading={isLoading}
                        >
                            Đăng nhập
                        </Button>
                    </form>

                </div>
            </div>
        </div>
    )
}
