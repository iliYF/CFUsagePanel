/**
 * UsagePanel 共享 JavaScript 逻辑。
 * 主题切换、Toast、资源统计渲染、工具函数。
 * 由 index.html 和 admin.html 共同引用。
 */

var usageToken = '';

/** 初始化：从 API 获取临时访问 Token */
async function initToken() {
    try {
        const res = await fetch('/api/auth/token');
        const data = await res.json();
        if (data.success) {
            usageToken = data.data.token;
            return true;
        }
    } catch (err) {
        console.error('获取 Token 失败:', err);
    }
    return false;
}

/** 主题切换 **/
function initTheme() {
    var saved = localStorage.getItem('theme');
    if (saved === 'light' || (!saved && window.matchMedia('(prefers-color-scheme: light)').matches)) {
        document.documentElement.classList.add('light-mode');
    }
}

function toggleTheme() {
    document.documentElement.classList.toggle('light-mode');
    localStorage.setItem('theme', document.documentElement.classList.contains('light-mode') ? 'light' : 'dark');
    updateThemeIcons();
}

function updateThemeIcons() {
    var sun = document.getElementById('sun-icon');
    var moon = document.getElementById('moon-icon');
    if (!sun || !moon) return;
    if (document.documentElement.classList.contains('light-mode')) {
        sun.style.display = 'none';
        moon.style.display = 'block';
    } else {
        sun.style.display = 'block';
        moon.style.display = 'none';
    }
}

/** Toast 消息提示 **/
function showToast(msg) {
    var toast = document.getElementById('toast');
    if (toast) {
        toast.textContent = msg;
        toast.classList.add('active');
        setTimeout(function () { toast.classList.remove('active'); }, 3000);
    }
}

/** 根据百分比计算颜色（绿 → 黄 → 红） **/
function getGradientColor(percent) {
    percent = Math.max(0, Math.min(100, percent));
    var t, r, g, b;
    if (percent <= 50) {
        t = percent / 50;
        r = Math.round(16 + (234 - 16) * t);
        g = Math.round(185 + (179 - 185) * t);
        b = Math.round(129 - 129 * t);
    } else {
        t = (percent - 50) / 50;
        r = Math.round(234 + (239 - 234) * t);
        g = Math.round(179 - 179 * t);
        b = Math.round(8 + (68 - 8) * t);
    }
    return 'rgb(' + r + ', ' + g + ', ' + b + ')';
}

/** 获取对应百分比的阴影色 **/
function getGradientShadow(percent) {
    var color = getGradientColor(percent);
    var rgb = color.match(/\d+/g);
    return 'rgba(' + rgb[0] + ', ' + rgb[1] + ', ' + rgb[2] + ', 0.4)';
}

/** 应用颜色到进度条容器 **/
function applyGradientColor(container, percent) {
    var color = getGradientColor(percent);
    var shadow = getGradientShadow(percent);
    container.style.setProperty('--gradient-color', color);
    container.style.setProperty('--gradient-color-shadow', '0 0 20px ' + shadow);
    var bar = container.querySelector('.progress-bar');
    if (bar && percent > 0) {
        var bgSize = (100 / percent) * 100;
        bar.style.setProperty('--bg-size', bgSize + '%');
    }
}

/** 计算百分比 **/
function percentOf(used, limit) {
    used = Number(used) || 0;
    limit = Number(limit) || 0;
    return limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
}

/** 数字格式化 **/
function formatNumber(value) {
    return (Number(value) || 0).toLocaleString();
}

