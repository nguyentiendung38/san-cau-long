import api, { ApiResponse } from './api';

export interface PricingRule { id: string; venueId: string; name: string; description?: string; dayOfWeek?: string; startTime?: string; endTime?: string; pricePerHour: number; priority: number; isActive: boolean;
    pricingRules?: PricingRule[]; }

export interface VenueServiceItem {
    id: string;
    name: string;
    description?: string | null;
    price: number;
    unit: string;
}

export interface VenueProductItem {
    id: string;
    name: string;
    description?: string | null;
    price: number;
    stock: number;
    unit: string;
}

export interface Venue {
    id: string;
    name: string;
    address: string;
    phone?: string;
    email?: string;
    description?: string;
    termsAndServices?: string;
    bankCode?: string | null;
    bankAccountNumber?: string | null;
    bankAccountName?: string | null;
    logo?: string;
    images?: string[];
    openTime: string;
    closeTime: string;
    isActive: boolean;
    ratingAverage?: number | null;
    reviewCount?: number;
    courts?: Court[];
    operatingHours?: any[];
    pricingRules?: PricingRule[];
    services?: VenueServiceItem[];
    products?: VenueProductItem[];
    _count?: {
        courts: number;
        staff: number;
        pricingRules?: number;
    };
}

export interface CreateVenueInput {
    name: string;
    address: string;
    phone?: string;
    email?: string;
    description?: string;
    termsAndServices?: string;
    bankCode?: string | null;
    bankAccountNumber?: string | null;
    bankAccountName?: string | null;
    logo?: string;
    images?: string[];
    openTime: string;
    closeTime: string;
}

export interface Court {
    id: string;
    venueId: string;
    name: string;
    description?: string;
    surfaceType?: string;
    isIndoor: boolean;
    status: 'ACTIVE' | 'MAINTENANCE' | 'INACTIVE';
    sortOrder: number;
}

export interface PaginatedResponse<T> {
    data: T[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

export const venueApi = {
    async getAll(params?: {
        search?: string;
        isActive?: boolean;
        page?: number;
        limit?: number;
    }): Promise<PaginatedResponse<Venue>> {
        const queryParams = new URLSearchParams();
        if (params?.search) queryParams.append('search', params.search);
        if (params?.isActive !== undefined) queryParams.append('isActive', String(params.isActive));
        if (params?.page) queryParams.append('page', String(params.page));
        if (params?.limit) queryParams.append('limit', String(params.limit));

        const response = await api.get<ApiResponse<Venue[]> & { pagination: any }>(
            `/venues?${queryParams}`
        );
        return {
            data: response.data.data || [],
            pagination: response.data.pagination,
        };
    },

    async getById(id: string): Promise<Venue & { courts: Court[] }> {
        const response = await api.get<ApiResponse<Venue & { courts: Court[] }>>(`/venues/${id}`);
        return response.data.data!;
    },

    async create(input: Partial<Venue>): Promise<Venue> {
        const response = await api.post<ApiResponse<Venue>>('/venues', input);
        return response.data.data!;
    },

    async update(id: string, input: Partial<Venue>): Promise<Venue> {
        const response = await api.put<ApiResponse<Venue>>(`/venues/${id}`, input);
        return response.data.data!;
    },

    async delete(id: string): Promise<void> {
        await api.delete(`/venues/${id}`);
    },
    async getAvailability(venueId: string, date: string): Promise<{ courts: Court[]; bookings: any[] }> {
        const response = await api.get('/venues/' + venueId + '/availability?date=' + date);
        return response.data.data;
    }
};

export const courtApi = {
    async getByVenue(venueId: string): Promise<Court[]> {
        const response = await api.get<ApiResponse<Court[]>>(`/courts/venue/${venueId}`);
        return response.data.data || [];
    },

    async create(input: Partial<Court>): Promise<Court> {
        const response = await api.post<ApiResponse<Court>>('/courts', input);
        return response.data.data!;
    },

    async update(id: string, input: Partial<Court>): Promise<Court> {
        const response = await api.put<ApiResponse<Court>>(`/courts/${id}`, input);
        return response.data.data!;
    },

    async delete(id: string): Promise<void> {
        await api.delete(`/courts/${id}`);
    },
    async createMaintenanceClosure(input: {
        courtId: string;
        startAt: string;
        endAt: string;
        reason?: string;
        closureType?: 'MAINTENANCE' | 'TOURNAMENT';
    }) {
        const response = await api.post<ApiResponse<any>>('/courts/maintenance-closures', input);
        return response.data.data!;
    },
    async deleteMaintenanceClosure(id: string): Promise<void> {
        await api.delete(`/courts/maintenance-closures/${id}`);
    },
};

export default { venueApi, courtApi };
