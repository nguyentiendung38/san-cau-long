import api from './api';

export const portalAuthApi = {
    async requestOtp(data: any) {
        const response = await api.post('/portal-auth/register-otp', data);
        return response.data;
    },
    async verifyOtp(data: any) {
        const response = await api.post('/portal-auth/verify-register', data);
        return response.data;
    },
    async register(data: any) {
        const response = await api.post('/portal-auth/register', data);
        return response.data;
    },
    async login(data: any) {
        const response = await api.post('/portal-auth/login', data);
        return response.data;
    },
    async forgotPasswordOtp(data: { email: string }) {
        const response = await api.post('/portal-auth/forgot-password-otp', data);
        return response.data;
    },
    async resetPassword(data: any) {
        const response = await api.post('/portal-auth/reset-password', data);
        return response.data;
    }
};
