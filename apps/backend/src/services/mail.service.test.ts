import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mailService } from './mail.service.js';

const mailEnvironmentKeys = [
    'SMTP_HOST',
    'SMTP_PORT',
    'SMTP_SECURE',
    'SMTP_USER',
    'SMTP_PASS',
    'SMTP_FROM',
    'GMAIL_USER',
    'GMAIL_PASS',
] as const;

const originalEnvironment = new Map<string, string | undefined>();

describe('mailService.sendOTP', () => {
    beforeEach(() => {
        for (const key of mailEnvironmentKeys) {
            originalEnvironment.set(key, process.env[key]);
            delete process.env[key];
        }
    });

    afterEach(() => {
        for (const key of mailEnvironmentKeys) {
            const value = originalEnvironment.get(key);
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
        originalEnvironment.clear();
    });

    it('reports a missing sender configuration without exposing the OTP', async () => {
        await expect(mailService.sendOTP('customer@example.com', '123456'))
            .rejects.toMatchObject({ statusCode: 503 });
    });

    it('reports missing SMTP credentials without attempting a delivery', async () => {
        process.env.SMTP_FROM = 'courtify@example.com';

        await expect(mailService.sendOTP('customer@example.com', '123456'))
            .rejects.toMatchObject({ statusCode: 503 });
    });
});
