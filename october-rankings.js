(() => {
  'use strict';
  const host = document.getElementById('october-results');
  if (!host) return;
  const data = window.REPORT_OCTOBER_RANKINGS;
  const $ = suffix => document.getElementById(`oct-${suffix}`);
  const text = value => String(value ?? '');
  const escape = value => text(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const norm = value => text(value).toLocaleLowerCase('ru-RU').replaceAll('ё','е').trim();
  const position = value => Number.isInteger(value) && value > 0 ? value : null;
  const beforePosition = row => {
    const n = position(row.baselinePosition);
    return row.baselineAvailable && n !== null && n <= 10 ? n : null;
  };
  const successful = row => row.status === 'found' && position(row.currentPosition) !== null
    || row.status === 'not_found' && Number.isInteger(row.checkedDepth) && row.checkedDepth >= 10;
  const queryWord = number => number % 10 === 1 && number % 100 !== 11 ? 'запрос'
    : [2,3,4].includes(number % 10) && ![12,13,14].includes(number % 100) ? 'запроса' : 'запросов';
  const formatDate = value => /^\d{4}-\d{2}-\d{2}$/.test(text(value))
    ? new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(`${value}T12:00:00Z`))
    : text(value);
  function safeUrl(value) {
    try {
      const url = new URL(value);
      return ['http:','https:'].includes(url.protocol) && url.hostname === 'moscow.krugozor-clinic.ru' ? url.href : '';
    } catch { return ''; }
  }
  if (!data || data.schemaVersion !== 1 || !Array.isArray(data.rows) || !Array.isArray(data.cohorts)
      || new Set(data.rows.map(row => row.id)).size !== data.rows.length) {
    $('loading').textContent = 'Проверенные данные съёма пока недоступны. Обновите страницу позже.';
    return;
  }
  const rows = data.rows;
  const state = {cohort:'all',group:'',search:'',limit:25};
  const pageSize = 25;
  const cohorts = data.cohorts.filter(item => typeof item.id === 'string' && typeof item.label === 'string');
  if (!cohorts.some(item => item.id === 'all')) {
    $('loading').textContent = 'Не удалось определить полный набор запросов. Данные не отображаются.';
    return;
  }
  $('cohort').innerHTML = cohorts.map(item => `<option value="${escape(item.id)}">${escape(item.label)}</option>`).join('');
  $('cohort').value = 'all';
  $('period').textContent = `${formatDate(data.baselineDate)} → ${formatDate(data.currentDate)}`;
  $('context').textContent = `${data.context?.region || 'Москва'} · ${data.context?.device || 'Смартфон'} · Яндекс`;
  $('method').textContent = 'Топвизор · Яндекс SERP → XMLStock · Яндекс Live. Поставщик данных изменился.';
  $('depth').textContent = 'Сравниваем ТОП-3 и ТОП-10. Прежний срез не охватывал места 11–100; новые запросы без базы в рост не включаются.';
  $('method-full').textContent = `Источники различаются: Топвизор, Яндекс SERP (${formatDate(data.baselineDate)}) → ${data.source || 'XMLStock · Яндекс Live'} (${formatDate(data.currentDate)}). Разницу нельзя приписывать только изменениям сайта.`;
  $('depth-full').textContent = `В прежнем Live-срезе доступны числовые позиции 1–${data.context?.baselineDepth || 10}, текущий съём — до ТОП-${data.context?.depth || 100}. Сравниваем ТОП-3 и ТОП-10 по одинаковым запросам. Места 11–100 показаны как новый подробный срез. Ошибки съёма исключаются из обеих сторон сравнения.`;
  $('baseline-heading').textContent = text(data.baselineDate).slice(5).split('-').reverse().join('.');
  $('current-heading').textContent = text(data.currentDate).slice(5).split('-').reverse().join('.');
  if (Array.isArray(data.notes) && data.notes.length) {
    $('notes').innerHTML = data.notes.map(note => `<li>${escape(note)}</li>`).join('');
    $('notes').hidden = false;
  }
  const hasProviderWarnings = rows.some(row => Array.isArray(row.providerWarnings) && row.providerWarnings.length > 0);
  $('provider-warning').hidden = !hasProviderWarnings;
  $('loading').hidden = true;
  $('content').hidden = false;
  function cohortRows() {
    return rows.filter(row => Array.isArray(row.cohorts) && row.cohorts.includes(state.cohort));
  }
  function filteredRows() {
    const term = norm(state.search);
    return cohortRows().filter(row => (!state.group || text(row.group) === state.group) && (!term || norm(row.query).includes(term)));
  }
  function buildGroups() {
    const names = [...new Set(cohortRows().map(row => text(row.group)))].filter(Boolean).sort((a,b) => a.localeCompare(b,'ru'));
    if (!names.includes(state.group)) state.group = '';
    $('group').innerHTML = '<option value="">Все группы</option>' + names.map(name => `<option value="${escape(name)}">${escape(name)}</option>`).join('');
    $('group').value = state.group;
  }
  function movement(row) {
    if (!successful(row)) return {label:'Ошибка съёма',kind:'none'};
    if (!row.baselineAvailable) return {label:'Первый замер',kind:'none'};
    const b = beforePosition(row), a = position(row.currentPosition);
    if (a !== null && a <= 10 && b !== null) {
      if (a === b) return {label:'Без изменений',kind:'none'};
      return {label:`${a < b ? 'Рост' : 'Снижение'} на ${Math.abs(b-a)}`,kind:a < b ? 'positive' : 'negative'};
    }
    if (a !== null && a <= 10 && b === null) return {label:'Вошёл в ТОП-10',kind:'positive'};
    if (b !== null) return {label:'Вышел из ТОП-10',kind:'negative'};
    return {label:a !== null ? 'Найден ниже ТОП-10' : 'За ТОП-10',kind:'none'};
  }
  function currentLabel(row) {
    if (!successful(row)) return 'Ошибка';
    const p = position(row.currentPosition);
    if (p !== null) return String(p);
    return Number.isInteger(row.checkedDepth) && row.checkedDepth > 0 ? `>${row.checkedDepth}` : 'Не определено';
  }
  function beforeLabel(row) {
    if (!row.baselineAvailable) return 'Нет базы';
    return beforePosition(row) === null ? 'За ТОП-10' : String(beforePosition(row));
  }
  function renderKpis() {
    const selected = filteredRows();
    const baseline = selected.filter(row => row.baselineAvailable);
    const paired = baseline.filter(successful);
    const errors = selected.filter(row => !successful(row));
    const newRows = selected.filter(row => !row.baselineAvailable);
    for (const limit of [3,10]) {
      const before = paired.filter(row => beforePosition(row) !== null && beforePosition(row) <= limit).length;
      const after = paired.filter(row => position(row.currentPosition) !== null && row.currentPosition <= limit).length;
      $(`top${limit}-before`).textContent = paired.length ? before : '—';
      $(`top${limit}-after`).textContent = paired.length ? after : '—';
      $(`top${limit}-base`).textContent = `Из ${paired.length} сопоставленных запросов`;
      const diff = after-before;
      $(`top${limit}-change`).textContent = !paired.length ? 'Нет сопоставимых данных'
        : diff === 0 ? 'Без изменения количества' : `${diff > 0 ? '+' : '−'}${Math.abs(diff)} ${queryWord(Math.abs(diff))}`;
      $(`top${limit}-change`).className = `oct-kpi-change ${diff > 0 ? 'delta-positive' : diff < 0 ? 'delta-negative' : 'delta-none'}`;
    }
    $('paired-value').textContent = `${paired.length} / ${baseline.length}`;
    $('paired-note').textContent = `С прежней базой · ошибок в этой части: ${baseline.filter(row => !successful(row)).length}`;
    $('new-value').textContent = newRows.length;
    $('new-note').textContent = 'Без прежнего замера — в сравнение роста не входят';
    $('cohort-description').textContent = state.cohort === 'october'
      ? 'Запросы девяти страниц, созданных в октябре: 19 прежних запросов и 10 новых. Состав выборки зафиксирован до съёма.'
      : state.cohort === 'september'
        ? 'Фиксированный набор материалов августа–сентября. Это отдельная выборка для продолжения наблюдения, не состав октябрьских работ.'
        : 'Весь текущий проект. Исходные запросы сравниваются с прежним срезом; новые фразы показаны без исходной позиции.';
    $('coverage').textContent = `В выборке ${selected.length} запросов. Успешно снято: ${selected.filter(successful).length}. Ошибки и неполные результаты: ${errors.length}.`;
  }
  function renderRows() {
    const selected = filteredRows(), visible = selected.slice(0,state.limit);
    $('rows').innerHTML = visible.map(row => {
      const change = movement(row), url = safeUrl(row.currentUrl), target = safeUrl(row.target);
      const link = url ? `<a href="${escape(url)}" target="_blank" rel="noopener noreferrer">Страница в выдаче</a>` : '—';
      const warning = Array.isArray(row.providerWarnings) && row.providerWarnings.length
        ? '<sup class="oct-provider-flag" title="В ответе провайдера есть особенности. Пояснение под таблицей." aria-label="Особенности ответа XMLStock; пояснение под таблицей">*</sup>' : '';
      return `<tr><td><span class="query-text">${escape(row.query)}</span><span class="query-cluster">${escape(row.group)}</span></td><td class="rank-before">${escape(beforeLabel(row))}</td><td class="rank-after${position(row.currentPosition) !== null && row.currentPosition <= 10 && successful(row) ? ' rank-top' : ''}">${escape(currentLabel(row))}${warning}</td><td><span class="delta delta-${change.kind}">${escape(change.label)}</span></td><td>${link}${target ? `<a class="oct-target-link" href="${escape(target)}" target="_blank" rel="noopener noreferrer">Целевая страница</a>` : ''}</td></tr>`;
    }).join('');
    $('table-wrap').hidden = selected.length === 0;
    $('empty').hidden = selected.length !== 0;
    $('more').hidden = visible.length >= selected.length;
    $('row-count').textContent = `Показано ${visible.length} из ${selected.length}`;
    $('export').disabled = selected.length === 0;
  }
  function render() { renderKpis(); renderRows(); }
  $('cohort').addEventListener('change',event => { state.cohort = event.target.value;state.limit = pageSize;buildGroups();render(); });
  $('group').addEventListener('change',event => { state.group = event.target.value;state.limit = pageSize;render(); });
  $('search').addEventListener('input',event => { state.search = event.target.value;state.limit = pageSize;render(); });
  $('more').addEventListener('click',() => { state.limit += pageSize;renderRows(); });
  $('export').addEventListener('click',() => {
    const cell = value => '"' + (/^[=+\-@\t\r]/.test(text(value)) ? "'" : '') + text(value).replaceAll('"','""') + '"';
    const cohortLabel = cohorts.find(item => item.id === state.cohort)?.label || state.cohort;
    const statusLabel = row => !successful(row) ? 'Ошибка или неполный съём'
      : row.status === 'found' ? 'Найден' : 'Не найден в проверенной глубине';
    const values = [['Запрос','Группа',`Позиция ${data.baselineDate}`,`Позиция ${data.currentDate}`,'Изменение','Страница в выдаче','Статус',
      'Источник прежнего замера','Источник текущего замера','Регион и устройство','Прежняя глубина','Текущая глубина','Выборка','Сопоставимость','Особенности ответа провайдера'],
      ...filteredRows().map(row => [row.query,row.group,beforeLabel(row),currentLabel(row),movement(row).label,safeUrl(row.currentUrl),statusLabel(row),
        row.baselineAvailable ? 'Topvisor · Яндекс SERP' : 'Нет исходного замера',data.source || 'XMLStock · Яндекс Live',
        `${data.context?.region || 'Москва'} / ${data.context?.device || 'Смартфон'}`,row.baselineAvailable ? data.context?.baselineDepth || 10 : '',
        data.context?.depth || 100,cohortLabel,
        row.baselineAvailable ? 'Смена поставщика данных; сравнение ТОП-3 и ТОП-10. Места ниже десятого не имеют сопоставимой прежней позиции.' : 'Первый замер; динамика не рассчитывается.',
        Array.isArray(row.providerWarnings) && row.providerWarnings.length ? 'Особенности XMLStock: возможны нестандартное число результатов, специальные блоки или повторы между страницами. Порядок провайдера сохранён.' : ''])];
    const blob = new Blob(['\uFEFF'+values.map(row => row.map(cell).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'});
    const url = URL.createObjectURL(blob), anchor = document.createElement('a');
    anchor.href = url;anchor.download = `krugozor-yandex-${data.currentDate}.csv`;anchor.click();setTimeout(() => URL.revokeObjectURL(url),0);
  });
  buildGroups();render();
})();
