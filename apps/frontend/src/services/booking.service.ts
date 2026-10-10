import api, { ApiResponse } from './api';

// Types
export interface Booking {
    id: string;
    courtId: string;
    customerId?: string;
    date: string;
    startTime: string;
    endTime: string;
    status: 'PENDING' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
    totalAmount: number;
    notes?: string;
    voucherCode?: string;
    discountAmount?: number;
    orderedItems?: string;
    paymentMethod?: string;
    paymentStatus?: string;
    paymentAmount?: number;
    paymentProof?: string;
    invoiceItem?: any;
    isRecurring?: boolean;
    recurringGroup?: string;
    createdAt: string;
    updatedAt?: string;
    checkedInAt?: string;
    checkedOutAt?: string;
    court: {
        id: string;
        name: string;
        venue?: { id: string; name: string };
    };
    customer?: {
        id: string;
        name: string;
        phone: string;
        membershipTier?: string;
    };
    createdBy?: {
        id: string;
        name: string;
    };
}

export interface Court {
    id: string;
    name: string;
    status: string;
    sortOrder: number;
}

export interface CalendarData {
    courts: Court[];
    bookings: Booking[];
}

export interface CreateBookingInput {
    courtId: string;
    customerId?: string;
    date: string;
    startTime: string;
    endTime: string;
    notes?: string;
    voucherCode?: string;
    discountAmount?: number;
}

export interface PricingResult {
    pricePerHour: number;
    duration: number;
    total: number;
    appliedRule?: string;
}

export interface AvailabilityResult {
    available: boolean;
    conflicts: Array<{
        id: string;
        startTime: string;
        endTime: string;
        status: string;
    }>;
}

// API functions
export const bookingApi = {
    // Get calendar data for a venue
    async getCalendarData(venueId: string, startDate: string, endDate: string): Promise<CalendarData> {
        const response = await api.get<ApiResponse<CalendarData>>(
            `/bookings/calendar/${venueId}?startDate=${startDate}&endDate=${endDate}`
        );
        return response.data.data!;
    },

    // Check availability
    async checkAvailability(
        courtId: string,
        date: string,
        startTime: string,
        endTime: string
    ): Promise<AvailabilityResult> {
        const response = await api.get<ApiResponse<AvailabilityResult>>(
            `/bookings/check-availability?courtId=${courtId}&date=${date}&startTime=${startTime}&endTime=${endTime}`
        );
        return response.data.data!;
    },

    // Calculate price
    async calculatePrice(
        courtId: string,
        date: string,
        startTime: string,
        endTime: string
    ): Promise<PricingResult> {
        const response = await api.get<ApiResponse<PricingResult>>(
            `/bookings/calculate-price?courtId=${courtId}&date=${date}&startTime=${startTime}&endTime=${endTime}`
        );
        return response.data.data!;
    },

    // Create booking
    async create(input: CreateBookingInput): Promise<{ booking: Booking; pricing: PricingResult }> {
        const response = await api.post<ApiResponse<{ booking: Booking; pricing: PricingResult }>>(
            '/bookings',
            input
        );
        return response.data.data!;
    },

    // Update booking
    async update(id: string, input: Partial<CreateBookingInput>): Promise<Booking> {
        const response = await api.put<ApiResponse<Booking>>(`/bookings/${id}`, input);
        return response.data.data!;
    },

    // Cancel booking
    async cancel(id: string, reason?: string): Promise<Booking> {
        const response = await api.post<ApiResponse<Booking>>(`/bookings/${id}/cancel`, { reason });
        return response.data.data!;
    },

    // Check-in
    async checkIn(id: string): Promise<Booking> {
        const response = await api.post<ApiResponse<Booking>>(`/bookings/${id}/check-in`);
        return response.data.data!;
    },

    // Check-out
    async checkOut(id: string): Promise<Booking> {
        const response = await api.post<ApiResponse<Booking>>(`/bookings/${id}/check-out`);
        return response.data.data!;
    },

    // Get single booking
    async getById(id: string): Promise<Booking> {
        const response = await api.get<ApiResponse<Booking>>(`/bookings/${id}`);
        return response.data.data!;
    },
};

export default bookingApi;

export interface BookingRequest {
    id: string;
    venueId: string;
    courtId?: string;
    name: string;
    phone: string;
    date: string;
    startTime: string;
    endTime: string;
    notes?: string;
    voucherCode?: string;
    discountAmount?: number;
    status: string;
    paymentMethod?: 'MOMO' | 'VNPAY' | 'DEPOSIT_TRANSFER';
    paymentStatus?: 'PENDING' | 'PAID' | 'FAILED';
    paymentAmount?: number;
    paymentProof?: string;
    orderedItems?: string;
    voucherCode?: string;
    discountAmount?: number;
    venue?: { name: string };
    court?: { name: string };
    createdAt: string;
}

export const bookingRequestApi = {
    async createPublic(input: Partial<BookingRequest>): Promise<BookingRequest> {
        const response = await api.post<ApiResponse<BookingRequest>>('/booking-requests/public', input);
        return response.data.data!;
    },
    async getMyRequests(phone: string): Promise<any[]> {
        const response = await api.get<ApiResponse<any[]>>(
            `/booking-requests/public/my-requests?phone=${encodeURIComponent(phone.trim())}`
        );
        return response.data.data!;
    },
    async getAll(venueId?: string): Promise<BookingRequest[]> {
        const url = venueId ? `/booking-requests?venueId=${venueId}` : '/booking-requests';
        const response = await api.get<ApiResponse<BookingRequest[]>>(url);
        return response.data.data!;
    },
    async updateStatus(id: string, status: string): Promise<BookingRequest> {
        const response = await api.put<ApiResponse<BookingRequest>>(`/booking-requests/${id}/status`, { status });
        return response.data.data!;
    },
    async updatePaymentStatus(id: string, paymentStatus: 'PAID' | 'FAILED', paymentAmount?: number): Promise<BookingRequest> {
        const response = await api.patch<ApiResponse<BookingRequest>>(`/booking-requests/${id}/payment-status`, { paymentStatus, paymentAmount });
        return response.data.data!;
    },
    async delete(id: string): Promise<void> {
        await api.delete(`/booking-requests/${id}`);
    },
    async createMomoPayment(requestId: string, amount: number): Promise<{ payUrl: string }> {
        const response = await api.post<{ success: boolean; payUrl: string }>('/momo/create-payment', {
            orderId: requestId,
            amount,
        });
        return { payUrl: response.data.payUrl };
    },
    async createVnpayPayment(requestId: string, amount: number, bankCode?: string): Promise<{ payUrl: string }> {
        const response = await api.post<{ success: boolean; payUrl: string }>('/vnpay/create-payment', {
            orderId: requestId,
            amount,
            bankCode
        });
        return { payUrl: response.data.payUrl };
    }
};