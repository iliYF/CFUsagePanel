import {
    env,
    createExecutionContext,
    waitOnExecutionContext,
} from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import worker from '../src';

// 构建测试环境变量，确保 PASSWORD 和 KV 可用
const testEnv = {
    ...env,
    PASSWORD: 'test-password',
    KV: {
        get: async () => null,
        put: async () => {},
    },
};

describe('cf-usage Worker', () => {
    describe('GET /api/auth/token', () => {
        it('returns a temporary token', async () => {
            const request = new Request('http://example.com/api/auth/token');
            const ctx = createExecutionContext();
            const response = await worker.fetch(request, testEnv, ctx);
            await waitOnExecutionContext(ctx);
            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.data.token).toBeDefined();
        });
    });

    describe('GET /api/usage', () => {
        it('returns 403 without valid token', async () => {
            const request = new Request('http://example.com/api/usage');
            const ctx = createExecutionContext();
            const response = await worker.fetch(request, testEnv, ctx);
            await waitOnExecutionContext(ctx);
            expect(response.status).toBe(403);
        });
    });

    describe('GET /api/auth/status', () => {
        it('returns 401 without admin cookie', async () => {
            const request = new Request('http://example.com/api/auth/status');
            const ctx = createExecutionContext();
            const response = await worker.fetch(request, testEnv, ctx);
            await waitOnExecutionContext(ctx);
            expect(response.status).toBe(401);
        });
    });

    describe('OPTIONS preflight', () => {
        it('returns CORS headers for /api/usage', async () => {
            const request = new Request('http://example.com/api/usage', {
                method: 'OPTIONS',
            });
            const ctx = createExecutionContext();
            const response = await worker.fetch(request, testEnv, ctx);
            await waitOnExecutionContext(ctx);
            expect(response.status).toBe(204);
            expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
        });
    });

    describe('non-API paths', () => {
        it('returns 404 for unknown paths', async () => {
            const request = new Request('http://example.com/unknown');
            const ctx = createExecutionContext();
            const response = await worker.fetch(request, testEnv, ctx);
            await waitOnExecutionContext(ctx);
            expect(response.status).toBe(404);
        });
    });

    describe('POST /api/auth/login', () => {
        it('returns 400 for invalid JSON body', async () => {
            const request = new Request('http://example.com/api/auth/login', {
                method: 'POST',
                body: 'not-json',
            });
            const ctx = createExecutionContext();
            const response = await worker.fetch(request, testEnv, ctx);
            await waitOnExecutionContext(ctx);
            expect(response.status).toBe(400);
        });

        it('returns 401 for wrong password', async () => {
            const request = new Request('http://example.com/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: 'admin',
                    password: 'wrong-password',
                }),
            });
            const ctx = createExecutionContext();
            const response = await worker.fetch(request, testEnv, ctx);
            await waitOnExecutionContext(ctx);
            expect(response.status).toBe(401);
            const data = await response.json();
            expect(data.success).toBe(false);
        });

        it('returns 200 for correct credentials', async () => {
            const request = new Request('http://example.com/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: 'admin',
                    password: 'test-password',
                }),
            });
            const ctx = createExecutionContext();
            const response = await worker.fetch(request, testEnv, ctx);
            await waitOnExecutionContext(ctx);
            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.success).toBe(true);
        });
    });

    describe('POST /api/auth/logout', () => {
        it('returns 401 without admin cookie', async () => {
            const request = new Request('http://example.com/api/auth/logout', {
                method: 'POST',
            });
            const ctx = createExecutionContext();
            const response = await worker.fetch(request, testEnv, ctx);
            await waitOnExecutionContext(ctx);
            expect(response.status).toBe(401);
        });
    });

    describe('GET /api/admin/config', () => {
        it('returns 401 without admin cookie', async () => {
            const request = new Request('http://example.com/api/admin/config');
            const ctx = createExecutionContext();
            const response = await worker.fetch(request, testEnv, ctx);
            await waitOnExecutionContext(ctx);
            expect(response.status).toBe(401);
        });
    });

    describe('POST /api/accounts/add', () => {
        it('returns 401 without admin cookie', async () => {
            const request = new Request('http://example.com/api/accounts/add', {
                method: 'POST',
            });
            const ctx = createExecutionContext();
            const response = await worker.fetch(request, testEnv, ctx);
            await waitOnExecutionContext(ctx);
            expect(response.status).toBe(401);
        });
    });
});
