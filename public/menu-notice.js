(() => {
  'use strict';

  const NOTICE_ATTRIBUTE = 'data-payslip-anomaly-notice';

  function normalize(value) {
    return (value || '').toString().trim();
  }

  function createNotice() {
    const notice = document.createElement('div');
    notice.setAttribute(NOTICE_ATTRIBUTE, 'true');
    notice.style.marginBottom = '20px';
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
