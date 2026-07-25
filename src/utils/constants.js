/**
 * Cloudflare 免费额度配置及常量定义。
 */

// 免费额度
const FREE_TIER = {
    requestsDaily: 100000,
    d1RowsReadDaily: 5000000,
    d1RowsWrittenDaily: 100000,
    d1StorageBytes: 5 * 1024 * 1024 * 1024,
    kvReadsDaily: 100000,
    kvWritesDaily: 1000,
    kvDeletesDaily: 1000,
    kvListsDaily: 1000,
    kvStorageBytes: 1 * 1024 * 1024 * 1024,
    r2ClassAMonthly: 1000000,
    r2ClassBMonthly: 10000000,
    r2StorageBytes: 10 * 1024 * 1024 * 1024,
};

// R2 操作分类
const R2_CLASS_A_ACTIONS = new Set([
    'listbuckets', 'putbucket', 'listobjects', 'listobjectsv2', 'putobject', 'copyobject',
    'completemultipartupload', 'createmultipartupload', 'lifecyclestoragetiertransition',
    'listmultipartuploads', 'uploadpart', 'uploadpartcopy', 'listparts',
    'putbucketencryption', 'putbucketcors', 'putbucketlifecycleconfiguration',
]);

const R2_CLASS_B_ACTIONS = new Set([
    'headbucket', 'headobject', 'getobject', 'usagesummary', 'getbucketencryption',
    'getbucketlocation', 'getbucketcors', 'getbucketlifecycleconfiguration',
]);

const R2_FREE_ACTIONS = new Set([
    'deleteobject', 'deleteobjects', 'deletebucket', 'abortmultipartupload',
]);

// 默认参数
const DEFAULT_CHECK_INTERVAL_MS = 20 * 60 * 1000;
const DEFAULT_MAX_EXTERNAL_SUBREQUESTS = 50;
const ACCOUNT_SUBREQUESTS_WITH_ID = 4;
const ACCOUNT_SUBREQUESTS_WITHOUT_ID = 5;

export {
    FREE_TIER,
    R2_CLASS_A_ACTIONS,
    R2_CLASS_B_ACTIONS,
    R2_FREE_ACTIONS,
    DEFAULT_CHECK_INTERVAL_MS,
    DEFAULT_MAX_EXTERNAL_SUBREQUESTS,
    ACCOUNT_SUBREQUESTS_WITH_ID,
    ACCOUNT_SUBREQUESTS_WITHOUT_ID,
};
