/**
 * Usage 数据管理服务。
 * 负责批量更新所有账号的用量数据，写入 KV 存储。
 */

import { FREE_TIER, DEFAULT_CHECK_INTERVAL_MS, DEFAULT_MAX_EXTERNAL_SUBREQUESTS } from '../utils/constants.js';
import {
    toNumber,
    normalizeUsage,
    normalizeAccountUsage,
    accumulateResources,
    createDefaultUsage,
    createSummaryResources,
} from '../utils/helpers.js';
import { getCloudflareUsage } from './cloudflare.js';

/**
 * 获取账号的最后更新时间（毫秒时间戳）。
 */
function getAccountLastUpdateTime(account) {
    return Number(account?.UpdateTime || account?.Usage?.UpdateTime || 0) || 0;
}

/**
 * 从 env 变量中获取单账号查询间隔（毫秒）。
 */
function getAccountCheckInterval(env = {}) {
    const ms = Number(env.ACCOUNT_CHECK_INTERVAL_MS || env.account_check_interval_ms);
    if (Number.isFinite(ms) && ms > 0) return ms;

    const minutes = Number(
        env.ACCOUNT_CHECK_INTERVAL_MINUTES ||
        env.account_check_interval_minutes ||
        env.CHECK_INTERVAL_MINUTES ||
        env.check_interval_minutes
    );
    if (Number.isFinite(minutes) && minutes > 0) return minutes * 60 * 1000;

    return DEFAULT_CHECK_INTERVAL_MS;
}

/**
 * 从 env 变量中获取每轮最多外部子请求数。
 */
function getMaxExternalSubrequests(env = {}) {
    const configured = Number(env.MAX_EXTERNAL_SUBREQUESTS_PER_RUN || env.max_external_subrequests_per_run);
    if (Number.isFinite(configured) && configured > 0) {
        return Math.min(Math.max(1, Math.floor(configured)), DEFAULT_MAX_EXTERNAL_SUBREQUESTS);
    }
    return DEFAULT_MAX_EXTERNAL_SUBREQUESTS;
}

/**
 * 估算单个账号的外部子请求数。
 * AccountID 已知: 4，未知需先获取: 5。
 */
function estimateAccountSubrequests(account = {}) {
    if (account.AccountID) return 4;
    if (account.Email && account.GlobalAPIKey) return 5;
    return 5;
}

/**
 * 写入账号查询成功结果。
 */
function setAccountQueryResult(account, usage, queryTime = Date.now()) {
    const normalized = normalizeUsage(usage || {});
    normalized.UpdateTime = queryTime;
    account.Usage = normalizeAccountUsage({ ...account, Usage: normalized });
    account.UpdateTime = queryTime;
    account.LastCheckTime = queryTime;
    delete account.LastCheckError;
    delete account.LastCheckErrorTime;
    return normalized;
}

/**
 * 写入账号查询失败状态。
 */
function setAccountQueryError(account, error, queryTime = Date.now()) {
    const lastUpdateTime = getAccountLastUpdateTime(account);
    if (lastUpdateTime && !account.UpdateTime) {
        account.UpdateTime = lastUpdateTime;
    }
    account.LastCheckTime = queryTime;
    account.LastCheckErrorTime = queryTime;
    account.LastCheckError =
        typeof error === 'string' ? error : error?.msg || error?.message || '查询失败';
    account.Usage = normalizeAccountUsage(account);
    return account.Usage;
}

/**
 * 批量更新所有账号的用量数据，写入 KV。
 * 支持定时任务和手动触发两种场景。
 */
