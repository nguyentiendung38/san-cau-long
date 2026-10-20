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
    async login(data: any) {
        const response = await api.post('/portal-auth/login', data);
        return response.data;
    },
    async getMe() {
        const token = localStorage.getItem('portalUserToken');
        const response = await api.get('/portal-auth/me', {
            headers: { Authorization: `Bearer ${token || ''}` },
        });
        return response.data.data;
    },
    async getFavorites(): Promise<{ venueIds: string[]; courtIds: string[] }> {
        const token = localStorage.getItem('portalUserToken');
        const response = await api.get('/portal-auth/favorites', {
            headers: { Authorization: `****** || ''}` },
        });
        return response.data.data;
    },
    async setFavoriteVenue(venueId: string, favorite: boolean, token: string) {
        if (!token) {
            throw new Error('Vui lòng đăng nhập để tiếp tục');
        }
        const response = await api.put(`/portal-auth/favorites/venues/${venueId}`, { favorite }, {
            headers: { Authorization: `****** || ''}` },
        });
        return response.data.data;
    },
    async setFavoriteCourt(courtId: string, favorite: boolean) {
        const token = localStorage.getItem('portalUserToken');
        const response = await api.put(`/portal-auth/favorites/courts/${courtId}`, { favorite }, {
            headers: { Authorization: `****** || ''}` },
        });
        return response.data.data;
    },
    async forgotPasswordOtp(data: { email: string }) {
        const response = await api.post('/portal-auth/forgot-password-otp', data);
        return response.data;
    },
    async resetPassword(data: any) {
        const response = await api.post('/portal-auth/reset-password', data);
        return response.data;
    },
        async requestHueOtp(data: { studentId: string; faculty: string; email: string }) {
        const token = localStorage.getItem('portalUserToken');
        const response = await api.post('/portal-auth/request-hue-otp', data, {
            headers: { Authorization: `Bearer ${token || ''}` },
        });
        return response.data;
    },
    async verifyHueOtp(data: { studentId: string; faculty: string; email: string; otp: string; customerType?: string }) {
        const token = localStorage.getItem('portalUserToken');
        const response = await api.post('/portal-auth/verify-hue-otp', data, {
            headers: { Authorization: `Bearer ${token || ''}` },
        });
        return response.data;
    },
    async verifyHue(data: { studentId: string; faculty: string; customerType?: string }) {
        const token = localStorage.getItem('portalUserToken');
        const response = await api.post('/portal-auth/verify-hue', data, {
            headers: { Authorization: `Bearer ${token || ''}` },
        });
        return response.data;
    }
};
