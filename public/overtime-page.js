(() => {
  'use strict';

  const AUTH_KEY = 'hongsheng_overtime_auth';
  const RETURN_KEY = 'hongsheng_overtime_return_pending';
  const content = document.getElementById('content');
  const employeePill = document.getElementById('employeePill');
  const countPill = document.getElementById('countPill');
  const backButton = document.getElementById('backButton');

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

  function installDisclosureStyles() {
    if (document.getElementById('overtime-disclosure-styles')) return;

    const style = document.createElement('style');
    style.id = 'overtime-disclosure-styles';
    style.textContent = `
      .results-toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 14px;
      }
      .results-toolbar .results-summary { margin: 0; }
      .results-controls {
        display: flex;
        flex-wrap: wrap;
        justify-content: flex-end;
        gap: 8px;
      }
      .results-control-button {
        min-height: 38px;
        padding: 8px 13px;
        border: 1px solid #bfdbfe;
        border-radius: 12px;
        background: #eff6ff;
        color: #1d4ed8;
        cursor: pointer;
        font-size: 13px;
        font-weight: 900;
      }
      summary.record-header {
        cursor: pointer;
        list-style: none;
        user-select: none;
      }
      summary.record-header::-webkit-details-marker { display: none; }
      summary.record-header:focus-visible {
        outline: 3px solid rgba(37, 99, 235, 0.25);
        outline-offset: -3px;
      }
      .record-toggle-label { white-space: nowrap; }
      details.record-card:not([open]) .field-list { display: none; }
      @media (max-width: 520px) {
        .results-toolbar { align-items: flex-start; flex-direction: column; }
        .results-controls { width: 100%; justify-content: flex-start; }
      }
    `;
    document.head.appendChild(style);
  }

  function renderError(message) {
    content.replaceChildren();
    const error = document.createElement('div');
    error.className = 'error';
    error.textContent = message;
    content.appendChild(error);
  }

  function createFieldRow(label, value) {
    const row = document.createElement('div');
    row.className = 'field-row';

    const term = document.createElement('dt');
    term.textContent = label || '未命名欄位';

    const description = document.createElement('dd');
    description.textContent = value || '-';

    row.append(term, description);
    return row;
  }

  function createControlButton(label, onClick) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'results-control-button';
    button.textContent = label;
    button.addEventListener('click', onClick);
    return button;
  }

  function renderResults(data) {
    installDisclosureStyles();
    content.replaceChildren();

    const toolbar = document.createElement('div');
    toolbar.className = 'results-toolbar';

    const summary = document.createElement('p');
    summary.className = 'results-summary';
    summary.textContent = `共找到 ${data.rows.length} 筆異常工時資料`;
    toolbar.appendChild(summary);

    const cards = document.createElement('div');
    cards.className = 'cards';

    const detailCards = [];

    data.rows.forEach((row, rowIndex) => {
      const card = document.createElement('details');
      card.className = 'record-card';
      card.open = rowIndex === 0;

      const header = document.createElement('summary');
      header.className = 'record-header';

      const title = document.createElement('strong');
      title.textContent = `異常工時紀錄 ${rowIndex + 1}`;

      const toggleLabel = document.createElement('span');
      toggleLabel.className = 'record-toggle-label';

      const updateToggleLabel = () => {
        toggleLabel.textContent = card.open ? '收合 ▲' : '展開 ▼';
        header.setAttribute('aria-expanded', card.open ? 'true' : 'false');
      };

      updateToggleLabel();
      card.addEventListener('toggle', updateToggleLabel);
      header.append(title, toggleLabel);

      const list = document.createElement('dl');
      list.className = 'field-list';

      data.headers.forEach((headerText, columnIndex) => {
        list.appendChild(createFieldRow(headerText, row[columnIndex]));
      });

      card.append(header, list);
      cards.appendChild(card);
      detailCards.push(card);
    });

    if (detailCards.length > 1) {
      const controls = document.createElement('div');
      controls.className = 'results-controls';
      controls.append(
        createControlButton('全部展開', () => {
          detailCards.forEach((card) => { card.open = true; });
        }),
        createControlButton('全部收合', () => {
          detailCards.forEach((card) => { card.open = false; });
        }),
      );
      toolbar.appendChild(controls);
    }

    content.append(toolbar, cards);

    countPill.hidden = false;
    countPill.textContent = `${data.rows.length} 筆資料`;
  }

  async function loadData() {
    const params = new URLSearchParams(window.location.search);
    const queryName = normalize(params.get('name'));
    const auth = readAuth();

    if (!queryName) {
      employeePill.textContent = '員工：未指定';
      renderError('沒有指定要查詢的員工姓名，請返回上一頁重新查詢。');
      return;
    }

    employeePill.textContent = `員工：${queryName}`;

    if (!auth?.name || !auth?.idNumber) {
      renderError('登入資訊已失效，請返回登入頁重新登入。');
      return;
    }

    try {
      const response = await fetch('/api/overtime-anomalies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
          name: queryName,
          authName: auth.name,
          authIdNumber: auth.idNumber,
        }),
      });

      let data;
      try {
        data = await response.json();
      } catch {
        throw new Error('伺服器回傳格式不正確');
      }

      if (!response.ok || data.error) {
        renderError(data.error || '查詢失敗，請稍後再試。');
        return;
      }

      renderResults(data);
    } catch (error) {
      console.error('Overtime page query failed:', error);
      renderError('網路錯誤，請稍後再試。');
    }
  }

  backButton?.addEventListener('click', () => {
    sessionStorage.setItem(RETURN_KEY, '1');
    window.location.assign('/?resume=overtime');
  });

  loadData();
})();
