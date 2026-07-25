/**
 * Cloudflare API 调用服务。
 * 封装与 Cloudflare API 的所有交互：GraphQL 查询、账户验证、用量统计。
 */

import {
    toNumber, sumRequests, getStatsTimeWindow, selectLatestGroups,
    normalizeActionName, createDefaultUsage, createDefaultResources,
} from '../utils/helpers.js';
import { FREE_TIER, R2_CLASS_A_ACTIONS, R2_CLASS_B_ACTIONS, R2_FREE_ACTIONS } from '../utils/constants.js';

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
        throw new Error(`GraphQL 查询失败: ${res.status}`);
    }
    const result = await res.json();
    if (result.errors) {
        throw new Error(`GraphQL 错误: ${result.errors.map((e) => e.message).join(', ')}`);
    }
    return result;
}

/**
 * 通过 Email 获取 Cloudflare Account ID。
 */
async function getCloudflareAccountId(api, headers, email) {
    const res = await fetch(`${api}/accounts`, { headers });
    if (!res.ok) {
        throw new Error(`获取账户列表失败: ${res.status}`);
    }
    const data = await res.json();
    if (!data.success || !Array.isArray(data.result)) {
        throw new Error('获取账户列表失败: API 返回异常');
    }
    const account = data.result.find((acc) => acc.name === email);
    if (!account) {
        throw new Error(`未找到匹配的账户: ${email}`);
    }
    return account.id;
}

/**
 * 查询 Workers 和 Pages 的请求统计。
 */
async function queryWorkersPagesStats(api, headers, accountId, timeWindow) {
    const query = `
        query ($accountTag: String!, $since: String!, $until: String!) {
            viewer {
                accounts(filter: { accountTag: $accountTag }) {
                    pagesFunctionsInvocationsAdaptiveGroups(limit: 10000, filter: { datetime_geq: $since, datetime_leq: $until }) {
                        sum { requests }
                        dimensions { scriptName }
                    }
                    httpRequestsAdaptiveGroups(limit: 10000, filter: { datetime_geq: $since, datetime_leq: $until }) {
                        sum { requests }
                        dimensions { clientRequestHTTPHost }
                    }
                }
            }
        }
    `;
    const variables = {
        accountTag: accountId,
        since: timeWindow.dayStartIso,
        until: timeWindow.nowIso,
    };

    const result = await sendGraphQLRequest(api, headers, query, variables);
    const accounts = result?.data?.viewer?.accounts || [];
    const account = accounts[0] || {};

    const pagesGroups = account.pagesFunctionsInvocationsAdaptiveGroups || [];
    const workersGroups = account.httpRequestsAdaptiveGroups || [];

    const pages = sumRequests(pagesGroups);
    const workers = sumRequests(workersGroups);

    return { pages, workers };
}

/**
 * 查询 D1 统计。
 */
async function queryD1Stats(api, headers, accountId, timeWindow) {
    const query = `
        query ($accountTag: String!, $since: String!, $until: String!) {
            viewer {
                accounts(filter: { accountTag: $accountTag }) {
                    d1AnalyticsAdaptiveGroups(limit: 10000, filter: { datetime_geq: $since, datetime_leq: $until }) {
                        sum { rowsRead rowsWritten }
                        dimensions { databaseId }
                    }
                    d1Databases {
                        databaseId
                        databaseSize
                    }
                }
            }
        }
    `;
    const variables = {
        accountTag: accountId,
        since: timeWindow.dayStartIso,
        until: timeWindow.nowIso,
    };

    const result = await sendGraphQLRequest(api, headers, query, variables);
    const accounts = result?.data?.viewer?.accounts || [];
    const account = accounts[0] || {};

    const groups = account.d1AnalyticsAdaptiveGroups || [];
    const databases = account.d1Databases || [];

    const latestGroups = selectLatestGroups(groups, 'databaseId', '');
    const rowsRead = latestGroups.reduce((sum, g) => sum + toNumber(g?.sum?.rowsRead), 0);
    const rowsWritten = latestGroups.reduce((sum, g) => sum + toNumber(g?.sum?.rowsWritten), 0);
    const readQueries = latestGroups.length;

    const databasesCount = databases.length;
    const storageBytes = databases.reduce((sum, db) => sum + toNumber(db?.databaseSize), 0);

    return {
        rowsRead,
        rowsReadLimit: FREE_TIER.d1RowsReadDaily,
        rowsWritten,
        rowsWrittenLimit: FREE_TIER.d1RowsWrittenDaily,
        readQueries,
        writeQueries: 0,
        storageBytes,
        storageLimitBytes: FREE_TIER.d1StorageBytes,
        databases: databasesCount,
        period: 'day',
    };
}

