/**
 * UsagePanel 管理面板专用 JavaScript。
 * 账号管理、CRUD 操作、刷新控制。
 */

/** 复制 Usage API URL **/
function copyUsageAPI() {
    var url = 'https://' + window.location.hostname + '/api/usage?token=' + usageToken;
    navigator.clipboard.writeText(url).then(function () {
        showToast('UsageAPI 已复制到粘贴板');
    });
}

/** 登出 **/
async function logout() {
    try {
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.href = '/';
    } catch (err) {
        showToast('登出失败');
    }
}

/** 强制刷新所有账号用量数据 **/
async function forceRefresh() {
    var btn = document.getElementById('refresh-btn');
    if (!btn) return;

    btn.disabled = true;
    var originalHtml = btn.innerHTML;
    btn.innerHTML = '<span class="spinner"></span>';

    try {
        var res = await fetch('/api/admin/usage?force=1&t=' + Date.now());
        var data = await res.json();
        showToast('✅ 数据已强制刷新');
        fetchSummary();
        fetchConfig();
    } catch (err) {
        showToast('❌ 刷新失败');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalHtml;
    }
}

/** 获取汇总使用数据 **/
async function fetchSummary() {
    var container = document.getElementById('summary-content');
    try {
        var res = await fetch('/api/admin/usage?t=' + Date.now());
        var data = await res.json();

        var total = data.total || 0;
        var max = data.max || 100000;
        var percent = Math.min((total / max) * 100, 100).toFixed(1);
        var resources = getResources(data);

        container.innerHTML =
            '<div class="usage-section">' +
                '<div class="usage-header">' +
                    '<span class="label">总请求占比</span>' +
                    '<span class="percentage">' + percent + '%</span>' +
                '</div>' +
                '<div class="progress-track">' +
                    '<div class="progress-bar" style="width: ' + percent + '%"></div>' +
                '</div>' +
                '<div class="total-text">' +
                    total.toLocaleString() + ' / ' + max.toLocaleString() + ' 总计请求' +
                '</div>' +
            '</div>' +
            '<div class="stats-grid">' +
                '<div class="mini-card">' +
                    '<div class="mini-icon">🔶</div>' +
                    '<div class="mini-info">' +
                        '<div class="mini-label">Workers</div>' +
                        '<div class="mini-value">' + (data.workers || 0).toLocaleString() + '</div>' +
                    '</div>' +
                '</div>' +
                '<div class="mini-card">' +
                    '<div class="mini-icon">⚡️</div>' +
                    '<div class="mini-info">' +
                        '<div class="mini-label">Pages</div>' +
                        '<div class="mini-value">' + (data.pages || 0).toLocaleString() + '</div>' +
                    '</div>' +
                '</div>' +
            '</div>' +
            renderResourceQuotas(resources);

        bindQuotaDetailsAnimations(container, true);
        var usageSection = container.querySelector('.usage-section');
        applyGradientColor(usageSection, percent);
    } catch (err) {
        container.innerHTML = '<div style="color: var(--danger)">加载汇总数据失败</div>';
    }
}

/** 获取账号配置列表 **/
async function fetchConfig() {
    var container = document.getElementById('config-content');
    try {
        var res = await fetch('/api/admin/config?t=' + Date.now());
        var data = await res.json();

        if (data.length === 0) {
            container.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 2rem;">暂无账号，请点击上方按钮添加</div>';
            return;
        }

        // 存储账号数据供 tab 切换使用
        window._accountData = data;
        renderAccountTabs(data, 0);
    } catch (err) {
        container.innerHTML = '<div style="color: var(--danger)">加载详情数据失败</div>';
    }
}

