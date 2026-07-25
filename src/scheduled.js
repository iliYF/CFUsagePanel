/**
 * 定时任务处理模块。
 * 由 wrangler 的 scheduled trigger 触发。
 * 每 6 小时自动执行一次，刷新所有过期账号的用量数据。
 */

import { refreshUsage } from './services/usage.js';

/**
 * 执行定时用量刷新。
 * 记录任务执行的时间点和耗时，便于排查问题。
 */
async function handleScheduled(env) {
    const startTime = Date.now();
    const startTimeStr = new Date(startTime).toISOString();
    console.log(`[Scheduled] 定时任务开始执行，时间: ${startTimeStr}`);

    try {
        await refreshUsage(env);
        const elapsed = Date.now() - startTime;
        console.log(`[Scheduled] 定时任务执行完成，耗时: ${elapsed}ms`);
    } catch (error) {
        const elapsed = Date.now() - startTime;
        console.error(`[Scheduled] 定时任务执行失败，耗时: ${elapsed}ms，错误: ${error.message}`);
        throw error;
    }
}

export { handleScheduled };
