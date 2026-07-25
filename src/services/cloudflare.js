/**
 * Cloudflare API 调用服务。
 * 封装与 Cloudflare API 的所有交互：GraphQL 查询、账户验证、用量统计。
 */

import {
    toNumber, sumRequests, getStatsTimeWindow, selectLatestGroups,
    normalizeActionName, createDefaultUsage, createDefaultResources,
} from '../utils/helpers.js';
import { FREE_TIER, R2_CLASS_A_ACTIONS, R2_CLASS_B_ACTIONS, R2_FREE_ACTIONS } from '../utils/constants.js';
import {
    WORKERS_PAGES_QUERY,
    buildWorkersPagesVariables,
    D1_QUERY,
    buildD1Variables,
    KV_QUERY,
    buildKvVariables,
    R2_QUERY,
    buildR2Variables,
} from './graphql.js';

/**
 * 发送 GraphQL 请求到 Cloudflare Analytics API。
 */
async function sendGraphQLRequest(api, headers, query, variables) {
    const res = await fetch(`${api}/graphql`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query, variables }),
    });

    if (!res.ok) {
        throw new Error(`查询失败: ${res.status}`);
    }
    const result = await res.json();
    if (result.errors?.length) {
        throw new Error(result.errors.map(error => error.message).join('; '));
    }
    const account = result?.data?.viewer?.accounts?.[0];
    if (!account) {
        throw new Error('未找到账户数据');
    }
    return account;
}

/**
 * 通过 Email 获取 Cloudflare Account ID。
 */
async function getCloudflareAccountId(api, headers, email) {
    const res = await fetch(`${api}/accounts`, { method: 'GET', headers });
    if (!res.ok) {
        throw new Error(`账户获取失败: ${res.status}`);
    }
    const data = await res.json();
    if (!data?.result?.length) {
        throw new Error('未找到账户');
    }
    const idx = data.result.findIndex(
        account => account.name?.toLowerCase().startsWith(email.toLowerCase())
    );
    return data.result[idx >= 0 ? idx : 0]?.id;
}

/**
 * 查询 Workers 和 Pages 的请求统计。
 */
async function queryWorkersPagesStats(api, headers, accountId, timeWindow) {
    const variables = buildWorkersPagesVariables(accountId, timeWindow);
    const account = await sendGraphQLRequest(api, headers, WORKERS_PAGES_QUERY, variables);
    return {
        pages: sumRequests(account.pagesFunctionsInvocationsAdaptiveGroups),
        workers: sumRequests(account.workersInvocationsAdaptive),
    };
}

/**
 * 查询 D1 统计。
 */
async function queryD1Stats(api, headers, accountId, timeWindow) {
    const variables = buildD1Variables(accountId, timeWindow);
    const account = await sendGraphQLRequest(api, headers, D1_QUERY, variables);

    const d1 = createDefaultResources().d1;

    for (const group of account.d1AnalyticsAdaptiveGroups || []) {
        d1.rowsRead += toNumber(group?.sum?.rowsRead);
        d1.rowsWritten += toNumber(group?.sum?.rowsWritten);
        d1.readQueries += toNumber(group?.sum?.readQueries);
        d1.writeQueries += toNumber(group?.sum?.writeQueries);
    }

    const storageGroups = selectLatestGroups(account.d1StorageAdaptiveGroups, 'databaseId', 'date');
    d1.databases = storageGroups.length;
    d1.storageBytes = storageGroups.reduce(
        (total, group) => total + toNumber(group?.max?.databaseSizeBytes), 0
    );

    return d1;
}

/**
 * 查询 KV 统计。
 */
async function queryKVStats(api, headers, accountId, timeWindow) {
    const variables = buildKvVariables(accountId, timeWindow);
    const account = await sendGraphQLRequest(api, headers, KV_QUERY, variables);

    const kv = createDefaultResources().kv;

    for (const group of account.kvOperationsAdaptiveGroups || []) {
        const requests = toNumber(group?.sum?.requests);
        const actionType = String(group?.dimensions?.actionType || '').toLowerCase();
        kv.operations += requests;

        if (actionType.includes('read')) {
            kv.reads += requests;
        } else if (actionType.includes('write')) {
            kv.writes += requests;
        } else if (actionType.includes('delete')) {
            kv.deletes += requests;
        } else if (actionType.includes('list')) {
            kv.lists += requests;
        }
    }

    const storageGroups = selectLatestGroups(account.kvStorageAdaptiveGroups, 'namespaceId', 'date');
    kv.namespaces = storageGroups.length;
    kv.keys = storageGroups.reduce(
        (total, group) => total + toNumber(group?.max?.keyCount), 0
    );
    kv.storageBytes = storageGroups.reduce(
        (total, group) => total + toNumber(group?.max?.byteCount), 0
    );

    return kv;
}