/** 渲染 Tab 切换栏 + 当前选中账号 **/
function renderAccountTabs(data, activeIndex) {
    var container = document.getElementById('config-content');
    var active = Math.min(activeIndex, data.length - 1);

    var html = '';

    // Tab 栏
    html += '<div class="account-tabs">';
    for (var i = 0; i < data.length; i++) {
        var isActive = (i === active);
        html += '<button class="account-tab' + (isActive ? ' active' : '') + '" onclick="renderAccountTabs(window._accountData, ' + i + ')">'
            + '<span class="tab-indicator"></span>'
            + data[i].Name
            + '</button>';
    }
    html += '</div>';

    // 当前账号详情
    var acc = data[active];
    var usage = acc.Usage || {};
    var resources = getResources(usage);
    var total = usage.total || 0;
    var max = usage.max || 100000;
    var percent = Math.min((total / max) * 100, 100).toFixed(1);
    var updateTimeValue = acc.UpdateTime || acc.LastCheckTime;
    var updateTime = updateTimeValue ? new Date(updateTimeValue).toLocaleString() : '从未更新';
    var percentColor = getGradientColor(percent);
    var bgSize = percent > 0 ? (100 / percent) * 100 : 100;

    var maskedId = acc.AccountID ? (acc.AccountID.length > 12 ? acc.AccountID.slice(0, 4) + '*'.repeat(acc.AccountID.length - 8) + acc.AccountID.slice(-4) : acc.AccountID) : '';

    html += '<div class="account-detail">'
        + '<div class="account-info">'
            + '<div>'
                + '<div class="account-name" onclick="openEditModal(' + acc.ID + ')" title="点击编辑账号信息">'
                    + '🔑 ' + acc.Name
                    + (acc.AccountID
                        ? ' <a class="cf-dash-link" href="https://dash.cloudflare.com/' + acc.AccountID + '/home" target="_blank" rel="noopener" title="在控制台打开" onclick="event.stopPropagation()">'
                            + '<svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" stroke="none">'
                            + '<path d="M18.5 11.5c.3-1.7-1-3.3-2.7-3.6-1-.2-2 .2-2.7.9-.3-2.2-2.1-3.9-4.3-3.9-2.4 0-4.3 1.9-4.3 4.3 0 .3 0 .6.1.9C3 10.6 2 12 2 13.7c0 1.9 1.6 3.4 3.5 3.4h12.4c1.7 0 3.1-1.4 3.1-3.1 0-1.5-1.1-2.8-2.5-3z"/>'
                            + '</svg></a>'
                        : '')
                    + (acc.PanelURL
                        ? ' <a class="panel-link" href="' + acc.PanelURL + '" target="_blank" rel="noopener" title="打开面板" onclick="event.stopPropagation()">👽</a>'
                        : ' <span class="panel-link disabled" title="添加面板访问地址" onclick="event.stopPropagation()">👽</span>')
                + '</div>'
                + (acc.AccountID
                    ? '<div class="account-id">🔒 AccountID: <span>' + maskedId + '</span>'
                        + ' <button class="copy-btn" onclick="event.stopPropagation(); copyToClipboard(\'' + acc.AccountID + '\')" title="复制 Account ID">'
                            + '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
                            + '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>'
                            + '</svg></button></div>'
                    : '<div class="account-id">📧 Email: ' + (acc.Email || '') + '</div>')
                + '<div class="account-id" style="margin-top: 4px; opacity: 0.8;">🕒 更新时间: ' + updateTime + '</div>'
            + '</div>'
            + '<button class="delete-btn" onclick="deleteAccount(' + acc.ID + ')">删除账号</button>'
        + '</div>'
        + '<div class="usage-section" style="margin-bottom: 0">'
            + '<div class="usage-header">'
                + '<span class="label">请求使用情况: ' + total.toLocaleString() + ' / ' + max.toLocaleString()
                + ' <b style="color: ' + percentColor + '; margin-left: 4px;">' + percent + '%</b></span>'
                + '<span class="label" style="font-size: 0.8rem; font-variant-numeric: tabular-nums;">'
                    + 'W: ' + (usage.workers || 0).toLocaleString() + ' | P: ' + (usage.pages || 0).toLocaleString()
                + '</span>'
            + '</div>'
            + '<div class="progress-track" style="height: 8px">'
                + '<div class="progress-bar" style="width: ' + percent + '%; --bg-size: ' + bgSize + '%"></div>'
            + '</div>'
        + '</div>'
        + renderResourceQuotas(resources)
    + '</div>';

    container.innerHTML = html;
    bindQuotaDetailsAnimations(container);

    // 滚动到选中的 Tab 居中显示
    var tabs = container.querySelector('.account-tabs');
    var activeTab = container.querySelector('.account-tab.active');
    if (tabs && activeTab) {
        var tabLeft = activeTab.offsetLeft - 16;
        var tabWidth = activeTab.offsetWidth;
        var scrollTo = tabLeft - (tabs.offsetWidth - tabWidth) / 2;
        tabs.scrollTo({ left: Math.max(0, scrollTo), behavior: 'smooth' });
    }
}

/** 打开添加账号模态框 **/
function openAddModal() {
    document.getElementById('addModal').classList.add('active');
    document.getElementById('addModal').dataset.mode = 'add';
    document.getElementById('addModal').dataset.editId = '';
    document.getElementById('modalTitle').textContent = '添加 Cloudflare 账号';
    document.getElementById('modalSubmit').textContent = '确认添加';
    document.getElementById('authMethod').value = 'token';
    switchAuthMethod();
}

