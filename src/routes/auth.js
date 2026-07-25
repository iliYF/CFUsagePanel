/**
 * 认证路由处理器。
 * GET  /api/auth/token   — 获取临时访问 Token
 * POST /api/auth/login   — 管理员登录
 * POST /api/auth/logout  — 管理员登出
 * GET  /api/auth/status  — 检查登录状态
 */

import { jsonResponse } from '../utils/helpers.js';

/**
 * 判断 Turnstile 是否启用。
 * 需要 SITEKEY 和 SECRET 同时配置，与前端逻辑保持一致。
 */
function isTurnstileEnabled(env) {
    return !!(env.TURNSTILE_SITEKEY && env.TURNSTILE_SECRET);
}

/**
 * 验证 Turnstile Token。
 */
async function verifyTurnstile(token, secret, remoteIp) {
    const response = await fetch(
        'https://challenges.cloudflare.com/turnstile/v0/siteverify',
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                secret: secret,
                response: token,
                remoteip: remoteIp,
            }),
        }
    );
    const result = await response.json();
    return result.success === true;
}

/**
 * GET /api/auth/token
 * 基于 UA + hostname 返回临时访问 Token。
 * 同时下发 Turnstile 配置：sitekey 存在则前端启用验证组件。
 */
async function getToken(context) {
    const { tempToken, env } = context;
    return jsonResponse({
        success: true,
        data: {
            token: tempToken,
            turnstileSiteKey: isTurnstileEnabled(env) ? env.TURNSTILE_SITEKEY : null,
        },
    });
}

/**
 * POST /api/auth/login
 * 管理员登录，验证 Turnstile + 账号密码后设置 Cookie。
 */
async function login(context) {
    const { request, env, adminCookie, credentials, fullToken } = context;

    if (request.method !== 'POST') {
        return jsonResponse({ success: false, msg: 'Method Not Allowed' }, 405);
    }

    try {
        const body = await request.json();
        const inputUsername = body.username || '';
        const inputPassword = body.password || '';

        // Turnstile 验证：需同时配置 SITEKEY 和 SECRET 才启用
        if (isTurnstileEnabled(env)) {
            const turnstileSecret = env.TURNSTILE_SECRET;
            const turnstileToken = body['cf-turnstile-response'] || '';
            if (!turnstileToken) {
                return jsonResponse({ success: false, msg: '请先通过人机验证' }, 400);
            }
            const remoteIp = request.headers.get('CF-Connecting-IP')
                || request.headers.get('X-Forwarded-For')
                || '127.0.0.1';
            const valid = await verifyTurnstile(turnstileToken, turnstileSecret, remoteIp);
            if (!valid) {
                return jsonResponse({ success: false, msg: '人机验证失败，请重试' }, 400);
            }
        }

        if (inputUsername === credentials.username && inputPassword === credentials.password) {
            return new Response(
                JSON.stringify({
                    success: true,
                    msg: '登录成功',
                    data: { fullToken: fullToken },
                }),
                {
                    status: 200,
                    headers: {
                        'Content-Type': 'application/json;charset=UTF-8',
                        'Set-Cookie': `admin_token=${adminCookie}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400`,
                    },
                }
            );
        }

        return jsonResponse({ success: false, msg: '账号或密码错误' }, 401);
    } catch (e) {
        return jsonResponse({ success: false, msg: '请求格式错误' }, 400);
    }
}

/**
 * POST /api/auth/logout
 * 清除 admin_token Cookie。
 */
async function logout(context) {
    return new Response(
        JSON.stringify({ success: true, msg: '登出成功' }),
        {
            status: 200,
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
                'Set-Cookie': 'admin_token=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0',
            },
        }
    );
}

/**
 * GET /api/auth/status
 * 检查当前请求的认证状态。
 * 此处理器在中间件通过认证后调用，因此总是返回已认证。
 */
async function authStatus(context) {
    return jsonResponse({
        success: true,
        msg: '已认证',
        data: { username: context.credentials.username },
    });
}

export { getToken, login, logout, authStatus };
