import api from './api';

export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'STAFF';

export interface StaffVenue {
    venueId: string;
    role: string;
    venue: {
        id: string;
        name: string;
        address?: string;
    };
}

export interface StaffUser {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
    avatar?: string | null;
    role: UserRole;
    isActive: boolean;
    lastLoginAt?: string | null;
    createdAt: string;
    venues: StaffVenue[];
}

export interface RoleDefinition {
    key: UserRole;
    name: string;
    badgeColor: string;
    description: string;
    permissions: string[];
}

export interface PermissionAction {
    name: string;
    superAdmin: boolean;
    admin: boolean;
    manager: boolean;
    staff: boolean;
}

export interface PermissionModule {
    module: string;
    actions: PermissionAction[];
}

export interface RolesAndPermissionsResponse {
    roles: RoleDefinition[];
    modules: PermissionModule[];
}

export interface CreateStaffPayload {
    name: string;
    email: string;
    phone?: string;
    password: string;
    role: UserRole;
    venueIds?: string[];
    isActive?: boolean;
}

export interface UpdateStaffPayload {
    name?: string;
    phone?: string | null;
    password?: string;
    role?: UserRole;
    venueIds?: string[];
    isActive?: boolean;
}

export const staffApi = {
    async getAll(params?: { search?: string; role?: string; isActive?: string; venueId?: string }): Promise<StaffUser[]> {
        const res = await api.get('/staff', { params });
        return res.data.data;
    },

    async getRoles(): Promise<RolesAndPermissionsResponse> {
        const res = await api.get('/staff/roles');
        return res.data.data;
    },

    async getById(id: string): Promise<StaffUser> {
        const res = await api.get(`/staff/${id}`);
        return res.data.data;
    },

    async create(data: CreateStaffPayload): Promise<StaffUser> {
        const res = await api.post('/staff', data);
        return res.data.data;
    },

    async update(id: string, data: UpdateStaffPayload): Promise<StaffUser> {
        const res = await api.put(`/staff/${id}`, data);
        return res.data.data;
    },

    async toggleStatus(id: string): Promise<{ id: string; name: string; isActive: boolean }> {
        const res = await api.patch(`/staff/${id}/status`);
        return res.data.data;
    },

    async delete(id: string): Promise<{ message: string }> {
        const res = await api.delete(`/staff/${id}`);
        return res.data;
    },
};

