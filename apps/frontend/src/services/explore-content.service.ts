import api from './api';

export type ExploreContentType = 'EVENT' | 'COURSE' | 'NEWS' | 'DEAL' | 'PASS';

export interface ExploreContent {
    id: string;
    type: ExploreContentType;
    title: string;
    description?: string;
    imageUrl?: string;
    price?: string;
    badge?: string;
    metadata?: string; // JSON string
    isActive: boolean;
    sortOrder: number;
    startDate?: string;
    endDate?: string;
    createdAt: string;
    updatedAt: string;
}

export interface ExploreContentInput {
    type: ExploreContentType;
    title: string;
    description?: string;
    imageUrl?: string;
    price?: string;
    badge?: string;
    metadata?: Record<string, any>;
    isActive?: boolean;
    sortOrder?: number;
    startDate?: string;
    endDate?: string;
}

export const TYPE_LABELS: Record<ExploreContentType, string> = {
    EVENT: 'Sự kiện',
    COURSE: 'Khóa học',
    NEWS: 'Thông báo',
    DEAL: 'Ưu đãi',
    PASS: 'Pass sân',
};

export const TYPE_ICONS: Record<ExploreContentType, string> = {
    EVENT: '🎉',
    COURSE: '📖',
    NEWS: '🔔',
    DEAL: '🎁',
    PASS: '🎫',
};

// Admin API (authenticated)
export const exploreContentApi = {
    getAll: async (type?: ExploreContentType): Promise<ExploreContent[]> => {
        const params = type ? `?type=${type}` : '';
        const res = await api.get(`/explore-contents${params}`);
        return res.data.data;
    },

    create: async (data: ExploreContentInput): Promise<ExploreContent> => {
        const res = await api.post('/explore-contents', data);
        return res.data.data;
    },

    update: async (id: string, data: Partial<ExploreContentInput>): Promise<ExploreContent> => {
        const res = await api.put(`/explore-contents/${id}`, data);
        return res.data.data;
    },

    delete: async (id: string): Promise<void> => {
        await api.delete(`/explore-contents/${id}`);
    },
};

// Public API (no auth — for Portal)
export const exploreContentPublicApi = {
    getAll: async (type?: string): Promise<ExploreContent[]> => {
        const params = type ? `?type=${type}` : '';
        const res = await api.get(`/explore-contents/public${params}`);
        return res.data.data;
    },
};
