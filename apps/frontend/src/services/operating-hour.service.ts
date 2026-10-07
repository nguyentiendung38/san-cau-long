import { api } from './api.js';

export interface OperatingHour {
    id: string;
    venueId: string;
    startTime: string;
    endTime: string;
    daysOfWeek: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface OperatingHourQueryParams {
    venueId?: string;
    isActive?: boolean;
}

export interface CreateOperatingHourInput {
    venueId: string;
    startTime: string;
    endTime: string;
    daysOfWeek: string;
    isActive?: boolean;
}

export interface UpdateOperatingHourInput {
    startTime?: string;
    endTime?: string;
    daysOfWeek?: string;
    isActive?: boolean;
}

class OperatingHourService {
    private readonly basePath = '/operating-hours';

    async getAll(params?: OperatingHourQueryParams) {
        const res = await api.get<{ status: string; data: OperatingHour[] }>(this.basePath, { params });
        return res.data;
    }

    async getById(id: string) {
        const res = await api.get<{ status: string; data: OperatingHour }>(`${this.basePath}/${id}`);
        return res.data;
    }

    async create(data: CreateOperatingHourInput) {
        const res = await api.post<{ status: string; data: OperatingHour }>(this.basePath, data);
        return res.data;
    }

    async update(id: string, data: UpdateOperatingHourInput) {
        const res = await api.put<{ status: string; data: OperatingHour }>(`${this.basePath}/${id}`, data);
        return res.data;
    }

    async delete(id: string) {
        const res = await api.delete<{ status: string; message: string }>(`${this.basePath}/${id}`);
        return res.data;
    }
}

export const operatingHourApi = new OperatingHourService();
