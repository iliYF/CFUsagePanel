/**
 * 通用工具函数。
 * 包含数值转换、字符串处理、数据统计、HTTP 响应辅助、Usage 数据结构工厂等。
 */

import { FREE_TIER } from './constants.js';

/**
 * 安全地将值转为数字，无效值返回 0。
 */
function toNumber(value) {
    return Number(value) || 0;
}

/**
 * 合计请求数 groups 中各分组的 sum.requests。
 */
function sumRequests(groups) {
    return groups?.reduce((total, item) => total + toNumber(item?.sum?.requests), 0) || 0;
}

/**
 * 标准化动作名称：去除非字母数字字符并转为小写。
 */
function normalizeActionName(action) {
    return String(action || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
}

/**
 * 从分组中选择最新（按 timeField）的条目。
 */
function selectLatestGroups(groups, idField, timeField) {
    const latest = new Map();
    for (const group of groups || []) {
        const dimensions = group?.dimensions || {};
        const id = dimensions[idField] || '__account';
        const time = String(dimensions[timeField] || '');
        const current = latest.get(id);
        if (!current || time >= current.time) {
            latest.set(id, { time, group });
        }
    }
    return Array.from(latest.values()).map((item) => item.group);
}

/**
 * 获取统计时间窗口（当天/当月的起止时间）。
 */
function getStatsTimeWindow() {
    const now = new Date();
    const dayStart = new Date(now);
    dayStart.setUTCHours(0, 0, 0, 0);
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    return {
        nowIso: now.toISOString(),
        dayStartIso: dayStart.toISOString(),
        monthStartIso: monthStart.toISOString(),
        dayStartDate: dayStart.toISOString().slice(0, 10),
        monthStartDate: monthStart.toISOString().slice(0, 10),
        dateEnd: now.toISOString().slice(0, 10),
    };
}

/**
 * 掩码敏感信息（如 Email、APIKey），保留前后各 N 个字符。
 */
function maskSensitiveInfo(text, prefixLen = 3, suffixLen = 2) {
    if (!text || typeof text !== 'string') return null;
    if (text.length <= prefixLen + suffixLen) {
        return text.slice(0, 1) + '***' + text.slice(-1);
    }
    return text.slice(0, prefixLen) + '***' + text.slice(-suffixLen);
}

/**
 * 返回 CORS 预检响应。
 */
function corsResponse() {
    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        },
    });
}

/**
 * 返回 JSON 响应。
 */
function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data, null, 2), {
        status,
        headers: {
            'Content-Type': 'application/json;charset=UTF-8',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        },
    });
}

/**
 * Usage 数据结构工厂函数。
 * 为确保 services/usage.js 和 services/cloudflare.js 之间无循环引用，
 * 所有纯数据结构函数统一放在 helpers.js 中。
 */

/**
 * 创建默认资源统计结构。
 */
function createDefaultResources() {
    return {
        d1: {
            rowsRead: 0,
            rowsReadLimit: FREE_TIER.d1RowsReadDaily,
            rowsWritten: 0,
            rowsWrittenLimit: FREE_TIER.d1RowsWrittenDaily,
            readQueries: 0,
            writeQueries: 0,
            storageBytes: 0,
            storageLimitBytes: FREE_TIER.d1StorageBytes,
            databases: 0,
            period: 'day',
        },
        kv: {
            reads: 0,
            readsLimit: FREE_TIER.kvReadsDaily,
            writes: 0,
            writesLimit: FREE_TIER.kvWritesDaily,
            deletes: 0,
            deletesLimit: FREE_TIER.kvDeletesDaily,
            lists: 0,
            listsLimit: FREE_TIER.kvListsDaily,
            operations: 0,
            storageBytes: 0,
            storageLimitBytes: FREE_TIER.kvStorageBytes,
            keys: 0,
            namespaces: 0,
            period: 'day',
        },
        r2: {
            classA: 0,
            classALimit: FREE_TIER.r2ClassAMonthly,
            classB: 0,
            classBLimit: FREE_TIER.r2ClassBMonthly,
            free: 0,
            other: 0,
            operations: 0,
            storageBytes: 0,
            storageLimitBytes: FREE_TIER.r2StorageBytes,
            objects: 0,
            buckets: 0,
            period: 'month',
        },
    };
}

/**
 * 创建汇总资源统计结构（限额初始为 0，后续累加）。
 */
function createSummaryResources() {
    const resources = createDefaultResources();
    resources.d1.rowsReadLimit = 0;
    resources.d1.rowsWrittenLimit = 0;
    resources.d1.storageLimitBytes = 0;
    resources.kv.readsLimit = 0;
    resources.kv.writesLimit = 0;
    resources.kv.deletesLimit = 0;
    resources.kv.listsLimit = 0;
    resources.kv.storageLimitBytes = 0;
    resources.r2.classALimit = 0;
    resources.r2.classBLimit = 0;
    resources.r2.storageLimitBytes = 0;
    return resources;
}

