import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '@/stores/auth.store'

const API_URL = import.meta.env.VITE_API_URL || '/api'

let refreshPromise: Promise<string> | null = null

export const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
})

// Request interceptor - add auth token
api.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
        const isPortalCustomerRequest =
            config.url?.startsWith('/portal-auth/me') ||
            config.url?.startsWith('/portal-auth/favorites') ||
            config.url?.startsWith('/venue-reviews/public/eligible') ||
            config.url === '/venue-reviews/public'

        if (isPortalCustomerRequest) {
            const portalToken = localStorage.getItem('portalUserToken')
            if (portalToken) {
                config.headers.Authorization = `Bearer ${portalToken}`
            } else {
                delete config.headers.Authorization
            }
            return config
        }

        const token = useAuthStore.getState().accessToken
        if (token && !config.headers.Authorization) {
            config.headers.Authorization = `Bearer ${token}`
        }
        return config
    },
    (error) => Promise.reject(error)
)

// Response interceptor - handle token refresh
api.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }
        const authState = useAuthStore.getState()
        const isAuthRequest = originalRequest?.url?.includes('/auth/login') ||
            originalRequest?.url?.includes('/auth/register') ||
            originalRequest?.url?.includes('/portal-auth/') ||
            originalRequest?.url?.includes('/booking-requests/public') ||
            originalRequest?.url?.includes('/venue-reviews/public/eligible')

        // Refresh once for concurrent requests instead of rotating the same refresh token repeatedly.
        if (
            error.response?.status === 401 &&
            originalRequest &&
            !originalRequest._retry &&
            !isAuthRequest &&
            authState.accessToken &&
            authState.refreshToken
        ) {
            originalRequest._retry = true

            if (!refreshPromise) {
                refreshPromise = axios.post(`${API_URL}/auth/refresh`, {
                    refreshToken: authState.refreshToken,
                }).then((response) => {
                    const { accessToken, refreshToken: newRefreshToken } = response.data.data
                    useAuthStore.getState().updateTokens(accessToken, newRefreshToken)
                    return accessToken
                }).catch((refreshError) => {
                    const status = axios.isAxiosError(refreshError) ? refreshError.response?.status : undefined
                    if (status !== 429) {
                        useAuthStore.getState().logout()
                    }
                    throw refreshError
                }).finally(() => {
                    refreshPromise = null
                })
            }

            const accessToken = await refreshPromise
            originalRequest.headers.Authorization = `Bearer ${accessToken}`
            return api(originalRequest)
        }

        return Promise.reject(error)
    }
)

// API response type
export interface ApiResponse<T> {
    success: boolean
    message?: string
    data?: T
    errors?: Array<{ field: string; message: string }>
}

export default api
