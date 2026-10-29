import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { useAuthStore } from '@/stores/auth.store'

// Pages
import LoginPage from '@/pages/LoginPage'
import ForgotPasswordPage from '@/pages/ForgotPasswordPage'
import AdminRegisterPage from '@/pages/AdminRegisterPage'
import DashboardPage from '@/pages/DashboardPage'
import BookingCalendarPage from '@/pages/BookingCalendarPage'
import CustomersPage from '@/pages/CustomersPage'
import CustomerDetailPage from '@/pages/CustomerDetailPage'
import CourtsPage from '@/pages/CourtsPage'
import InvoicesPage from '@/pages/InvoicesPage'
import PrintInvoicePage from '@/pages/PrintInvoicePage'
import ReportsPage from '@/pages/ReportsPage'
import SettingsPage from '@/pages/SettingsPage'
import InventoryPage from '@/pages/InventoryPage'
import VenuesPage from '@/pages/VenuesPage'

// Layout
import { AppLayout } from '@/components/layout/AppLayout'

// AI Chatbot
import { ChatBotWidget } from '@/components/chatbot/ChatBotWidget'
import PortalPage from '@/pages/PortalPage'
import PortalBookingVisual from '@/pages/PortalBookingVisual'
import RegisterPage from '@/pages/RegisterPage'
import PortalLoginPage from '@/pages/PortalLoginPage'
import PortalForgotPasswordPage from '@/pages/PortalForgotPasswordPage'

import BookingRequestsPage from '@/pages/BookingRequestsPage'
import ExploreContentPage from '@/pages/ExploreContentPage'
import VenueReviewsPage from '@/pages/VenueReviewsPage'
import StaffPage from '@/pages/StaffPage'
import PortalLayout from '@/components/portal/PortalLayout'
import CheckInPage from '@/pages/CheckInPage'


function RoleGuard({ allowedRoles, children }: { allowedRoles: string[]; children: React.ReactNode }) {
    const { user } = useAuthStore()
    const role = user?.role || 'STAFF'
    if (!allowedRoles.includes(role)) {
        return <Navigate to={role === 'STAFF' ? '/calendar' : '/'} replace />
    }
    return <>{children}</>
}

function App() {
    const { isAuthenticated } = useAuthStore()

    return (
        <>
            <Routes>
                {/* Public routes */}
                <Route
                    path="/login"
                    element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />}
                />
                <Route
                    path="/forgot-password"
                    element={isAuthenticated ? <Navigate to="/" replace /> : <ForgotPasswordPage />}
                />
                <Route
                    path="/admin-register"
                    element={isAuthenticated ? <Navigate to="/" replace /> : <AdminRegisterPage />}
                />

                {/* Print routes - no layout */}
                <Route
                    path="/invoices/:id/print"
                    element={isAuthenticated ? <PrintInvoicePage /> : <Navigate to="/login" replace />}
                />

                {/* Alobo Clone Portal */}
                {/* Alobo Clone Portal Auth - No Bottom Nav */}
                <Route
                    path="/dang-ky"
                    element={<RegisterPage />}
                />

                <Route
                    path="/dang-nhap"
                    element={<PortalLoginPage />}
                />

                <Route
                    path="/client-forgot-password"
                    element={<PortalForgotPasswordPage />}
                />
                <Route path="/check-in/:token" element={<CheckInPage />} />

                {/* Alobo Clone Portal Layout */}
                <Route element={<PortalLayout />}>
                    <Route
                        path="/trang-chu"
                        element={<PortalPage />}
                    />
                    <Route
                        path="/dat-lich/:venueId"
                        element={<PortalBookingVisual />}
                    />
                    <Route
                        path="/dat-lich/:venueId/:courtId"
                        element={<PortalBookingVisual />}
                    />
                </Route>

                {/* Protected routes */}
                <Route
                    path="/*"
                    element={
                        isAuthenticated ? (
                            <AppLayout>
                                <Routes>
                                    <Route path="/" element={<RoleGuard allowedRoles={['SUPER_ADMIN', 'ADMIN', 'MANAGER']}><DashboardPage /></RoleGuard>} />
                                    <Route path="/calendar" element={<BookingCalendarPage />} />
                                    <Route path="/booking-requests" element={<BookingRequestsPage />} />
                                    <Route path="/customers" element={<CustomersPage />} />
                                    <Route path="/customers/:id" element={<CustomerDetailPage />} />
                                    <Route path="/courts" element={<RoleGuard allowedRoles={['SUPER_ADMIN', 'ADMIN', 'MANAGER']}><CourtsPage /></RoleGuard>} />
                                    <Route path="/invoices" element={<InvoicesPage />} />
                                    <Route path="/inventory" element={<InventoryPage />} />
                                    <Route path="/venues" element={<RoleGuard allowedRoles={['SUPER_ADMIN', 'ADMIN']}><VenuesPage /></RoleGuard>} />
                                    <Route path="/reports" element={<RoleGuard allowedRoles={['SUPER_ADMIN', 'ADMIN']}><ReportsPage /></RoleGuard>} />
                                    <Route path="/staff" element={<RoleGuard allowedRoles={['SUPER_ADMIN', 'ADMIN']}><StaffPage /></RoleGuard>} />
                                    <Route path="/settings" element={<RoleGuard allowedRoles={['SUPER_ADMIN', 'ADMIN']}><SettingsPage /></RoleGuard>} />
                                    <Route path="/explore-content" element={<RoleGuard allowedRoles={['SUPER_ADMIN', 'ADMIN']}><ExploreContentPage /></RoleGuard>} />
                                    <Route path="/venue-reviews" element={<RoleGuard allowedRoles={['SUPER_ADMIN', 'ADMIN', 'MANAGER']}><VenueReviewsPage /></RoleGuard>} />
                                    <Route path="*" element={<Navigate to="/" replace />} />
                                </Routes>
                            </AppLayout>
                        ) : (
                            <Navigate to="/login" replace />
                        )
                    }
                />
            </Routes>
            {isAuthenticated && <ChatBotWidget />}
            <Toaster />
        </>
    )
}

export default App
