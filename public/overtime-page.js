(() => {
  'use strict';

  const AUTH_KEY = 'hongsheng_overtime_auth';
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

  function renderResults(data) {
    content.replaceChildren();

    const summary = document.createElement('p');
    summary.className = 'results-summary';
    summary.textContent = `共找到 ${data.rows.length} 筆異常工時資料`;

    const cards = document.createElement('div');
    cards.className = 'cards';

    data.rows.forEach((row, rowIndex) => {
      const card = document.createElement('article');
      card.className = 'record-card';

      const header = document.createElement('div');
      header.className = 'record-header';

      const title = document.createElement('strong');
      title.textContent = `異常工時紀錄 ${rowIndex + 1}`;

      const source = document.createElement('span');
      source.textContent = data.sheetName || '時數異常';

      header.append(title, source);

      const list = document.createElement('dl');
      list.className = 'field-list';

      data.headers.forEach((headerText, columnIndex) => {
        list.appendChild(createFieldRow(headerText, row[columnIndex]));
      });

      card.append(header, list);
      cards.appendChild(card);
    });

    content.append(summary, cards);

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
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.assign('/');
    }
  });

  loadData();
})();