/**
 * 查询 R2 统计。
 */
async function queryR2Stats(api, headers, accountId, timeWindow) {
    const variables = buildR2Variables(accountId, timeWindow);
    const account = await sendGraphQLRequest(api, headers, R2_QUERY, variables);

    const r2 = createDefaultResources().r2;

    for (const group of account.r2OperationsAdaptiveGroups || []) {
        const status = String(group?.dimensions?.actionStatus || 'success').toLowerCase();
        if (status && status !== 'success') {
            continue;
        }

        const requests = toNumber(group?.sum?.requests);
        const action = normalizeActionName(group?.dimensions?.actionType);
        r2.operations += requests;

        if (R2_CLASS_A_ACTIONS.has(action)) {
            r2.classA += requests;
        } else if (R2_CLASS_B_ACTIONS.has(action)) {
            r2.classB += requests;
        } else if (R2_FREE_ACTIONS.has(action)) {
            r2.free += requests;
        } else {
            r2.other += requests;
        }
    }

    const storageGroups = selectLatestGroups(account.r2StorageAdaptiveGroups, 'bucketName', 'datetime');
    r2.buckets = storageGroups.length;
    r2.objects = storageGroups.reduce(
        (total, group) => total + toNumber(group?.max?.objectCount), 0
    );
    r2.storageBytes = storageGroups.reduce(
        (total, group) => total + toNumber(group?.max?.payloadSize)
            + toNumber(group?.max?.metadataSize), 0
    );

    return r2;
}

/**
 * 获取单个 Cloudflare 账户的完整用量数据。
 */
async function getCloudflareUsage(email, globalApiKey, accountId, apiToken) {
    const api = 'https://api.cloudflare.com/client/v4';
    const baseHeaders = { 'Content-Type': 'application/json' };
    const fallback = createDefaultUsage(false);
    fallback.max = FREE_TIER.requestsDaily;

    try {
        if (!accountId && (!email || !globalApiKey)) {
            return fallback;
        }

        const headers = apiToken
            ? { ...baseHeaders, Authorization: `Bearer ${apiToken}` }
            : { ...baseHeaders, 'X-AUTH-EMAIL': email, 'X-AUTH-KEY': globalApiKey };

        if (!accountId) {
            accountId = await getCloudflareAccountId(api, headers, email);
        }

        const timeWindow = getStatsTimeWindow();
        const usage = createDefaultUsage(true, '✅ 成功更新免费额度使用数据');
        const core = await queryWorkersPagesStats(api, headers, accountId, timeWindow);

        usage.pages = core.pages;
        usage.workers = core.workers;
        usage.total = core.pages + core.workers;
        usage.max = FREE_TIER.requestsDaily;

        const errors = [];
        const safeQuery = async (label, queryFn, defaultValue) => {
            try {
                return await queryFn();
            } catch (error) {
                console.warn(`${label} 统计失败:`, error.message);
                errors.push(`${label}: ${error.message}`);
                return defaultValue;
            }
        };

        const [d1, kv, r2] = await Promise.all([
            safeQuery('D1', () => queryD1Stats(api, headers, accountId, timeWindow), createDefaultResources().d1),
            safeQuery('KV', () => queryKVStats(api, headers, accountId, timeWindow), createDefaultResources().kv),
            safeQuery('R2', () => queryR2Stats(api, headers, accountId, timeWindow), createDefaultResources().r2),
        ]);

        usage.resources.d1 = d1;
        usage.resources.kv = kv;
        usage.resources.r2 = r2;
        if (errors.length) {
            usage.errors = errors;
        }

        console.log(
            `统计结果 - Pages: ${usage.pages}, Workers: ${usage.workers}, ` +
            `D1读: ${d1.rowsRead}, KV读: ${kv.reads}, R2 A/B: ${r2.classA}/${r2.classB}`
        );
        return usage;
    } catch (error) {
        console.error('获取使用量错误:', error.message);
        fallback.msg = '❌ 获取使用量失败: ' + error.message;
        return fallback;
    }
}

export {
    sendGraphQLRequest,
    getCloudflareAccountId,
    queryWorkersPagesStats,
    queryD1Stats,
    queryKVStats,
    queryR2Stats,
    getCloudflareUsage,
};