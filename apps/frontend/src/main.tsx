import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { I18nProvider } from './i18n'
import App from './App'
import './index.css'

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60 * 5, // 5 minutes
            retry: (failureCount, error: any) => {
                const status = error?.response?.status;
                if ([400, 401, 403, 404, 409, 429].includes(status)) return false;
                return failureCount < 1;
            },
            refetchOnWindowFocus: false,
        },
    },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <QueryClientProvider client={queryClient}>
            <BrowserRouter>
                <I18nProvider>
                    <App />
                </I18nProvider>
            </BrowserRouter>
        </QueryClientProvider>
    </React.StrictMode>,
)

