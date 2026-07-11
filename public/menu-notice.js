(() => {
  'use strict';

  const NOTICE_ATTRIBUTE = 'data-payslip-anomaly-notice';

  function normalize(value) {
    return (value || '').toString().trim();
  }

  function createNotice() {
    const notice = document.createElement('div');
    notice.setAttribute(NOTICE_ATTRIBUTE, 'true');
    notice.className = 'mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm font-bold leading-relaxed text-amber-800';

    const strong = document.createElement('span');
    strong.textContent = '提醒：';

    const text = document.createTextNode('若沒有薪資單，請至「異常工時查詢」區查看。');
    notice.append(strong, text);
    return notice;
  }

  function findCardByHeading(text) {
    return Array.from(document.querySelectorAll('h2'))
      .find((heading) => normalize(heading.textContent) === text)
      ?.parentElement || null;
  }

  function injectNotice(headingText) {
    const card = findCardByHeading(headingText);
    if (!card || card.querySelector(`[${NOTICE_ATTRIBUTE}]`)) return;

    const actions = card.querySelector('.space-y-4');
    if (!actions) return;

    actions.parentElement?.insertBefore(createNotice(), actions);
  }

  function injectNotices() {
    injectNotice('歡迎回來');
    injectNotice('管理者查詢');
  }

  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      injectNotices();
    });
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', injectNotices);
  injectNotices();
})();
