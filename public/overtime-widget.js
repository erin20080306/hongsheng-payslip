(() => {
  'use strict';

  const AUTH_KEY = 'hongsheng_overtime_auth';
  const BUTTON_ATTRIBUTE = 'data-overtime-entry';
  const nativeFetch = window.fetch.bind(window);

  function normalize(value) {
    return (value || '').toString().trim();
  }

  function readAuth() {
    try {
      return JSON.parse(sessionStorage.getItem(AUTH_KEY) || 'null');
    } catch {
      return null;
    }
  }

  function saveAuth(credentials, isAdmin) {
    const name = normalize(credentials?.name);
    const idNumber = normalize(credentials?.idNumber);
    if (!name || !idNumber) return;

    sessionStorage.setItem(AUTH_KEY, JSON.stringify({ name, idNumber, isAdmin: Boolean(isAdmin) }));
  }

  window.fetch = async function hongshengFetch(input, init = {}) {
    const response = await nativeFetch(input, init);

    try {
      const url = typeof input === 'string' ? input : input?.url || '';
      const method = normalize(init?.method || input?.method || 'GET').toUpperCase();
      if (url.includes('/api/verify') && method === 'POST' && typeof init?.body === 'string') {
        const credentials = JSON.parse(init.body);
        const result = await response.clone().json();
        if (result?.ok) {
          saveAuth(credentials, result.isAdmin);
        } else {
          sessionStorage.removeItem(AUTH_KEY);
        }
      }
    } catch (error) {
      console.debug('Overtime auth capture skipped:', error);
    }

    return response;
  };

  document.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (button && normalize(button.textContent).includes('登出')) {
      sessionStorage.removeItem(AUTH_KEY);
      closeModal();
    }
  });

  function installStyles() {
    if (document.getElementById('hs-overtime-styles')) return;

    const style = document.createElement('style');
    style.id = 'hs-overtime-styles';
    style.textContent = `
      .hs-overtime-overlay {
        position: fixed;
        inset: 0;
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        background: rgba(15, 23, 42, 0.72);
        backdrop-filter: blur(8px);
      }
      .hs-overtime-dialog {
        width: min(980px, 100%);
        max-height: 90vh;
        overflow: hidden;
        border-radius: 28px;
        background: #fff;
        box-shadow: 0 30px 80px rgba(15, 23, 42, 0.28);
      }
      .hs-overtime-header {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 22px 24px;
        border-bottom: 1px solid #e2e8f0;
      }
      .hs-overtime-title { flex: 1; min-width: 0; }
      .hs-overtime-title h2 { margin: 0; color: #0f172a; font-size: 21px; font-weight: 900; }
      .hs-overtime-title p { margin: 5px 0 0; color: #64748b; font-size: 13px; }
      .hs-overtime-close {
        width: 42px;
        height: 42px;
        border: 0;
        border-radius: 14px;
        color: #475569;
        background: #f1f5f9;
        cursor: pointer;
        font-size: 24px;
        line-height: 1;
      }
      .hs-overtime-body { max-height: calc(90vh - 88px); overflow: auto; padding: 24px; }
      .hs-overtime-status { padding: 44px 20px; text-align: center; color: #475569; font-weight: 700; }
      .hs-overtime-error { padding: 18px; border: 1px solid #fecaca; border-radius: 16px; color: #b91c1c; background: #fef2f2; text-align: center; font-weight: 700; }
      .hs-overtime-table-wrap { overflow-x: auto; border: 1px solid #e2e8f0; border-radius: 18px; }
      .hs-overtime-table { width: 100%; min-width: 760px; border-collapse: collapse; }
      .hs-overtime-table th { position: sticky; top: 0; z-index: 1; padding: 13px 14px; border-bottom: 1px solid #cbd5e1; background: #eff6ff; color: #1e3a8a; text-align: left; font-size: 13px; font-weight: 900; white-space: nowrap; }
      .hs-overtime-table td { padding: 13px 14px; border-bottom: 1px solid #e2e8f0; color: #334155; font-size: 14px; font-weight: 600; white-space: pre-wrap; }
      .hs-overtime-table tr:last-child td { border-bottom: 0; }
      .hs-overtime-table tbody tr:nth-child(even) { background: #f8fafc; }
      .hs-overtime-count { margin: 0 0 12px; color: #64748b; font-size: 13px; font-weight: 700; }
      @media (max-width: 640px) {
        .hs-overtime-overlay { padding: 10px; align-items: flex-end; }
        .hs-overtime-dialog { max-height: 94vh; border-radius: 24px 24px 0 0; }
        .hs-overtime-header { padding: 18px; }
        .hs-overtime-body { max-height: calc(94vh - 80px); padding: 16px; }
      }
    `;
    document.head.appendChild(style);
  }

  function closeModal() {
    document.getElementById('hs-overtime-overlay')?.remove();
  }

  function createModal(titleName) {
    installStyles();
    closeModal();

    const overlay = document.createElement('div');
    overlay.id = 'hs-overtime-overlay';
    overlay.className = 'hs-overtime-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    const dialog = document.createElement('div');
    dialog.className = 'hs-overtime-dialog';

    const header = document.createElement('div');
    header.className = 'hs-overtime-header';

    const title = document.createElement('div');
    title.className = 'hs-overtime-title';
    const heading = document.createElement('h2');
    heading.textContent = '異常工時查詢';
    const subtitle = document.createElement('p');
    subtitle.textContent = `員工：${titleName}`;
    title.append(heading, subtitle);

    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'hs-overtime-close';
    closeButton.setAttribute('aria-label', '關閉');
    closeButton.textContent = '×';
    closeButton.addEventListener('click', closeModal);

    const body = document.createElement('div');
    body.className = 'hs-overtime-body';
    body.id = 'hs-overtime-body';

    header.append(title, closeButton);
    dialog.append(header, body);
    overlay.appendChild(dialog);
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) closeModal();
    });
    document.body.appendChild(overlay);

    return body;
  }

  function renderStatus(body, message) {
    body.replaceChildren();
    const status = document.createElement('div');
    status.className = 'hs-overtime-status';
    status.textContent = message;
    body.appendChild(status);
  }

  function renderError(body, message) {
    body.replaceChildren();
    const error = document.createElement('div');
    error.className = 'hs-overtime-error';
    error.textContent = message;
    body.appendChild(error);
  }

  function renderTable(body, data) {
    body.replaceChildren();

    const count = document.createElement('p');
    count.className = 'hs-overtime-count';
    count.textContent = `共找到 ${data.rows.length} 筆資料（來源：${data.sheetName}）`;

    const wrapper = document.createElement('div');
    wrapper.className = 'hs-overtime-table-wrap';
    const table = document.createElement('table');
    table.className = 'hs-overtime-table';
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');

    data.headers.forEach((header) => {
      const th = document.createElement('th');
      th.textContent = header || '-';
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);

    const tbody = document.createElement('tbody');
    data.rows.forEach((row) => {
      const tr = document.createElement('tr');
      row.forEach((value) => {
        const td = document.createElement('td');
        td.textContent = value || '-';
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });

    table.append(thead, tbody);
    wrapper.appendChild(table);
    body.append(count, wrapper);
  }

  async function queryOvertime(queryName) {
    const auth = readAuth();
    const body = createModal(queryName);

    if (!auth?.name || !auth?.idNumber) {
      renderError(body, '登入資訊已失效，請登出後重新登入');
      return;
    }

    renderStatus(body, '正在查詢異常工時資料…');

    try {
      const response = await nativeFetch('/api/overtime-anomalies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
          name: queryName,
          authName: auth.name,
          authIdNumber: auth.idNumber,
        }),
      });
      const data = await response.json();

      if (!response.ok || data.error) {
        renderError(body, data.error || '查詢失敗，請稍後再試');
        return;
      }

      renderTable(body, data);
    } catch (error) {
      console.error('Overtime query failed:', error);
      renderError(body, '網路錯誤，請稍後再試');
    }
  }

  function createEntryButton(mode, card) {
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute(BUTTON_ATTRIBUTE, mode);
    button.className = 'w-full flex items-center gap-4 p-5 bg-slate-50 hover:bg-blue-600 hover:text-white rounded-2xl font-bold text-slate-700 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg disabled:opacity-50 group';

    const iconBox = document.createElement('div');
    iconBox.className = 'w-12 h-12 bg-blue-100 group-hover:bg-white/20 rounded-xl flex items-center justify-center';
    iconBox.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.3 2.9 1.8 17a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 2.9a2 2 0 0 0-3.4 0Z"/></svg>';
    iconBox.style.color = '#2563eb';

    const labels = document.createElement('div');
    labels.className = 'text-left';
    const mainLabel = document.createElement('div');
    mainLabel.className = 'text-lg';
    mainLabel.textContent = '異常工時查詢';
    const subLabel = document.createElement('div');
    subLabel.className = 'text-sm opacity-60 font-normal';
    subLabel.textContent = '查看時數異常 A～H 欄資料';
    labels.append(mainLabel, subLabel);

    const arrow = document.createElement('span');
    arrow.className = 'ml-auto opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all';
    arrow.textContent = '→';
    arrow.style.fontSize = '22px';

    button.append(iconBox, labels, arrow);
    button.addEventListener('click', () => {
      if (mode === 'admin') {
        const input = card.querySelector('input[placeholder="請輸入員工姓名"]');
        const queryName = normalize(input?.value);
        if (!queryName) {
          const body = createModal('尚未輸入');
          renderError(body, '請先輸入要查詢的員工姓名');
          return;
        }
        queryOvertime(queryName);
        return;
      }

      const auth = readAuth();
      if (!auth?.name) {
        const body = createModal('登入者');
        renderError(body, '登入資訊已失效，請登出後重新登入');
        return;
      }
      queryOvertime(auth.name);
    });

    return button;
  }

  function findCardByHeading(text) {
    return Array.from(document.querySelectorAll('h2'))
      .find((heading) => normalize(heading.textContent) === text)
      ?.parentElement || null;
  }

  function injectButtons() {
    const normalCard = findCardByHeading('歡迎回來');
    if (normalCard) {
      const actions = normalCard.querySelector('.space-y-4');
      if (actions && !actions.querySelector(`[${BUTTON_ATTRIBUTE}="user"]`)) {
        actions.appendChild(createEntryButton('user', normalCard));
      }
    }

    const adminCard = findCardByHeading('管理者查詢');
    if (adminCard) {
      const actions = adminCard.querySelector('.space-y-4');
      if (actions && !actions.querySelector(`[${BUTTON_ATTRIBUTE}="admin"]`)) {
        actions.appendChild(createEntryButton('admin', adminCard));
      }
    }
  }

  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      injectButtons();
    });
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', injectButtons);
  injectButtons();
})();
