/**
 * 演示数据（DEMO 模式）。
 * 从 usage.json 和 usage_config.json 导入，由 DEMO 环境变量控制。
 */

import usageConfigData from './usage_config.json' with { type: 'json' };
import usageSummaryData from './usage.json' with { type: 'json' };

export const demoConfig = usageConfigData;
export const demoUsage = usageSummaryData;
