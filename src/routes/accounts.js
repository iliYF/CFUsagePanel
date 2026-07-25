/**
 * 账号管理路由处理器。
 * POST /api/accounts/add   — 添加 CF 账号
 * POST /api/accounts/del   — 删除 CF 账号
 * POST /api/accounts/check — 检查单个账号用量
 */

import { jsonResponse, normalizeAccountUsage } from '../utils/helpers.js';
import { getCloudflareUsage } from '../services/cloudflare.js';

/**
 * 生成新的账号 ID（现有最大 ID + 1）。
 */
function generateNewId(configJson) {
    if (!Array.isArray(configJson) || configJson.length === 0) return 1;
    return Math.max(...configJson.map((item) => item.ID || 0)) + 1;
}

/**
 * POST /api/accounts/add
 * 添加或更新 Cloudflare 账号。
 */
async function addAccount(context) {
    const { request, env, isDemo } = context;

    if (isDemo) {
        return jsonResponse({ success: false, msg: '预览模式下，无法进行此操作' }, 403);
    }

    if (request.method !== 'POST') {
        return jsonResponse({ success: false, msg: 'Method Not Allowed' }, 405);
    }

    try {
        const newConfig = await request.json();

        const hasEmailAuth = newConfig.Email && newConfig.GlobalAPIKey;
        const hasTokenAuth = newConfig.AccountID && newConfig.APIToken;

        if (!hasEmailAuth && !hasTokenAuth) {
            return jsonResponse(
                { success: false, msg: '配置不完整，需要提供 Email+GlobalAPIKey 或 AccountID+APIToken' },
                400
            );
        }

        const now = Date.now();
        const accountData = {
            ID: 0,
            Name: newConfig.Name || '未命名账号',
            Email: hasEmailAuth ? newConfig.Email : null,
            GlobalAPIKey: hasEmailAuth ? newConfig.GlobalAPIKey : null,
            AccountID: newConfig.AccountID || null,
            APIToken: hasTokenAuth ? newConfig.APIToken : null,
            PanelURL: newConfig.PanelURL || null,
            UpdateTime: now,
            LastCheckTime: now,
            Usage: normalizeAccountUsage({}),
        };

        const usageResult = await getCloudflareUsage(
            accountData.Email,
            accountData.GlobalAPIKey,
            accountData.AccountID,
            accountData.APIToken
        );
        if (!usageResult.success) {
            return jsonResponse({ success: false, msg: '无法验证该CF账号的API信息' }, 400);
        }

        accountData.UpdateTime = Date.now();
        accountData.LastCheckTime = accountData.UpdateTime;
        accountData.Usage = normalizeAccountUsage({ ...accountData, Usage: usageResult });

        let configJson = await env.KV.get('usage_config.json', { type: 'json' });
        if (!Array.isArray(configJson)) {
            configJson = [];
        }

        const existingIndex = configJson.findIndex(
            (item) =>
                (accountData.Email && item.Email &&
                    item.Email.toLowerCase() === accountData.Email.toLowerCase()) ||
                (accountData.AccountID && item.AccountID && item.AccountID === accountData.AccountID)
        );

        if (existingIndex !== -1) {
            accountData.ID = configJson[existingIndex].ID;
            configJson[existingIndex] = accountData;
            await env.KV.put('usage_config.json', JSON.stringify(configJson));
            return jsonResponse({
                success: true,
                msg: '账号已存在，已更新账号信息',
                data: { ID: accountData.ID, Name: accountData.Name },
            });
        }

        accountData.ID = generateNewId(configJson);
        configJson.push(accountData);
        await env.KV.put('usage_config.json', JSON.stringify(configJson));

        return jsonResponse({
            success: true,
            msg: '账号添加成功',
            data: { ID: accountData.ID, Name: accountData.Name },
        });
    } catch (error) {
        console.error('保存配置失败:', error);
        return jsonResponse({ success: false, msg: '保存配置失败: ' + error.message }, 500);
    }
}

/**
 * POST /api/accounts/del
 * 删除指定的 Cloudflare 账号。
 */