/**
 * 查询 KV 统计。
 */
async function queryKVStats(api, headers, accountId, timeWindow) {
    const query = `
        query ($accountTag: String!, $since: String!, $until: String!) {
            viewer {
                accounts(filter: { accountTag: $accountTag }) {
                    workersKVRequestsAdaptiveGroups(limit: 10000, filter: { datetime_geq: $since, datetime_leq: $until }) {
                        sum { requests }
                        dimensions { namespaceId, action }
                    }
                    workersKVNamespaces {
                        namespaceId
                        keys
                        namespaceStorageBytes
                    }
                }
            }
        }
    `;
    const variables = {
        accountTag: accountId,
        since: timeWindow.dayStartIso,
        until: timeWindow.nowIso,
    };

    const result = await sendGraphQLRequest(api, headers, query, variables);
    const accounts = result?.data?.viewer?.accounts || [];
    const account = accounts[0] || {};

    const groups = account.workersKVRequestsAdaptiveGroups || [];
    const namespaces = account.workersKVNamespaces || [];

    let reads = 0;
    let writes = 0;
    let deletes = 0;
    let lists = 0;
    let operations = 0;

    for (const group of groups) {
        const action = normalizeActionName(group?.dimensions?.action || '');
        const requests = toNumber(group?.sum?.requests);
        operations += requests;
        if (action.includes('read') || action.includes('get')) {
            reads += requests;
        } else if (action.includes('write') || action.includes('put')) {
            writes += requests;
        } else if (action.includes('delete')) {
            deletes += requests;
        } else if (action.includes('list')) {
            lists += requests;
        }
    }

    const keys = namespaces.reduce((sum, ns) => sum + toNumber(ns?.keys), 0);
    const storageBytes = namespaces.reduce((sum, ns) => sum + toNumber(ns?.namespaceStorageBytes), 0);

    return {
        reads,
        readsLimit: FREE_TIER.kvReadsDaily,
        writes,
        writesLimit: FREE_TIER.kvWritesDaily,
        deletes,
        deletesLimit: FREE_TIER.kvDeletesDaily,
        lists,
        listsLimit: FREE_TIER.kvListsDaily,
        operations,
        storageBytes,
        storageLimitBytes: FREE_TIER.kvStorageBytes,
        keys,
        namespaces: namespaces.length,
        period: 'day',
    };
}

/**
 * 查询 R2 统计。
 */
async function queryR2Stats(api, headers, accountId, timeWindow) {
    const query = `
        query ($accountTag: String!, $since: String!, $until: String!) {
            viewer {
                accounts(filter: { accountTag: $accountTag }) {
                    r2OperationsAdaptiveGroups(limit: 10000, filter: { datetime_geq: $since, datetime_leq: $until }) {
                        sum { requests }
                        dimensions { action, bucketName }
                    }
                    r2Buckets {
                        bucketName
                        bucketObjectCount
                        bucketStorageBytes
                    }
                }
            }
        }
    `;
    const variables = {
        accountTag: accountId,
        since: timeWindow.monthStartIso,
        until: timeWindow.nowIso,
    };

    const result = await sendGraphQLRequest(api, headers, query, variables);
    const accounts = result?.data?.viewer?.accounts || [];
    const account = accounts[0] || {};

    const groups = account.r2OperationsAdaptiveGroups || [];
    const buckets = account.r2Buckets || [];

    let classA = 0;
    let classB = 0;
    let freeCount = 0;
    let other = 0;
    let operations = 0;

    for (const group of groups) {
        const action = normalizeActionName(group?.dimensions?.action || '');
        const requests = toNumber(group?.sum?.requests);
        operations += requests;

        if (R2_CLASS_A_ACTIONS.has(action)) {
            classA += requests;
        } else if (R2_CLASS_B_ACTIONS.has(action)) {
            classB += requests;
        } else if (R2_FREE_ACTIONS.has(action)) {
            freeCount += requests;
        } else {
            other += requests;
        }
    }

    const objects = buckets.reduce((sum, b) => sum + toNumber(b?.bucketObjectCount), 0);
    const storageBytes = buckets.reduce((sum, b) => sum + toNumber(b?.bucketStorageBytes), 0);

    return {
        classA,
        classALimit: FREE_TIER.r2ClassAMonthly,
        classB,
        classBLimit: FREE_TIER.r2ClassBMonthly,
        free: freeCount,
        other,
        operations,
        storageBytes,
        storageLimitBytes: FREE_TIER.r2StorageBytes,
        objects,
        buckets: buckets.length,
        period: 'month',
    };
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
        const usage = createDefaultUsage(true, '成功更新免费额度使用数据');
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
        fallback.msg = '获取使用量失败: ' + error.message;
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
