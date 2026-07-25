/**
 * 认证工具模块。
 * 包含 Admin Cookie 验证、Token 生成、凭证解析。
 */

/**
 * 对文本进行双重 MD5 哈希。
 * 第一次：全文 MD5 → 取第 7-26 位十六进制
 * 第二次：对截取结果再 MD5 → 返回小写十六进制
 */
async function doubleMD5(text) {
    const encoder = new TextEncoder();

    const firstHash = await crypto.subtle.digest('MD5', encoder.encode(text));
    const firstBytes = Array.from(new Uint8Array(firstHash));
    const firstHex = firstBytes.map((b) => b.toString(16).padStart(2, '0')).join('');

    const secondHash = await crypto.subtle.digest('MD5', encoder.encode(firstHex.slice(7, 27)));
    const secondBytes = Array.from(new Uint8Array(secondHash));
    const secondHex = secondBytes.map((b) => b.toString(16).padStart(2, '0')).join('');

    return secondHex.toLowerCase();
}

/**
 * 从环境变量中解析管理员凭证。
 * 支持多种变量名兼容。
 */
function parseCredentials(env) {
    const username = env.USER || env.user || env.USERNAME || env.username || 'admin';
    const password = env.ADMIN || env.admin || env.PASSWORD || env.password || env.pswd;
    const isDemo = Boolean(env.DEMO);
    return { username, password, isDemo };
}

/**
 * 生成管理员 Token（基于密码+账号的双重 MD5）。
 */
async function generateAdminToken(password, username) {
    return doubleMD5(password + username);
}

/**
 * 生成管理员 Cookie 值（基于 adminToken + User-Agent 的双重 MD5）。
 */
async function generateAdminCookie(adminToken, userAgent) {
    return doubleMD5(adminToken + userAgent);
}

/**
 * 生成临时访问 Token（基于 hostname + adminToken + User-Agent 的双重 MD5）。
 */
async function generateTempToken(hostname, adminToken, userAgent) {
    return doubleMD5(hostname + adminToken + userAgent);
}

/**
 * 验证管理员 Cookie。
 * 返回 Response（401）或 null（通过）。
 */
function verifyAdminCookie(request, adminCookie) {
    const cookies = request.headers.get('Cookie') || '';
    const match = cookies.match(/admin_token=([^;]+)/);
    if (!match || match[1] !== adminCookie) {
        return new Response(
            JSON.stringify({ success: false, msg: 'Unauthorized' }),
            { status: 401, headers: { 'Content-Type': 'application/json;charset=UTF-8' } }
        );
    }
    return null;
}

export {
    doubleMD5,
    parseCredentials,
    generateAdminToken,
    generateAdminCookie,
    generateTempToken,
    verifyAdminCookie,
};
