/**
 * Usage 数据路由处理器。
 * GET /api/usage — 获取用量数据。
 *
 * Token 分级：
 *   tempToken（基础 Scope）— 仅返回总览数据，不包含 KV/D1/R2 细节。
 *   fullToken / adminToken（完整 Scope）— 返回含资源细节的完整数据。
 */

import { jsonResponse, normalizeUsage } from '../utils/helpers.js';
import { getAccountCheckInterval } from '../services/usage.js';
import { demoUsage } from '../demo/data.js';

/**
 * GET /api/usage?token=xxx
 * 处理 usage.json 数据请求。
 * 支持 adminToken 或 tempToken。
 * DEMO 模式下返回演示数据（来自 src/demo/usage.json）。
 */
async function getUsage(context) {
    const { url, env, adminToken, tempToken, fullToken, isDemo } = context;
    const token = url.searchParams.get('token');

    if (token !== tempToken && token !== adminToken && token !== fullToken) {
        return jsonResponse({ success: false, msg: '无效TOKEN' }, 403);
    }

    const isBasicScope = (token === tempToken);

    // DEMO 模式：直接返回演示数据
    if (isDemo) {
        const data = { ...demoUsage, UpdateTime: Date.now() };
        return jsonResponse(data);
    }

    const currentTime = Date.now();
    const savedUsage = await env.KV.get('usage.json', { type: 'json' });
    const savedUpdateTime = Number(savedUsage?.UpdateTime || 0) || 0;

    let usageJson = normalizeUsage(savedUsage || {});
    usageJson.success = true;
    usageJson.total = (usageJson.pages || 0) + (usageJson.workers || 0);
    usageJson.msg = '成功加载免费额度使用数据';

    if (!savedUpdateTime || (currentTime - savedUpdateTime) > getAccountCheckInterval(env)) {
        const { refreshUsage } = await import('../services/usage.js');
        usageJson = await refreshUsage(env);
    }

    // 基础 Scope Token：移除资源细节，仅保留总览数据
    if (isBasicScope) {
        delete usageJson.resources;
    }

    return jsonResponse(usageJson);
}

export { getUsage };
