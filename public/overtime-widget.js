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

    sessionStorage.setItem(
      AUTH_KEY,
      JSON.stringify({ name, idNumber, isAdmin: Boolean(isAdmin) }),
    );
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
    }
  });

  function openOvertimePage(queryName) {
    const auth = readAuth();
    if (!auth?.name || !auth?.idNumber) {
      window.alert('登入資訊已失效，請登出後重新登入');
      return;
    }

    const params = new URLSearchParams({ name: queryName });
    window.location.assign(`/overtime.html?${params.toString()}`);
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
    subLabel.textContent = '查看時數異常資料';

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
          window.alert('請先輸入要查詢的員工姓名');
          input?.focus();
          return;
        }

        openOvertimePage(queryName);
        return;
      }

      const auth = readAuth();
      if (!auth?.name) {
        window.alert('登入資訊已失效，請登出後重新登入');
        return;
      }

      openOvertimePage(auth.name);
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