async function deleteAccount(context) {
    const { request, env, isDemo } = context;

    if (isDemo) {
        return jsonResponse({ success: false, msg: '预览模式下，无法进行此操作' }, 403);
    }

    if (request.method !== 'POST') {
        return jsonResponse({ success: false, msg: 'Method Not Allowed' }, 405);
    }

    try {
        const body = await request.json();
        const deleteId = body.ID;

        if (deleteId === undefined || deleteId === null) {
            return jsonResponse({ success: false, msg: '请提供要删除的账号ID' }, 400);
        }

        let configJson = await env.KV.get('usage_config.json', { type: 'json' });
        if (!Array.isArray(configJson) || configJson.length === 0) {
            return jsonResponse({ success: false, msg: '配置列表为空，无法删除' }, 404);
        }

        const targetIndex = configJson.findIndex((item) => item.ID === deleteId);
        if (targetIndex === -1) {
            return jsonResponse({ success: false, msg: `未找到ID为 ${deleteId} 的账号` }, 404);
        }

        const deletedName = configJson[targetIndex].Name || '未命名账号';
        configJson.splice(targetIndex, 1);
        await env.KV.put('usage_config.json', JSON.stringify(configJson));

        return jsonResponse({
            success: true,
            msg: `账号 "${deletedName}" 已删除`,
            data: { ID: deleteId, Name: deletedName },
        });
    } catch (error) {
        console.error('删除账号失败:', error);
        return jsonResponse({ success: false, msg: '删除账号失败: ' + error.message }, 500);
    }
}

/**
 * POST /api/accounts/check
 * 检查单个 CF 账号的当前用量。
 */
async function checkAccount(context) {
    const { url, isDemo } = context;

    if (isDemo) {
        return jsonResponse({ success: false, msg: '预览模式下，无法进行此操作' }, 403);
    }

    try {
        const usageResult = await getCloudflareUsage(
            url.searchParams.get('Email'),
            url.searchParams.get('GlobalAPIKey'),
            url.searchParams.get('AccountID'),
            url.searchParams.get('APIToken')
        );
        return jsonResponse(usageResult);
    } catch (err) {
        return jsonResponse({
            success: false,
            msg: '查询请求量失败，失败原因：' + err.message,
            error: err.message,
        }, 500);
    }
}

/**
 * POST /api/accounts/update
 * 更新已有的 Cloudflare 账号信息。
 */
async function updateAccount(context) {
    const { request, env, isDemo } = context;

    if (isDemo) {
        return jsonResponse({ success: false, msg: '预览模式下，无法进行此操作' }, 403);
    }

    if (request.method !== 'POST') {
        return jsonResponse({ success: false, msg: 'Method Not Allowed' }, 405);
    }

    try {
        const body = await request.json();
        const updateId = body.ID;

        if (updateId === undefined || updateId === null) {
            return jsonResponse({ success: false, msg: '请提供要更新的账号ID' }, 400);
        }

        let configJson = (await env.KV.get('usage_config.json', { type: 'json' })) || [];
        if (!Array.isArray(configJson)) {
            configJson = [];
        }

        const targetIndex = configJson.findIndex((item) => item.ID === updateId);
        if (targetIndex === -1) {
            return jsonResponse({ success: false, msg: `未找到ID为 ${updateId} 的账号` }, 404);
        }

        const existing = configJson[targetIndex];

        // 更新字段：有值则覆盖，无值保留原值
        existing.Name = body.Name || existing.Name;
        existing.AccountID = body.AccountID !== undefined ? (body.AccountID || null) : existing.AccountID;
        existing.APIToken = body.APIToken !== undefined ? (body.APIToken || null) : existing.APIToken;
        existing.Email = body.Email !== undefined ? (body.Email || null) : existing.Email;
        existing.GlobalAPIKey = body.GlobalAPIKey !== undefined ? (body.GlobalAPIKey || null) : existing.GlobalAPIKey;
        existing.PanelURL = body.PanelURL !== undefined ? (body.PanelURL || null) : existing.PanelURL;
        existing.UpdateTime = Date.now();

        await env.KV.put('usage_config.json', JSON.stringify(configJson));

        return jsonResponse({
            success: true,
            msg: `账号 "${existing.Name}" 已更新`,
            data: { ID: existing.ID, Name: existing.Name },
        });
    } catch (error) {
        console.error('更新账号失败:', error);
        return jsonResponse({ success: false, msg: '更新账号失败: ' + error.message }, 500);
    }
}

export { addAccount, deleteAccount, checkAccount, updateAccount };
