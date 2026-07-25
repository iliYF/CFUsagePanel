/**
 * 管理面板路由处理器。
 * GET  /api/admin/config — 获取管理配置（账号列表，敏感字段掩码）
 * GET  /api/admin/usage  — 获取用量汇总
 * POST /api/admin/usage  — 触发用量刷新
 *
 * DEMO 模式：通过设置 DEMO 环境变量启用演示数据（来自 src/demo/）。
 */

import { jsonResponse, maskSensitiveInfo, normalizeAccountUsage } from '../utils/helpers.js';
import { getAccountLastUpdateTime, refreshUsage } from '../services/usage.js';
import { demoConfig, demoUsage } from '../demo/data.js';

/**
 * GET /api/admin/config
 * 返回所有已配置的 CF 账号列表，敏感字段已掩码处理。
 * DEMO 模式下返回 src/demo/usage_config.json 的演示账号。
 */
async function getConfig(context) {
    const { env, isDemo } = context;

    if (isDemo) {
        const maskedConfig = demoConfig.map((item) => {
            const updateTime = getAccountLastUpdateTime(item);
            return {
                ...item,
                UpdateTime: updateTime || item.UpdateTime,
                Usage: normalizeAccountUsage(item),
                GlobalAPIKey: item.GlobalAPIKey ? maskSensitiveInfo(item.GlobalAPIKey) : null,
                APIToken: item.APIToken ? maskSensitiveInfo(item.APIToken) : null,
            };
        });
        return jsonResponse(maskedConfig);
    }

    const configJson = (await env.KV.get('usage_config.json', { type: 'json' })) || [];
    const maskedConfig = configJson.map((item) => {
        const updateTime = getAccountLastUpdateTime(item);
        return {
            ...item,
            UpdateTime: updateTime || item.UpdateTime,
            Usage: normalizeAccountUsage(item),
            GlobalAPIKey: item.GlobalAPIKey ? maskSensitiveInfo(item.GlobalAPIKey) : null,
            APIToken: item.APIToken ? maskSensitiveInfo(item.APIToken) : null,
        };
    });

    return jsonResponse(maskedConfig);
}

/**
 * GET/POST /api/admin/usage
 * 获取用量汇总数据，或手动触发刷新。
 * 支持 ?force=1 参数强制刷新所有账号。
 * DEMO 模式下返回 src/demo/usage.json 的演示汇总数据。
 */
async function refreshAdminUsage(context) {
    const { url, env, isDemo } = context;

    if (isDemo) {
        const data = { ...demoUsage, UpdateTime: Date.now() };
        return jsonResponse(data);
    }

    const force = url.searchParams.get('force') === '1';
    const usageJson = await refreshUsage(env, { force });
    return jsonResponse(usageJson);
}

export { getConfig, refreshAdminUsage };
