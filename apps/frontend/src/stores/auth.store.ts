import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface User {
    id: string
    email: string
    name: string
    role: string
}

interface AuthState {
    user: User | null
    accessToken: string | null
    refreshToken: string | null
    isAuthenticated: boolean

    // Actions
    login: (user: User, accessToken: string, refreshToken: string) => void
    logout: () => void
    updateTokens: (accessToken: string, refreshToken: string) => void
}

const AUTH_STORAGE_KEY = 'courtify-auth'

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            user: null,
            accessToken: null,
            refreshToken: null,
            isAuthenticated: false,

            login: (user, accessToken, refreshToken) => {
                set({
                    user,
                    accessToken,
                    refreshToken,
                    isAuthenticated: true,
                })
            },

            logout: () => {
                set({
                    user: null,
                    accessToken: null,
                    refreshToken: null,
                    isAuthenticated: false,
                })

                try {
                    useAuthStore.persist?.clearStorage()
                } catch {
                    // no-op: fallback below
                }

                if (typeof window !== 'undefined') {
                    window.localStorage.removeItem(AUTH_STORAGE_KEY)
                    window.sessionStorage.removeItem(AUTH_STORAGE_KEY)
                }
            },

            updateTokens: (accessToken, refreshToken) => {
                set({ accessToken, refreshToken })
            },
        }),
        {
            name: AUTH_STORAGE_KEY,
            partialize: (state) => ({
                user: state.user,
                accessToken: state.accessToken,
                refreshToken: state.refreshToken,
                isAuthenticated: state.isAuthenticated,
            }),
        }
    )
)
