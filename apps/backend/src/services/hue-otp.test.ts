import { describe, expect, it } from 'vitest';
import { portalAuthService } from './portal-auth.service.js';

describe('portalAuthService Hue Student Verification via @hce.edu.vn', () => {
    it('rejects invalid MSSV format', async () => {
        await expect(
            portalAuthService.requestHueOtp('test-id', {
                studentId: '123',
                email: '123@hce.edu.vn',
                faculty: 'Khoa Hệ thống thông tin kinh tế',
            })
        ).rejects.toThrow('Mã số sinh viên không đúng định dạng');
    });

    it('rejects email not ending with @hce.edu.vn', async () => {
        await expect(
            portalAuthService.requestHueOtp('test-id', {
                studentId: '21K4080123',
                email: '21k4080123@gmail.com',
                faculty: 'Khoa Hệ thống thông tin kinh tế',
            })
        ).rejects.toThrow('Email sinh viên không hợp lệ');
    });

    it('rejects empty faculty', async () => {
        await expect(
            portalAuthService.requestHueOtp('test-id', {
                studentId: '21K4080123',
                email: '21k4080123@hce.edu.vn',
                faculty: '',
            })
        ).rejects.toThrow('Vui lòng chọn Khoa / Viện');
    });
});