/** 字节格式化 **/
function formatBytes(bytes) {
    bytes = Number(bytes) || 0;
    if (bytes >= 1024 * 1024 * 1024) return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB';
    if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(2) + ' MB';
    if (bytes >= 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return bytes.toLocaleString() + ' B';
}

/** 提取 resources 字段 **/
function getResources(data) {
    return (data && data.resources) || { d1: {}, kv: {}, r2: {} };
}

/** 渲染单条配额进度条 **/
function renderQuotaBar(label, used, limit, formatter) {
    formatter = formatter || formatNumber;
    var percent = percentOf(used, limit);
    var color = getGradientColor(percent);
    return '<div class="quota-row">' +
        '<div class="quota-top">' +
            '<span class="quota-title">' + label + '</span>' +
            '<span class="quota-meta">' + formatter(used) + ' / ' + formatter(limit) + ' · ' + percent.toFixed(1) + '%</span>' +
        '</div>' +
        '<div class="quota-track"><div class="quota-fill" style="width:' + percent + '%; background:' + color + '"></div></div>' +
    '</div>';
}

/** 渲染资源分组 **/
function renderQuotaGroup(title, meta, rows) {
    return '<div class="quota-item">' +
        '<div class="quota-group-head">' +
            '<span class="quota-group-title">' + title + '</span>' +
            '<span class="quota-group-meta">' + meta + '</span>' +
        '</div>' +
        rows.join('') +
    '</div>';
}

/** 渲染资源配额细节 **/
function renderResourceQuotas(resources) {
    var d1 = resources.d1 || {};
    var kv = resources.kv || {};
    var r2 = resources.r2 || {};
    return '<details class="quota-details">' +
        '<summary class="quota-summary"><span class="quota-summary-title">资源额度细节</span><span class="quota-summary-meta">KV / D1 / R2</span></summary>' +
        '<div class="quota-body"><div class="quota-list">' +
            renderQuotaGroup('KV', formatNumber(kv.namespaces || 0) + ' 个命名空间', [
                renderQuotaBar('读取（今日）', kv.reads, kv.readsLimit),
                renderQuotaBar('写入（今日）', kv.writes, kv.writesLimit),
                renderQuotaBar('删除（今日）', kv.deletes, kv.deletesLimit),
                renderQuotaBar('列表（今日）', kv.lists, kv.listsLimit),
                renderQuotaBar('存储大小', kv.storageBytes, kv.storageLimitBytes, formatBytes),
                '<div class="resource-note">总操作次数: ' + formatNumber(kv.operations || 0) + ' | 总 Key 数: ' + formatNumber(kv.keys || 0) + '</div>',
            ]) +
            renderQuotaGroup('D1', formatNumber(d1.databases || 0) + ' 个数据库', [
                renderQuotaBar('读取行数（今日）', d1.rowsRead, d1.rowsReadLimit),
                renderQuotaBar('写入行数（今日）', d1.rowsWritten, d1.rowsWrittenLimit),
                renderQuotaBar('存储大小', d1.storageBytes, d1.storageLimitBytes, formatBytes),
                '<div class="resource-note">读取查询: ' + formatNumber(d1.readQueries || 0) + ' | 写入查询: ' + formatNumber(d1.writeQueries || 0) + '</div>',
            ]) +
            renderQuotaGroup('R2', formatNumber(r2.buckets || 0) + ' 个存储桶', [
                renderQuotaBar('A 类操作（本月）', r2.classA, r2.classALimit),
                renderQuotaBar('B 类操作（本月）', r2.classB, r2.classBLimit),
                renderQuotaBar('存储大小', r2.storageBytes, r2.storageLimitBytes, formatBytes),
                '<div class="resource-note">免费操作: ' + formatNumber(r2.free || 0) + ' | 其他: ' + formatNumber(r2.other || 0) + ' | 总操作: ' + formatNumber(r2.operations || 0) + ' | 对象数: ' + formatNumber(r2.objects || 0) + '</div>',
            ]) +
        '</div></div>' +
    '</details>';
}

/** 动画相关 **/
function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function resetQuotaBody(body) {
    body.style.height = '';
    body.style.opacity = '';
    body.style.transform = '';
    body.style.overflow = '';
}

function animateQuotaDetails(details, opening) {
    var body = details.querySelector('.quota-body');
    if (!body || typeof body.animate !== 'function') {
        details.open = opening;
        return;
    }
    details.classList.add('quota-animating');
    body.style.overflow = 'hidden';
    if (opening) {
        details.open = true;
        body.style.height = '0px';
        body.style.opacity = '0';
        body.style.transform = 'translateY(6px)';
    } else {
        body.style.height = body.scrollHeight + 'px';
        body.style.opacity = '1';
        body.style.transform = 'translateY(0)';
    }
    var startHeight = opening ? 0 : body.scrollHeight;
    var endHeight = opening ? body.scrollHeight : 0;
    var animation = body.animate([
        { height: startHeight + 'px', opacity: opening ? 0 : 1, transform: opening ? 'translateY(6px)' : 'translateY(0)' },
        { height: endHeight + 'px', opacity: opening ? 1 : 0, transform: opening ? 'translateY(0)' : 'translateY(6px)' }
    ], {
        duration: 260,
        easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
        fill: 'forwards'
    });
    animation.onfinish = function () {
        animation.cancel();
        if (!opening) details.open = false;
        resetQuotaBody(body);
        details.classList.remove('quota-animating');
    };
    animation.oncancel = function () {
        resetQuotaBody(body);
        details.classList.remove('quota-animating');
    };
}

function bindQuotaDetailsAnimations(scope) {
    if (!scope) return;
    scope.querySelectorAll('.quota-details').forEach(function (details) {
        if (details.dataset.quotaAnimationBound) return;
        var summary = details.querySelector('.quota-summary');
        var body = details.querySelector('.quota-body');
        if (!summary || !body) return;
        details.dataset.quotaAnimationBound = 'true';
        summary.addEventListener('click', function (event) {
            if (prefersReducedMotion() || typeof body.animate !== 'function') return;
            event.preventDefault();
            if (details.classList.contains('quota-animating')) return;
            animateQuotaDetails(details, !details.open);
        });
    });
}
