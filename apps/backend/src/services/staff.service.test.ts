import { describe, expect, it } from 'vitest';
import { staffService } from './staff.service.js';

describe('staffService RBAC & Permission definitions', () => {
    it('returns role definitions and permission modules', () => {
        const rolesData = staffService.getRoles();
        expect(rolesData).toBeDefined();
        expect(rolesData.roles).toHaveLength(4);
        expect(rolesData.roles.map(r => r.key)).toEqual(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'STAFF']);
        expect(rolesData.modules.length).toBeGreaterThan(0);
    });

    it('defines correct access rights for STAFF', () => {
        const rolesData = staffService.getRoles();
        const courtModule = rolesData.modules.find(m => m.module === 'Lịch & Đặt sân');
        expect(courtModule).toBeDefined();

        const checkInAction = courtModule?.actions.find(a => a.name.includes('Check-in'));
        expect(checkInAction?.staff).toBe(true);

        const cancelAction = courtModule?.actions.find(a => a.name.includes('Hủy'));
        expect(cancelAction?.staff).toBe(false);
    });

    it('restricts pricing and reporting from normal STAFF', () => {
        const rolesData = staffService.getRoles();
        const pricingModule = rolesData.modules.find(m => m.module.includes('Bảng giá'));
        expect(pricingModule).toBeDefined();
        for (const action of pricingModule?.actions || []) {
            expect(action.staff).toBe(false);
        }
    });
});

