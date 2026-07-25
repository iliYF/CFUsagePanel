/**
 * Cloudflare Workers 入口。
 * 路由分发 + 认证中间件 + scheduled 触发器。
 *
 * 静态资源（HTML/CSS/JS）由 Cloudflare Assets 自动处理，
 * Worker 只处理 /api/* 路径。
 */

import { corsResponse, jsonResponse } from './utils/helpers.js';
import {
    parseCredentials,
    generateAdminToken,
    generateAdminCookie,
    generateTempToken,
    verifyAdminCookie,
} from './utils/auth.js';
import { handleScheduled } from './scheduled.js';

import { getUsage } from './routes/usage.js';
import { getToken, login, logout, authStatus } from './routes/auth.js';
import { addAccount, deleteAccount, checkAccount, updateAccount } from './routes/accounts.js';
import { getConfig, refreshAdminUsage } from './routes/admin.js';

/**
 * 路由表定义。
 * 每个路由包含：method, path, handler, auth（可选）。
 */
const ROUTES = [
    // 公开
    { method: 'GET', path: '/api/auth/token', handler: getToken },
    { method: 'GET', path: '/api/usage', handler: getUsage },
    { method: 'POST', path: '/api/auth/login', handler: login },

    // 管理员（需 cookie 认证）
    { method: 'POST', path: '/api/auth/logout', handler: logout, auth: 'admin' },
    { method: 'GET', path: '/api/auth/status', handler: authStatus, auth: 'admin' },
    { method: 'POST', path: '/api/accounts/add', handler: addAccount, auth: 'admin' },
    { method: 'POST', path: '/api/accounts/del', handler: deleteAccount, auth: 'admin' },
    { method: 'POST', path: '/api/accounts/update', handler: updateAccount, auth: 'admin' },
    { method: 'POST', path: '/api/accounts/check', handler: checkAccount, auth: 'admin' },
    { method: 'GET', path: '/api/admin/config', handler: getConfig, auth: 'admin' },
    { method: 'GET', path: '/api/admin/usage', handler: refreshAdminUsage, auth: 'admin' },
    { method: 'POST', path: '/api/admin/usage', handler: refreshAdminUsage, auth: 'admin' },
];

/**
 * 将请求路径匹配到路由表。
 */
function matchRoute(routes, pathname, method) {
    for (const route of routes) {
        if (route.method !== method) continue;
        if (pathname === route.path) {
            return route;
        }
    }
    return null;
}

export default {
    /**
     * HTTP 请求入口。
     */
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        // CORS 预检
        if (request.method === 'OPTIONS') {
            return corsResponse();
        }

        // 非 /api/* 路径：由 Cloudflare Assets 处理
        if (!url.pathname.startsWith('/api/')) {
            return new Response('Not Found', { status: 404 });
        }

        // 解析凭证并生成 Token/Cookie
        const credentials = parseCredentials(env);
        const userAgent = request.headers.get('User-Agent') || 'unknown';
        const adminToken = await generateAdminToken(credentials.password, credentials.username);
        const adminCookie = await generateAdminCookie(adminToken, userAgent);
        const tempToken = await generateTempToken(url.hostname, adminToken, userAgent);

        // 验证密码是否配置
        if (!credentials.password) {
            return new Response('请先在变量中设置 PASSWORD 变量', { status: 500 });
        }

        // 验证 KV 绑定
        if (!env.KV || typeof env.KV.get !== 'function') {
            return new Response('请先绑定一个KV命名空间到变量KV', { status: 500 });
        }

        // 路由匹配
        const route = matchRoute(ROUTES, url.pathname, request.method);
        if (!route) {
            return new Response('Not Found', { status: 404 });
        }

        // 构建上下文
        const context = {
            request,
            env,
            ctx,
            url,
            adminToken,
            adminCookie,
            tempToken,
            credentials,
            isDemo: credentials.isDemo,
        };

        try {
            // 管理员认证中间件
            if (route.auth === 'admin') {
                const authResult = verifyAdminCookie(request, adminCookie);
                if (authResult) return authResult;
            }

            return await route.handler(context);
        } catch (error) {
            console.error(`[${route.method} ${route.path}] Error:`, error.message);
            return jsonResponse({ success: false, msg: error.message }, 500);
        }
    },

    /**
     * 定时任务触发器。
     */
    async scheduled(event, env, ctx) {
        ctx.waitUntil(handleScheduled(env));
    },
};