/** 打开编辑账号模态框 **/
function openEditModal(id) {
    var data = window._accountData || [];
    var acc = data.find(function (item) { return item.ID === id; });
    if (!acc) return;

    document.getElementById('addModal').classList.add('active');
    document.getElementById('addModal').dataset.mode = 'edit';
    document.getElementById('addModal').dataset.editId = id;
    document.getElementById('modalTitle').textContent = '更新 Cloudflare 账号';
    document.getElementById('modalSubmit').textContent = '保存更新';

    // 填充表单
    document.getElementById('newName').value = acc.Name || '';
    document.getElementById('newPanelURL').value = acc.PanelURL || '';

    if (acc.AccountID && acc.APIToken) {
        document.getElementById('authMethod').value = 'token';
        document.getElementById('newAccountID').value = acc.AccountID || '';
        document.getElementById('newAPIToken').value = acc.APIToken || '';
    } else if (acc.Email && acc.GlobalAPIKey) {
        document.getElementById('authMethod').value = 'global';
        document.getElementById('newEmail').value = acc.Email || '';
        document.getElementById('newGlobalAPIKey').value = acc.GlobalAPIKey || '';
    }
    switchAuthMethod();
}

/** 切换认证方式表单 **/
function switchAuthMethod() {
    var method = document.getElementById('authMethod').value;
    document.getElementById('tokenFields').style.display = method === 'token' ? 'block' : 'none';
    document.getElementById('globalFields').style.display = method === 'global' ? 'block' : 'none';
}

/** 关闭添加账号模态框 **/
function closeAddModal() {
    document.getElementById('addModal').classList.remove('active');
    document.getElementById('newName').value = '';
    document.getElementById('newAccountID').value = '';
    document.getElementById('newAPIToken').value = '';
    document.getElementById('newEmail').value = '';
    document.getElementById('newGlobalAPIKey').value = '';
    document.getElementById('newPanelURL').value = '';
}

/** 添加/更新账号 **/
async function handleAddAccount() {
    var name = document.getElementById('newName').value;
    var method = document.getElementById('authMethod').value;
    var panelURL = document.getElementById('newPanelURL').value;
    var accountID = null, apiToken = null, email = null, globalAPIKey = null;

    var isEdit = document.getElementById('addModal').dataset.mode === 'edit';
    var editId = parseInt(document.getElementById('addModal').dataset.editId) || 0;

    if (method === 'token') {
        accountID = document.getElementById('newAccountID').value;
        apiToken = document.getElementById('newAPIToken').value;
        if (!name || !accountID || !apiToken) {
            showToast('⚠️ 请填写完整信息');
            return;
        }
    } else {
        email = document.getElementById('newEmail').value;
        globalAPIKey = document.getElementById('newGlobalAPIKey').value;
        if (!name || !email || !globalAPIKey) {
            showToast('⚠️ 请填写完整信息');
            return;
        }
    }

    var apiUrl = isEdit ? '/api/accounts/update' : '/api/accounts/add';
    var body = {
        Name: name,
        AccountID: accountID,
        APIToken: apiToken,
        Email: email,
        GlobalAPIKey: globalAPIKey,
        PanelURL: panelURL || null,
    };
    if (isEdit) body.ID = editId;

    try {
        var res = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        var data = await res.json();
        if (data.success) {
            showToast('✅ ' + (isEdit ? '更新成功' : '添加成功') + '，正在刷新数据...');
            closeAddModal();
            setTimeout(function () {
                fetchSummary();
                fetchConfig();
            }, 1000);
        } else {
            showToast('❌ ' + (data.msg || (isEdit ? '更新失败' : '添加失败')));
        }
    } catch (err) {
        showToast('❌ 网络错误');
    }
}

/** 删除账号 **/
async function deleteAccount(id) {
    if (!confirm('确定要删除这个账号吗？')) return;
    try {
        var res = await fetch('/api/accounts/del', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ID: id })
        });
        var data = await res.json();
        if (data.success) {
            showToast('✅ 删除成功，正在更新数据...');
            setTimeout(function () {
                fetchSummary();
                fetchConfig();
            }, 1000);
        } else {
            showToast('❌ ' + (data.msg || '删除失败'));
        }
    } catch (err) {
        showToast('❌ 网络错误');
    }
}

/** 复制文本到剪贴板 **/
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(function () {
        showToast('✅ AccountID 已复制');
    }).catch(function () {
        showToast('❌ 复制失败');
    });
}

/** 页面初始化 **/
document.addEventListener('DOMContentLoaded', async function () {
    initTheme();

    // 检查认证状态
    try {
        var statusRes = await fetch('/api/auth/status');
        if (!statusRes.ok) {
            window.location.href = '/';
            return;
        }
    } catch (err) {
        window.location.href = '/';
        return;
    }

    // 获取 Token
    await initToken();

    // 加载数据
    fetchSummary();
    fetchConfig();

    // 定时刷新
    setInterval(fetchSummary, 60000);
});