/**
 * 创建默认 Usage 对象。
 */
function createDefaultUsage(success = false, msg = '无效TOKEN') {
    return {
        success,
        pages: 0,
        workers: 0,
        total: 0,
        max: success ? FREE_TIER.requestsDaily : 0,
        resources: createDefaultResources(),
        UpdateTime: Date.now(),
        msg,
    };
}

/**
 * 合并两份资源统计（以 base 为基础，extra 覆盖对应字段）。
 */
function mergeResources(base, extra = {}) {
    const merged = { ...base };
    for (const key of Object.keys(base)) {
        merged[key] = { ...base[key], ...(extra?.[key] || {}) };
    }
    return merged;
}

/**
 * 补全/标准化 Usage 结构。
 */
function normalizeUsage(usage) {
    const source = usage || {};
    const base = createDefaultUsage(false);
    const normalized = { ...base, ...source };
    const updateTime = Number(source.UpdateTime || 0) || 0;
    const hasResourceData = Boolean(source.resources);
    normalized.pages = Number(normalized.pages) || 0;
    normalized.workers = Number(normalized.workers) || 0;
    normalized.total = Number(normalized.total) || normalized.pages + normalized.workers;
    normalized.max = Number(normalized.max) || FREE_TIER.requestsDaily;
    normalized.UpdateTime = updateTime;
    normalized.resources = mergeResources(
        hasResourceData ? createDefaultResources() : createSummaryResources(),
        normalized.resources || {}
    );
    return normalized;
}

/**
 * 补全/标准化账号 Usage 结构（不含 UpdateTime）。
 */
function normalizeAccountUsage(account) {
    const usage = normalizeUsage(account?.Usage || {});
    delete usage.UpdateTime;
    return usage;
}

/**
 * 将 source 资源统计累加到 target（修改 target）。
 */
function accumulateResources(target, source) {
    const data = mergeResources(createDefaultResources(), source || {});

    target.d1.rowsRead += data.d1.rowsRead || 0;
    target.d1.rowsReadLimit += data.d1.rowsReadLimit || FREE_TIER.d1RowsReadDaily;
    target.d1.rowsWritten += data.d1.rowsWritten || 0;
    target.d1.rowsWrittenLimit += data.d1.rowsWrittenLimit || FREE_TIER.d1RowsWrittenDaily;
    target.d1.readQueries += data.d1.readQueries || 0;
    target.d1.writeQueries += data.d1.writeQueries || 0;
    target.d1.storageBytes += data.d1.storageBytes || 0;
    target.d1.storageLimitBytes += data.d1.storageLimitBytes || FREE_TIER.d1StorageBytes;
    target.d1.databases += data.d1.databases || 0;

    target.kv.reads += data.kv.reads || 0;
    target.kv.readsLimit += data.kv.readsLimit || FREE_TIER.kvReadsDaily;
    target.kv.writes += data.kv.writes || 0;
    target.kv.writesLimit += data.kv.writesLimit || FREE_TIER.kvWritesDaily;
    target.kv.deletes += data.kv.deletes || 0;
    target.kv.deletesLimit += data.kv.deletesLimit || FREE_TIER.kvDeletesDaily;
    target.kv.lists += data.kv.lists || 0;
    target.kv.listsLimit += data.kv.listsLimit || FREE_TIER.kvListsDaily;
    target.kv.operations += data.kv.operations || 0;
    target.kv.storageBytes += data.kv.storageBytes || 0;
    target.kv.storageLimitBytes += data.kv.storageLimitBytes || FREE_TIER.kvStorageBytes;
    target.kv.keys += data.kv.keys || 0;
    target.kv.namespaces += data.kv.namespaces || 0;

    target.r2.classA += data.r2.classA || 0;
    target.r2.classALimit += data.r2.classALimit || FREE_TIER.r2ClassAMonthly;
    target.r2.classB += data.r2.classB || 0;
    target.r2.classBLimit += data.r2.classBLimit || FREE_TIER.r2ClassBMonthly;
    target.r2.free += data.r2.free || 0;
    target.r2.other += data.r2.other || 0;
    target.r2.operations += data.r2.operations || 0;
    target.r2.storageBytes += data.r2.storageBytes || 0;
    target.r2.storageLimitBytes += data.r2.storageLimitBytes || FREE_TIER.r2StorageBytes;
    target.r2.objects += data.r2.objects || 0;
    target.r2.buckets += data.r2.buckets || 0;
}

export {
    toNumber,
    sumRequests,
    normalizeActionName,
    selectLatestGroups,
    getStatsTimeWindow,
    maskSensitiveInfo,
    corsResponse,
    jsonResponse,
    createDefaultResources,
    createSummaryResources,
    createDefaultUsage,
    mergeResources,
    normalizeUsage,
    normalizeAccountUsage,
    accumulateResources,
};
