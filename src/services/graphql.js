/**
 * Cloudflare GraphQL 查询定义。
 * 集中管理所有 GraphQL 查询语句和变量构建函数。
 */

/**
 * Workers & Pages 统计查询。
 * 查询当天 Workers 和 Pages Functions 的请求数。
 */
const WORKERS_PAGES_QUERY = `
    query getBillingMetrics($AccountID: String!, $filter: AccountWorkersInvocationsAdaptiveFilter_InputObject) {
        viewer {
            accounts(filter: { accountTag: $AccountID }) {
                pagesFunctionsInvocationsAdaptiveGroups(limit: 1000, filter: $filter) {
                    sum { requests }
                }
                workersInvocationsAdaptive(limit: 10000, filter: $filter) {
                    sum { requests }
                }
            }
        }
    }
`;

function buildWorkersPagesVariables(accountId, timeWindow) {
    return {
        AccountID: accountId,
        filter: {
            datetime_geq: timeWindow.dayStartIso,
            datetime_leq: timeWindow.nowIso,
        },
    };
}

/**
 * D1 统计查询。
 * 查询当天 D1 数据库的操作统计和存储信息。
 */
const D1_QUERY = `
    query D1Usage($accountTag: String!, $dayStart: Date!, $dateEnd: Date!, $storageStart: Date!) {
        viewer {
            accounts(filter: { accountTag: $accountTag }) {
                d1AnalyticsAdaptiveGroups(
                    limit: 10000
                    filter: { date_geq: $dayStart, date_leq: $dateEnd }
                ) {
                    sum { rowsRead rowsWritten readQueries writeQueries }
                    dimensions { date databaseId }
                }
                d1StorageAdaptiveGroups(
                    limit: 10000
                    filter: { date_geq: $storageStart, date_leq: $dateEnd }
                    orderBy: [date_DESC]
                ) {
                    max { databaseSizeBytes }
                    dimensions { date databaseId }
                }
            }
        }
    }
`;

function buildD1Variables(accountId, timeWindow) {
    return {
        accountTag: accountId,
        dayStart: timeWindow.dayStartDate,
        dateEnd: timeWindow.dateEnd,
        storageStart: timeWindow.monthStartDate,
    };
}

/**
 * KV 统计查询。
 * 查询当天 KV 的操作统计和命名空间存储信息。
 */
const KV_QUERY = `
    query KvUsage($accountTag: String!, $dayStart: Date!, $dateEnd: Date!, $storageStart: Date!) {
        viewer {
            accounts(filter: { accountTag: $accountTag }) {
                kvOperationsAdaptiveGroups(
                    limit: 10000
                    filter: { date_geq: $dayStart, date_leq: $dateEnd }
                ) {
                    sum { requests }
                    dimensions { actionType }
                }
                kvStorageAdaptiveGroups(
                    limit: 10000
                    filter: { date_geq: $storageStart, date_leq: $dateEnd }
                    orderBy: [date_DESC]
                ) {
                    max { keyCount byteCount }
                    dimensions { date namespaceId }
                }
            }
        }
    }
`;

function buildKvVariables(accountId, timeWindow) {
    return {
        accountTag: accountId,
        dayStart: timeWindow.dayStartDate,
        dateEnd: timeWindow.dateEnd,
        storageStart: timeWindow.monthStartDate,
    };
}

/**
 * R2 统计查询。
 * 查询当月 R2 的操作统计和存储信息。
 */
const R2_QUERY = `
    query R2Usage($accountTag: String!, $monthStart: Time!, $now: Time!) {
        viewer {
            accounts(filter: { accountTag: $accountTag }) {
                r2OperationsAdaptiveGroups(
                    limit: 10000
                    filter: { datetime_geq: $monthStart, datetime_leq: $now }
                ) {
                    sum { requests }
                    dimensions { actionType actionStatus }
                }
                r2StorageAdaptiveGroups(
                    limit: 10000
                    filter: { datetime_geq: $monthStart, datetime_leq: $now }
                    orderBy: [datetime_DESC]
                ) {
                    max { objectCount uploadCount payloadSize metadataSize }
                    dimensions { datetime bucketName }
                }
            }
        }
    }
`;

function buildR2Variables(accountId, timeWindow) {
    return {
        accountTag: accountId,
        monthStart: timeWindow.monthStartIso,
        now: timeWindow.nowIso,
    };
}

export {
    WORKERS_PAGES_QUERY,
    buildWorkersPagesVariables,
    D1_QUERY,
    buildD1Variables,
    KV_QUERY,
    buildKvVariables,
    R2_QUERY,
    buildR2Variables,
};