async function refreshUsage(env, options = {}) {
    let configJson = await env.KV.get('usage_config.json', { type: 'json' });
    let usageJson = createDefaultUsage(false);

    if (!configJson) {
        configJson = [];
        await env.KV.put('usage_config.json', JSON.stringify(configJson));
        usageJson.success = true;
        usageJson.resources = createSummaryResources();
        usageJson.msg = '尚未添加任何Cloudflare账号';
        await env.KV.put('usage.json', JSON.stringify(usageJson));
    } else if (Array.isArray(configJson) && configJson.length > 0) {
        const thresholdMs = Number(options.thresholdMs) || getAccountCheckInterval(env);
        const externalSubrequestLimit = getMaxExternalSubrequests(env);
        const now = Date.now();

        const accountStates = configJson.map((account, index) => {
            const lastUpdateTime = getAccountLastUpdateTime(account);
            account.Usage = normalizeAccountUsage(account);
            if (lastUpdateTime && !account.UpdateTime) account.UpdateTime = lastUpdateTime;
            if (lastUpdateTime && !account.LastCheckTime) account.LastCheckTime = lastUpdateTime;
            return { account, index, lastUpdateTime };
        });

        const expiredAccounts = accountStates
            .filter((item) => options.force || !item.lastUpdateTime || now - item.lastUpdateTime > thresholdMs)
            .sort((a, b) => (a.lastUpdateTime || 0) - (b.lastUpdateTime || 0));

        const accountsToRefresh = [];
        let estimatedExternalSubrequests = 0;
        for (const item of expiredAccounts) {
            const accountSubrequests = estimateAccountSubrequests(item.account);
            if (estimatedExternalSubrequests + accountSubrequests > externalSubrequestLimit) continue;
            accountsToRefresh.push({ ...item, estimatedExternalSubrequests: accountSubrequests });
            estimatedExternalSubrequests += accountSubrequests;
        }

        let refreshedCount = 0;
        let failedRefreshCount = 0;

        await Promise.all(
            accountsToRefresh.map(async ({ account }) => {
                try {
                    const usage = await getCloudflareUsage(
                        account.Email,
                        account.GlobalAPIKey,
                        account.AccountID,
                        account.APIToken
                    );
                    if (!usage.success) {
                        setAccountQueryError(account, usage, Date.now());
                        failedRefreshCount += 1;
                        return;
                    }
                    setAccountQueryResult(account, usage, Date.now());
                    refreshedCount += 1;
                } catch (error) {
                    failedRefreshCount += 1;
                    console.error(`账号 ${account.ID} 查询失败:`, error.message);
                    setAccountQueryError(account, error, Date.now());
                }
            })
        );

        let totalPages = 0;
        let totalWorkers = 0;
        let totalMax = 0;
        const totalResources = createSummaryResources();

        for (const account of configJson) {
            const usage = normalizeAccountUsage(account);
            account.Usage = usage;
            if (usage.success) {
                totalPages += usage.pages || 0;
                totalWorkers += usage.workers || 0;
                totalMax += usage.max || FREE_TIER.requestsDaily;
                accumulateResources(totalResources, usage.resources);
            }
        }

        await env.KV.put('usage_config.json', JSON.stringify(configJson));

        usageJson.success = true;
        usageJson.pages = totalPages;
        usageJson.workers = totalWorkers;
        usageJson.total = totalPages + totalWorkers;
        usageJson.max = totalMax;
        usageJson.resources = totalResources;
        usageJson.UpdateTime = Date.now();
        usageJson.RefreshStats = {
            refreshed: refreshedCount,
            failed: failedRefreshCount,
            cached: Math.max(configJson.length - refreshedCount, 0),
            skippedByLimit: Math.max(expiredAccounts.length - accountsToRefresh.length, 0),
            maxRefresh: accountsToRefresh.length,
            externalSubrequestsEstimated: estimatedExternalSubrequests,
            externalSubrequestLimit,
            perAccountExternalSubrequests: { withAccountId: 4, withoutAccountId: 5 },
            thresholdMs,
        };
        usageJson.msg =
            failedRefreshCount > 0
                ? `部分账号查询失败（本次刷新 ${refreshedCount} 个账号，失败 ${failedRefreshCount} 个，${usageJson.RefreshStats.cached} 个使用历史数据）`
                : `成功更新免费额度使用数据（本次刷新 ${refreshedCount} 个账号，${usageJson.RefreshStats.cached} 个使用历史数据）`;
        await env.KV.put('usage.json', JSON.stringify(usageJson));
    } else {
        usageJson.success = true;
        usageJson.resources = createSummaryResources();
        usageJson.UpdateTime = Date.now();
        usageJson.msg = '尚未添加任何Cloudflare账号';
        await env.KV.put('usage.json', JSON.stringify(usageJson));
    }

    return usageJson;
}

export {
    getAccountLastUpdateTime,
    getAccountCheckInterval,
    getMaxExternalSubrequests,
    estimateAccountSubrequests,
    setAccountQueryResult,
    setAccountQueryError,
    refreshUsage,
};
