(() => {
  'use strict';

  const NOTICE_ATTRIBUTE = 'data-payslip-anomaly-notice';
  const previousFetch = window.fetch.bind(window);
  let salaryFlowActive = false;
  let salaryHasNoData = false;

  function normalize(value) {
    return (value || '').toString().trim();
  }

  function createNotice() {
    const notice = document.createElement('div');
    notice.setAttribute(NOTICE_ATTRIBUTE, 'true');
    notice.style.margin = '14px 0 20px';
    notice.style.padding = '12px 16px';
    notice.style.border = '1px solid #fde68a';
    notice.style.borderRadius = '16px';
    notice.style.background = '#fffbeb';
    notice.style.color = '#92400e';
    notice.style.textAlign = 'left';
    notice.style.fontSize = '14px';
    notice.style.fontWeight = '700';
    notice.style.lineHeight = '1.65';

    const strong = document.createElement('span');
    strong.textContent = '提醒：';

    const text = document.createTextNode('若查不到薪資單，請至「異常工時查詢」區查看。');
    notice.append(strong, text);
    return notice;
  }

  function findCardByHeading(text) {
    return Array.from(document.querySelectorAll('h2'))
      .find((heading) => normalize(heading.textContent) === text)
      ?.parentElement || null;
  }

  function removeAllNotices() {
    document.querySelectorAll(`[${NOTICE_ATTRIBUTE}]`).forEach((notice) => notice.remove());
  }

  function injectIntoOptionsPage() {
    const card = findCardByHeading('選擇薪資單');
    if (!card || card.querySelector(`[${NOTICE_ATTRIBUTE}]`)) return false;

    const instruction = Array.from(card.querySelectorAll('p'))
      .find((paragraph) => normalize(paragraph.textContent).includes('點選要查詢的薪資日期'));

    const notice = createNotice();
    if (instruction) {
      instruction.insertAdjacentElement('afterend', notice);
    } else {
      const heading = card.querySelector('h2');
      heading?.insertAdjacentElement('afterend', notice);
    }
    return true;
  }

  function injectNoDataNotice() {
    if (!salaryHasNoData) return false;

    const card = findCardByHeading('歡迎回來') || findCardByHeading('管理者查詢');
    if (!card || card.querySelector(`[${NOTICE_ATTRIBUTE}]`)) return false;

    const actions = card.querySelector('.space-y-4');
    if (!actions) return false;

    actions.parentElement?.insertBefore(createNotice(), actions);
    return true;
  }

  function refreshNotice() {
    removeAllNotices();
    if (!salaryFlowActive) return;

    if (injectIntoOptionsPage()) return;
    injectNoDataNotice();
  }

  window.fetch = async function payslipNoticeFetch(input, init = {}) {
    const response = await previousFetch(input, init);

    try {
      const url = typeof input === 'string' ? input : input?.url || '';
      const method = normalize(init?.method || input?.method || 'GET').toUpperCase();
      if (salaryFlowActive && url.includes('/api/options') && method === 'POST') {
        const data = await response.clone().json();
        salaryHasNoData = !(Array.isArray(data?.keys) && data.keys.length > 0);
        queueMicrotask(refreshNotice);
      }
    } catch (error) {
      console.debug('Payslip notice response check skipped:', error);
    }

    return response;
  };

  document.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;

    const text = normalize(button.textContent);
    const isPayslipEntry = text.includes('薪資查詢') || text.includes('查詢薪資');

    if (isPayslipEntry) {
      salaryFlowActive = true;
      salaryHasNoData = false;
      queueMicrotask(refreshNotice);
      return;
    }

    if (text.includes('報班查詢') || text.includes('查詢報班') || text.includes('異常工時查詢') || text.includes('登出')) {
      salaryFlowActive = false;
      salaryHasNoData = false;
      removeAllNotices();
    }
  });

  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      refreshNotice();
    });
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
})();