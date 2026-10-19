import api, { ApiResponse } from './api';

export type VenueReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface VenueReview {
    id: string;
    venueId: string;
    customerName: string;
    customerPhone?: string;
    rating: number;
    content: string;
    images: string[];
    status: VenueReviewStatus;
    createdAt: string;
    isLegacy?: boolean;
    venue?: { id: string; name: string };
}

export interface CreateVenueReviewInput {
    bookingId: string;
    rating: number;
    content: string;
    images: string[];
}

export interface EligibleReviewBooking {
    id: string;
    date: string;
    startTime: string;
    endTime: string;
    court: { id: string; name: string; venue: { id: string; name: string } };
}

export interface VenueReviewSummary {
    venueId: string;
    ratingAverage: number | null;
    reviewCount: number;
}

export const venueReviewApi = {
    async getPublicSummaries(venueIds: string[]): Promise<VenueReviewSummary[]> {
        if (venueIds.length === 0) return [];
        const response = await api.get<ApiResponse<VenueReviewSummary[]>>('/venue-reviews/public-summary', {
            params: { venueIds: venueIds.join(',') },
        });
        return response.data.data || [];
    },

    async getPublic(venueId: string): Promise<VenueReview[]> {
        const response = await api.get<ApiResponse<VenueReview[]>>(
            `/venue-reviews/public/${encodeURIComponent(venueId)}`,
        );
        return response.data.data || [];
    },

    async createPublic(input: CreateVenueReviewInput): Promise<VenueReview> {
        const token = localStorage.getItem('portalUserToken');
        const response = await api.post<ApiResponse<VenueReview>>('/venue-reviews/public', input, {
            headers: { Authorization: `****** || ''}` },
        });
        return response.data.data!;
    },

    async getEligibleBookings(): Promise<EligibleReviewBooking[]> {
        const token = localStorage.getItem('portalUserToken');
        const response = await api.get<ApiResponse<EligibleReviewBooking[]>>('/venue-reviews/public/eligible', {
            headers: { Authorization: `****** || ''}` },
        });
        return response.data.data || [];
    },

    async getAll(): Promise<VenueReview[]> {
        const response = await api.get<ApiResponse<VenueReview[]>>('/venue-reviews');
        return response.data.data || [];
    },

    async updateStatus(id: string, status: VenueReviewStatus): Promise<VenueReview> {
        const response = await api.patch<ApiResponse<VenueReview>>(
            `/venue-reviews/${encodeURIComponent(id)}/status`,
            { status },
        );
        return response.data.data!;
    },
};
