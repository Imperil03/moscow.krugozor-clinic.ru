(() => {
  'use strict';

  const fileCache = new Map();
  const workAliases = new Map([
    ['medical-review', 'pediatric-launch'],
    ['service-redirects', 'technical-seo'],
    ['glasses-content', 'september-content']
  ]);
  let workById = new Map();
  let openButtons = new Map();
  let dialog;
  let title;
  let body;
  let listeners;
  let callbacks = {};
  let currentId = null;
  let opener = null;
  let savedScroll = { x: 0, y: 0 };
  let focusRevision = 0;

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function clinicURL(value) {
    try {
      const url = new URL(value);
      if (url.protocol === 'https:' && url.hostname === 'moscow.krugozor-clinic.ru' &&
          !url.username && !url.password && !url.port) return url.href;
    } catch (_) {
      // An invalid source link remains plain text.
    }
    return null;
  }

  function evidenceURL(value) {
    if (typeof value !== 'string' || !/^evidence\/[a-zA-Z0-9][a-zA-Z0-9._-]*\.txt$/.test(value)) return null;
    const url = new URL(value, document.baseURI);
    if (url.origin !== location.origin) return null;
    return url.href;
  }

  function linkList(links, className = 'work-links') {
    const list = element('ul', className);
    for (const link of Array.isArray(links) ? links : []) {
      const item = element('li');
      const href = clinicURL(link.url);
      if (href) {
        const anchor = element('a', '', link.label || link.url);
        anchor.href = href;
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
        item.append(anchor);
      } else {
        item.append(element('span', '', link.label || 'Ссылка недоступна'));
      }
      list.append(item);
    }
    return list;
  }

  function comparison(before, after) {
    const grid = element('div', 'comparison-grid');
    for (const [label, text] of [['Было', before], ['Стало', after]]) {
      const side = element('section', 'comparison-side');
      side.append(element('h3', '', label), element('p', '', text || '—'));
      grid.append(side);
    }
    return grid;
  }

  function evidenceTable(evidence) {
    const wrapper = element('div', 'evidence-table-wrap');
    wrapper.tabIndex = 0;
    wrapper.setAttribute('role', 'region');
    wrapper.setAttribute('aria-label', evidence.title || 'Таблица изменений');
    const table = element('table', 'evidence-table');
    const head = element('thead');
    const headingRow = element('tr');
    const columns = Array.isArray(evidence.columns) ? evidence.columns : [];
    for (const column of columns) {
      const cell = element('th', '', column);
      cell.scope = 'col';
      headingRow.append(cell);
    }
    head.append(headingRow);
    const rows = element('tbody');
    for (const row of Array.isArray(evidence.rows) ? evidence.rows : []) {
      const tr = element('tr');
      columns.forEach((column, index) => {
        const cell = element('td', '', row[index] ?? '—');
        cell.dataset.label = String(column);
        tr.append(cell);
      });
      rows.append(tr);
    }
    table.append(head, rows);
    wrapper.append(table);
    return wrapper;
  }

  function filePanel(file, defaultLabel) {
    const panel = element('section', 'comparison-side file-panel');
    const label = file && file.label ? file.label : defaultLabel;
    panel.append(element('h3', '', label));
    const href = evidenceURL(file && file.url);
    const status = element('p', 'file-status');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    const pre = element('pre', 'file-content');
    pre.tabIndex = 0;
    pre.setAttribute('aria-label', `Содержимое файла: ${label}`);
    pre.hidden = true;
    const code = element('code');
    pre.append(code);
    panel.append(status, pre);

    if (!href) {
      status.textContent = 'Файл недоступен: адрес не указан или некорректен.';
      return { panel, load() {} };
    }

    const fileLink = element('a', 'file-link', 'Открыть полный файл');
    fileLink.href = href;
    fileLink.target = '_blank';
    fileLink.rel = 'noopener noreferrer';
    fileLink.setAttribute('aria-label', `Открыть полный файл: ${label}`);
    panel.append(fileLink);

    let loading = false;
    let loaded = false;
    let retry = null;
    async function load() {
      if (loading || loaded) return;
      loading = true;
      if (retry) {
        retry.remove();
        retry = null;
      }
      panel.setAttribute('aria-busy', 'true');
      status.hidden = false;
      status.textContent = 'Загружаем файл…';
      try {
        let text = fileCache.get(href);
        if (text === undefined) {
          const response = await fetch(href, { credentials: 'same-origin' });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          if ((response.headers.get('content-type') || '').includes('text/html')) {
            throw new Error('The server returned a web page instead of the file.');
          }
          text = await response.text();
          fileCache.set(href, text);
        }
        code.textContent = text;
        pre.hidden = false;
        status.textContent = 'Файл загружен полностью.';
        status.hidden = true;
        loaded = true;
      } catch (_) {
        status.textContent = 'Не удалось загрузить файл. Попробуйте ещё раз или откройте его по ссылке.';
        retry = element('button', 'retry-button', 'Повторить загрузку');
        retry.type = 'button';
        retry.setAttribute('aria-label', `Повторить загрузку файла: ${label}`);
        retry.addEventListener('click', load);
        panel.insertBefore(retry, fileLink);
      } finally {
        loading = false;
        panel.removeAttribute('aria-busy');
      }
    }
    return { panel, load };
  }

  function evidenceBlock(evidence) {
    const details = element('details', 'evidence-block');
    const summary = element('summary', '', evidence.title || 'Подробности изменений');
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('class', 'evidence-toggle');
    icon.setAttribute('viewBox', '0 0 20 20');
    icon.setAttribute('aria-hidden', 'true');
    for (const [pathData, className] of [['M4 10h12', 'indicator-horizontal'], ['M10 4v12', 'indicator-vertical']]) {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', pathData);
      path.setAttribute('class', className);
      icon.append(path);
    }
    summary.append(icon);
    details.append(summary);
    const content = element('div', 'evidence-content');
    switch (evidence.type) {
      case 'text-comparison':
        content.append(comparison(evidence.before, evidence.after));
        break;
      case 'table':
        content.append(evidenceTable(evidence));
        break;
      case 'links':
        content.append(linkList(evidence.links));
        break;
      case 'file-comparison': {
        const grid = element('div', 'comparison-grid file-comparison');
        const panels = [filePanel(evidence.before, 'Было'), filePanel(evidence.after, 'Стало')];
        grid.append(...panels.map((file) => file.panel));
        content.append(grid);
        details.addEventListener('toggle', () => {
          if (details.open) panels.forEach((file) => file.load());
        });
        break;
      }
      default:
        content.append(element('p', 'work-note', 'Подробности для этого материала пока недоступны.'));
    }
    details.append(content);
    return details;
  }

  function renderWork(work) {
    title.textContent = work.title || 'Подробности работы';
    body.replaceChildren();
    body.append(element('p', 'work-lead', work.result));
    const facts = Array.isArray(work.facts) ? work.facts.slice(0, 3) : [];
    if (facts.length) {
      const list = element('dl', 'work-facts');
      for (const fact of facts) {
        const item = element('div', 'work-fact');
        item.append(element('dt', '', fact.label), element('dd', '', fact.value));
        list.append(item);
      }
      body.append(list);
    }
    if (work.why) {
      const purpose = element('section', 'work-purpose');
      purpose.append(element('h3', '', 'Для чего это нужно'), element('p', '', work.why));
      body.append(purpose);
    }
    const sections = Array.isArray(work.sections) ? work.sections : [];
    for (const item of sections) {
      const section = element('section', 'work-section');
      if (item.title) section.append(element('h3', '', item.title));
      for (const paragraph of Array.isArray(item.paragraphs) ? item.paragraphs : []) {
        section.append(element('p', '', paragraph));
      }
      if (Array.isArray(item.bullets) && item.bullets.length) {
        const list = element('ul', 'change-list');
        item.bullets.forEach((bullet) => list.append(element('li', '', bullet)));
        section.append(list);
      }
      if (Array.isArray(item.links) && item.links.length) section.append(linkList(item.links));
      body.append(section);
    }
    if (!sections.length && typeof work.before === 'string' && work.before.trim() &&
        typeof work.after === 'string' && work.after.trim()) {
      body.append(comparison(work.before, work.after));
    }
    if (!sections.length && Array.isArray(work.changes) && work.changes.length) {
      const section = element('section', 'work-changes');
      const list = element('ul', 'change-list');
      work.changes.forEach((change) => list.append(element('li', '', change)));
      section.append(element('h3', '', 'Что сделали'), list);
      body.append(section);
    }
    if (work.note) body.append(element('p', 'work-note', work.note));
    const evidence = Array.isArray(work.evidence) ? work.evidence : [];
    if (evidence.length) {
      const section = element('section', 'work-evidence');
      section.append(element('h3', '', 'Примеры изменений'));
      evidence.forEach((item) => section.append(evidenceBlock(item)));
      body.append(section);
    }
    if (Array.isArray(work.links) && work.links.length) {
      const section = element('section', 'work-page-links');
      section.append(element('h3', '', 'Страницы на сайте'), linkList(work.links));
      body.append(section);
    }
    body.scrollTop = 0;
    dialog.scrollTop = 0;
  }

  function canFocus(node) {
    return node instanceof HTMLElement && node !== document.body && node !== document.documentElement &&
      node.isConnected && !node.hasAttribute('disabled') &&
      !node.closest('[hidden], [inert]') && node.getClientRects().length > 0 &&
      getComputedStyle(node).visibility !== 'hidden';
  }

  function finishClose() {
    if (currentId === null || dialog.open) return;
    const closedId = currentId;
    const previousOpener = opener;
    const scroll = savedScroll;
    currentId = null;
    opener = null;
    document.body.classList.remove('drawer-open');
    const revision = ++focusRevision;
    try {
      if (typeof callbacks.onClose === 'function') callbacks.onClose();
    } finally {
      requestAnimationFrame(() => {
        if (revision !== focusRevision || currentId !== null) return;
        const candidates = [previousOpener, openButtons.get(closedId),
          document.querySelector('[role="tab"][aria-selected="true"]')];
        const target = candidates.find(canFocus);
        if (target) target.focus({ preventScroll: true });
        window.scrollTo({ left: scroll.x, top: scroll.y, behavior: 'instant' });
      });
    }
  }

  function close() {
    if (!dialog || currentId === null) return;
    if (dialog.open) dialog.close();
    finishClose();
  }

  function resolveId(id) {
    const requestedId = String(id);
    return workAliases.get(requestedId) || requestedId;
  }

  function openWork(id) {
    const work = workById.get(resolveId(id));
    if (!work || !dialog) return false;
    if (currentId === work.id && dialog.open) return true;
    const firstOpen = !dialog.open;
    if (firstOpen) {
      opener = document.activeElement;
      savedScroll = { x: window.scrollX, y: window.scrollY };
      ++focusRevision;
    }
    renderWork(work);
    currentId = work.id;
    document.body.classList.add('drawer-open');
    if (firstOpen) dialog.showModal();
    // A closed native dialog has no scroll layout; reset after it is visible.
    body.scrollTop = 0;
    dialog.scrollTop = 0;
    title.focus({ preventScroll: true });
    if (typeof callbacks.onOpen === 'function') callbacks.onOpen(work.id);
    return true;
  }

  function renderList(container, works) {
    const table = element('table', 'works-table');
    table.setAttribute('aria-label', 'Выполненные работы за сентябрь');
    const head = element('thead');
    const headingRow = element('tr');
    for (const label of ['Что сделали', 'Краткое описание', 'Для чего это нужно', 'Подробнее']) {
      const cell = element('th', '', label);
      cell.scope = 'col';
      headingRow.append(cell);
    }
    head.append(headingRow);
    const rows = element('tbody');
    for (const work of works) {
      const row = element('tr', 'work-row');
      const description = element('td', 'work-description');
      description.dataset.label = 'Что сделали';
      description.append(element('h3', 'work-name', work.title));
      const overview = element('td', 'work-overview');
      overview.dataset.label = 'Краткое описание';
      overview.append(element('p', 'work-summary', work.summary));
      const result = element('td', 'work-result', work.why);
      result.dataset.label = 'Для чего это нужно';
      const action = element('td', 'work-action');
      action.dataset.label = 'Подробнее';
      const button = element('button', 'work-open', 'Подробнее');
      button.type = 'button';
      button.dataset.workId = work.id;
      button.setAttribute('aria-label', `Подробнее: ${work.title}`);
      button.setAttribute('aria-haspopup', 'dialog');
      button.setAttribute('aria-controls', 'work-dialog');
      button.addEventListener('click', () => openWork(work.id), { signal: listeners.signal });
      openButtons.set(work.id, button);
      action.append(button);
      row.append(description, overview, result, action);
      rows.append(row);
    }
    table.append(head, rows);
    container.replaceChildren(table);
  }

  function init(works, options = {}) {
    const container = document.getElementById('works-list');
    const nextDialog = document.getElementById('work-dialog');
    const nextTitle = document.getElementById('work-title');
    const nextBody = document.getElementById('work-body');
    const closeButton = document.getElementById('work-close');
    if (!container || !nextDialog || !nextTitle || !nextBody || !closeButton) {
      throw new Error('ReportWorks: required list or dialog markup is missing.');
    }
    if (dialog && dialog.open) close();
    if (listeners) listeners.abort();
    listeners = new AbortController();
    callbacks = options;
    dialog = nextDialog;
    title = nextTitle;
    body = nextBody;
    title.tabIndex = -1;
    workById = new Map();
    openButtons = new Map();
    for (const work of Array.isArray(works) ? works : []) {
      if (work && typeof work.id === 'string' && work.id) workById.set(work.id, work);
    }
    renderList(container, [...workById.values()]);
    const eventOptions = { signal: listeners.signal };
    closeButton.addEventListener('click', close, eventOptions);
    dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      close();
    }, eventOptions);
    dialog.addEventListener('close', finishClose, eventOptions);
    dialog.addEventListener('click', (event) => {
      if (event.target !== dialog) return;
      const shell = dialog.querySelector('.drawer-shell') || dialog;
      const rect = shell.getBoundingClientRect();
      const outside = event.clientX < rect.left || event.clientX > rect.right ||
        event.clientY < rect.top || event.clientY > rect.bottom;
      if (outside) close();
    }, eventOptions);
    return window.ReportWorks;
  }

  window.ReportWorks = { init, openWork, close, resolveId };
})();
