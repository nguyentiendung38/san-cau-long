import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, KeyRound, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { authService } from '@/services/auth.service';

type Step = 'email' | 'reset';

export default function ForgotPasswordPage() {
    const navigate = useNavigate();
    const { toast } = useToast();
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [step, setStep] = useState<Step>('email');
    const [isLoading, setIsLoading] = useState(false);

    const handleRequestOtp = async (event: React.FormEvent) => {
        event.preventDefault();
        setIsLoading(true);
        try {
            const response = await authService.requestPasswordReset(email.trim());
            setStep('reset');
            toast({ title: 'Kiểm tra email của bạn', description: response.data?.message });
        } catch (error: any) {
            toast({
                title: 'Không thể gửi mã',
                description: error.response?.data?.message || 'Vui lòng thử lại sau',
                variant: 'error',
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleResetPassword = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!/^\d{6}$/.test(otp)) {
            toast({ title: 'Mã OTP phải gồm 6 chữ số', variant: 'error' });
            return;
        }
        if (newPassword.length < 8) {
            toast({ title: 'Mật khẩu mới phải có ít nhất 8 ký tự', variant: 'error' });
            return;
        }
        if (newPassword !== confirmPassword) {
            toast({ title: 'Mật khẩu nhập lại không khớp', variant: 'error' });
            return;
        }

        setIsLoading(true);
        try {
            const response = await authService.resetPassword(email.trim(), otp, newPassword);
            toast({ title: 'Đặt lại mật khẩu thành công', description: response.data?.message });
            navigate('/login');
        } catch (error: any) {
            toast({
                title: 'Không thể đặt lại mật khẩu',
                description: error.response?.data?.message || 'Mã OTP không hợp lệ hoặc đã hết hạn',
                variant: 'error',
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <Link
                    to="/login"
                    className="inline-flex items-center gap-2 text-foreground-secondary hover:text-foreground mb-8 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Quay lại đăng nhập
                </Link>

                <div className="bg-background-secondary border border-border rounded-2xl p-8 shadow-xl">
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-primary-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                            {step === 'email'
                                ? <Mail className="w-8 h-8 text-primary-500" />
                                : <KeyRound className="w-8 h-8 text-primary-500" />}
                        </div>
                        <h1 className="text-2xl font-bold text-foreground mb-2">
                            {step === 'email' ? 'Quên mật khẩu?' : 'Đặt lại mật khẩu'}
                        </h1>
                        <p className="text-foreground-secondary">
                            {step === 'email'
                                ? 'Nhập email tài khoản quản trị để nhận mã đặt lại mật khẩu'
                                : <>Nhập mã 6 số đã gửi đến <strong>{email}</strong> và mật khẩu mới</>}
                        </p>
                    </div>

                    {step === 'email' ? (
                        <form onSubmit={handleRequestOtp} className="space-y-4">
                            <Input
                                type="email"
                                value={email}
                                onChange={(event) => setEmail(event.target.value)}
                                placeholder="name@example.com"
                                label="Email"
                                required
                                disabled={isLoading}
                            />
                            <Button type="submit" className="w-full" disabled={isLoading}>
                                {isLoading ? 'Đang gửi mã...' : 'Gửi mã đặt lại mật khẩu'}
                            </Button>
                        </form>
                    ) : (
                        <form onSubmit={handleResetPassword} className="space-y-4">
                            <Input
                                type="text"
                                inputMode="numeric"
                                autoComplete="one-time-code"
                                value={otp}
                                onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                                placeholder="123456"
                                label="Mã OTP"
                                required
                                disabled={isLoading}
                            />
                            <div className="relative">
                                <Input
                                    type={showNewPassword ? 'text' : 'password'}
                                    autoComplete="new-password"
                                    value={newPassword}
                                    onChange={(event) => setNewPassword(event.target.value)}
                                    placeholder="Ít nhất 8 ký tự"
                                    label="Mật khẩu mới"
                                    required
                                    minLength={8}
                                    maxLength={72}
                                    disabled={isLoading}
                                    className="pr-10"
                                />
                                <button
                                    type="button"
                                    aria-label={showNewPassword ? 'Ẩn mật khẩu mới' : 'Hiện mật khẩu mới'}
                                    aria-pressed={showNewPassword}
                                    onClick={() => setShowNewPassword((visible) => !visible)}
                                    className="absolute right-3 top-[38px] text-foreground-muted hover:text-foreground"
                                >
                                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                            <div className="relative">
                                <Input
                                    type={showConfirmPassword ? 'text' : 'password'}
                                    autoComplete="new-password"
                                    value={confirmPassword}
                                    onChange={(event) => setConfirmPassword(event.target.value)}
                                    placeholder="Nhập lại mật khẩu mới"
                                    label="Xác nhận mật khẩu"
                                    required
                                    disabled={isLoading}
                                    className="pr-10"
                                />
                                <button
                                    type="button"
                                    aria-label={showConfirmPassword ? 'Ẩn mật khẩu xác nhận' : 'Hiện mật khẩu xác nhận'}
                                    aria-pressed={showConfirmPassword}
                                    onClick={() => setShowConfirmPassword((visible) => !visible)}
                                    className="absolute right-3 top-[38px] text-foreground-muted hover:text-foreground"
                                >
                                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                            <Button type="submit" className="w-full" disabled={isLoading}>
                                {isLoading ? 'Đang cập nhật...' : 'Đặt lại mật khẩu'}
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                className="w-full"
                                disabled={isLoading}
                                onClick={() => {
                                    setStep('email');
                                    setOtp('');
                                }}
                            >
                                Đổi email hoặc gửi mã mới
                            </Button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
