(() => {
  'use strict';
  const M = window.ReportModel, data = window.REPORT_DATA;
  const $ = id => document.getElementById(id);
  if (!M || !data) { $('panel-results').textContent = 'Не удалось загрузить отчёт. Обновите страницу.'; return; }
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const paragraphsHTML = value => String(value ?? '').split(/\r?\n\s*\r?\n/).filter(p => p.trim()).map(p => `<p>${esc(p)}</p>`).join('');
  const strongHTML = value => esc(value).replace(/\*\*([^*\r\n]+)\*\*/g, '<strong>$1</strong>');
  const detailParagraphsHTML = value => String(value ?? '').split(/\r?\n\s*\r?\n/).filter(p => p.trim()).map(p => `<p>${strongHTML(p)}</p>`).join('');
  const number = value => new Intl.NumberFormat('ru-RU',{maximumFractionDigits:1}).format(value);
  const dateLabel = value => value ? new Intl.DateTimeFormat('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(value + 'T12:00:00Z')) : '';
  const icon = (name, cls = '') => `<svg class="${cls}" width="20" height="20" aria-hidden="true" viewBox="0 0 24 24">${{
    arrow:'<path d="M5 12h14m-5-5 5 5-5 5"/>', chevron:'<path d="m9 5 7 7-7 7"/>',
    external:'<path d="M7 17 17 7M7 7h10v10"/>', work:'<rect x="5" y="5" width="14" height="16" rx="2"/><path d="M9 5V3h6v2m-6 6h6m-6 5h6"/>',
    chart:'<path d="M4 3v17h17M9 15v-4m5 4V6m5 9V9"/>', up:'<path d="M12 20V4m-6 6 6-6 6 6"/>', down:'<path d="M12 4v16m-6-6 6 6 6-6"/>'
  }[name] || ''}</svg>`;
  const tabs = ['results','works'], months = M.months(data), dialog = $('detail-dialog');
  const hasWorkDetails = month => month >= '2026-10';
  const state = {month:M.defaultMonth(data),tab:'results',detail:null,filters:{search:'',direction:'',trend:'all',cohort:'all'},limit:25,engine:'yandex'};
  let view = null, report = null, positionColumns = null, renderedMonth = null, currentDetail = null, lastOpener = null;
  const linkHTML = item => M.safeHref(item.url) ? `<a href="${esc(M.safeHref(item.url))}" target="_blank" rel="noopener noreferrer">${esc(item.label || item.url)}${icon('external')}</a>` : esc(item.label || 'Ссылка недоступна');
  function readRoute() {
    const url = new URL(location.href), month = url.searchParams.get('month'), tab = url.hash.slice(1);
    const legacyWork = tab.startsWith('work/') ? decodeURIComponent(tab.slice(5)) : null;
    return {month:months.includes(month) ? month : M.defaultMonth(data), tab:legacyWork ? 'works' : tabs.includes(tab) ? tab : 'results', detail:url.searchParams.get('work') || legacyWork};
  }
  function routeURL() {
    const url = new URL(location.href);
    url.searchParams.set('month',state.month); url.searchParams.delete('task');
    if (state.detail) url.searchParams.set('work',state.detail); else url.searchParams.delete('work');
    url.hash = state.tab; return url;
  }
  function navigate(changes, {replace = false, focusTab = false} = {}) {
    if (changes.month && changes.month !== state.month) { state.filters = {search:'',direction:'',trend:'all',cohort:'all'}; state.limit = 25; }
    Object.assign(state, changes);
    if (state.detail && (state.tab !== 'works' || !hasWorkDetails(state.month) || !M.getReport(data,state.month)?.works.some(w => w.id === state.detail))) state.detail = null;
    try { history[replace ? 'replaceState' : 'pushState'](null,'',routeURL()); } catch (_) {}
    render(); if (focusTab) $('tab-' + state.tab).focus({preventScroll:true});
  }
  function pendingHTML(kind) {
    const heading = kind === 'works' ? 'Работы за этот месяц ещё не добавлены' : 'Позиции за этот месяц ещё не добавлены';
    const text = kind === 'works' ? 'Будем добавлять выполненные работы по мере готовности. Итоги месяца появятся после его завершения.' : 'Здесь появятся сохранённые замеры Яндекса и Google с фактическими датами проверки.';
    return `<div class="empty-state surface"><div class="empty-symbol">${icon(kind === 'works' ? 'work' : 'chart')}</div><div><h2>${heading}</h2><p>${text}</p></div></div>`;
  }
  function kpiHTML(engine, top) {
    if (report.archive) {
      const metric = report.archive.kpis[engine]['top' + top];
      const before = metric.before.replace(/^Было:\s*/i,'').trim(), after = metric.after.replace(/^Стало:\s*/i,'').trim();
      return `<div class="engine-kpi-metric"><h4>Топ-${top}</h4><div class="kpi-values"><div><span class="kpi-period">Было</span><span class="number before">${esc(before)}</span></div>${icon('arrow','kpi-arrow')}<div><span class="kpi-period">Стало</span><span class="number neutral">${esc(after)}</span></div></div><p class="kpi-count archive-change">${esc(metric.change)}</p></div>`;
    }
    const stats = view?.stats[engine], metric = stats?.['top' + top];
    if (!stats?.total) return `<div class="engine-kpi-metric"><h4>Топ-${top}</h4><p class="no-metric">Нет данных</p></div>`;
    const after = metric.after / stats.total * 100, before = metric.before === null ? null : metric.before / stats.total * 100;
    const trend = before === null || after === before ? 'neutral' : after > before ? 'positive' : 'negative';
    return `<div class="engine-kpi-metric"><h4>Топ-${top}</h4><div class="kpi-values">${before === null ? '' : `<div><span class="kpi-period">Было</span><span class="number before">${number(metric.before)}</span></div>${icon('arrow','kpi-arrow')}`}<div>${before === null ? '' : '<span class="kpi-period">Стало</span>'}<span class="number ${trend}">${number(metric.after)}</span></div></div><p class="kpi-count">из ${number(stats.total)} запросов · ${number(after)}%</p></div>`;
  }
  function engineKpisHTML() {
    return `<div class="engine-kpi-grid">${M.ENGINES.map(engine => `<section class="engine-kpi-card surface engine-${engine}" aria-labelledby="kpi-heading-${engine}"><h3 class="searcher-name" id="kpi-heading-${engine}">${engine === 'yandex' ? 'Яндекс' : 'Google'}</h3><div class="engine-kpi-metrics">${[10,3].map(top => kpiHTML(engine,top)).join('')}</div></section>`).join('')}</div>`;
  }
  function rankCharts() {
    const archive = report.archive;
    if (!archive && !view) return '';
    const percent = text => Number.parseFloat(text.replace(/^.*?:\s*/,'').replace(',','.'));
    const stats = archive ? Object.fromEntries(M.ENGINES.map(engine => [engine, Object.fromEntries([3,10].map(top => ['top' + top, {
      before:percent(archive.kpis[engine]['top' + top].before), after:percent(archive.kpis[engine]['top' + top].after)
    }]))])) : view.stats;
    const max = Math.max(1, ...Object.values(stats).flatMap(s => [s.top3.before,s.top3.after,s.top10.before,s.top10.after].filter(Number.isFinite)));
    return `<div class="charts-grid">${M.ENGINES.map(engine => {
      const s = stats[engine], comparable = archive || s.comparable;
      if (!archive && !s.total) return '';
      const bars = [3,10].map(top => `<div class="rank-bar-group">${['before','after'].map(side => {
        const value = s['top' + top][side];
        return Number.isFinite(value) ? `<div class="rank-bar ${side}" style="height:${value / max * 104}px"><span>${number(value)}${archive ? '%' : ''}</span></div>` : '';
      }).join('')}<strong>Топ-${top}</strong></div>`).join('');
      const name = engine === 'yandex' ? 'Яндекс' : 'Google';
      return `<section class="ranking-chart surface" aria-label="${name}: ${archive ? 'доли запросов по архивной сводке' : 'количество запросов'}"><h3>${name}</h3>${archive ? '<p class="archive-chart-note">Доли запросов по сводке архивного отчёта</p>' : ''}<div class="rank-bars">${bars}</div><div class="chart-legend">${comparable ? `<span><i class="before-key"></i>Было${archive ? '' : ' · ' + dateLabel(view.before.date)}</span>` : ''}<span><i></i>${comparable ? 'Стало' : 'Сейчас'}${archive ? '' : ' · ' + dateLabel(view.after.date)}</span></div></section>`;
    }).join('')}</div>`;
  }
  function trafficHTML() {
    const weekly=window.REPORT_OCTOBER_CLICKS.weekly;
    const chart=(variant,width,height,left)=>{
      const right=20,top=24,bottom=36,max=Math.ceil(Math.max(...weekly.map(w=>w.clicks))/200)*200;
      const x=i=>left+i*(width-left-right)/(weekly.length-1),y=n=>top+(max-n)*(height-top-bottom)/max;
      const grid=[0,.5,1].map(r=>`<line class="traffic-grid-line" x1="${left}" x2="${width-right}" y1="${y(max*r)}" y2="${y(max*r)}"/><text x="${left-8}" y="${y(max*r)+4}" text-anchor="end">${number(max*r)}</text>`).join('');
      const line=`<polyline class="traffic-line traffic-line-google" points="${weekly.map((w,i)=>`${x(i)},${y(w.clicks)}`).join(' ')}"/>`;
      const points=weekly.map((w,i)=>`<circle class="traffic-point traffic-point-google click-point" cx="${x(i)}" cy="${y(w.clicks)}" r="4" tabindex="0" data-week="${i}" aria-label="${dateLabel(w.date)} — ${dateLabel(w.endDate)}: ${number(w.clicks)} кликов"><title>${dateLabel(w.date)} — ${dateLabel(w.endDate)}: ${number(w.clicks)} кликов</title></circle>`).join('');
      const indexes=variant==='mobile'?[0,2,4,6]:weekly.map((_,i)=>i);
      const labels=indexes.map(i=>`<text x="${x(i)}" y="${height-9}" text-anchor="${i===0?'start':i===weekly.length-1?'end':'middle'}">${dateLabel(weekly[i].date).slice(0,5)}</text>`).join('');
      return `<svg class="traffic-chart traffic-chart-${variant}" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="group" aria-label="Клики из Google по неделям">${grid}${line}${points}${labels}</svg>`;
    };
    return `<section class="traffic-section surface" aria-labelledby="click-chart-title"><div class="section-heading"><h2 id="click-chart-title">Клики из Google</h2></div><div class="clicks-history">${chart('desktop',780,240,48)}${chart('mobile',320,210,42)}<p id="click-tooltip" class="click-tooltip" aria-live="polite">&nbsp;</p></div></section>`;
  }
  function rankCell(value, archive = false, observation = {}) {
    if (observation.status === 'error') return '<span class="rank-missing rank-error" title="Проверка не завершилась. Это не потеря позиции.">Ошибка замера</span>';
    if (archive && (value === undefined || value === null || value === '')) return '<span class="rank-missing">Нет замера</span>';
    if (value === undefined) return '<span class="rank-value rank-missing" data-rank-status="missing" aria-label="Нет замера; условное обозначение 101" title="Нет замера; 101 — условное обозначение">101</span>';
    if (value === null) {
      const label = observation.depth ? `Сайт не найден в первых ${observation.depth} результатах` : 'Сайт не найден в результатах проверки';
      return `<span class="rank-value rank-out" data-rank-status="not_found" aria-label="${label}; условное обозначение 101" title="${label}; 101 — условное обозначение">101</span>`;
    }
    const numeric = Number(value), band = numeric > 0 && numeric <= 3 ? 'top3' : numeric <= 10 && numeric > 0 ? 'top10' : numeric <= 30 && numeric > 0 ? 'top30' : 'other';
    return `<span class="rank-value rank-${band}">${archive ? esc(value) : number(value)}</span>`;
  }
  function deltaHTML(change) {
    const labels = {appeared:'Появился',lost:'За пределами',same:'Без изменений',no_data:'Не сравниваем',new:'Новый запрос'};
    if (['up','down'].includes(change.kind)) return `<span class="delta ${change.kind === 'up' ? 'positive' : 'negative'}" aria-label="${change.kind === 'up' ? 'Рост' : 'Снижение'} на ${change.amount}">${icon(change.kind)}${number(change.amount)}</span>`;
    return `<span class="delta ${change.kind === 'appeared' ? 'positive' : change.kind === 'lost' ? 'negative' : 'neutral'}">${labels[change.kind]}</span>`;
  }
  function topShareText(share) {
    return share.percent === null ? '—' : `${number(share.percent)}%`;
  }
  function topShareLabel(share) {
    return share.percent === null ? 'Нет замеров для расчёта' : `${number(share.count)} из ${number(share.total)} запросов в топ-10`;
  }
  function queryPopulation() {
    return report.archive ? report.archive.rows : state.filters.cohort === 'new' ? view.newRows : view.comparisonRows;
  }
  function queryTableHTML() {
    if (!report.archive && !view) return '';
    const archive = report.archive, rows = queryPopulation();
    const directions = [...new Set((archive ? rows : view.rows).map(r => r.direction).filter(Boolean))].sort((a,b) => a.localeCompare(b,'ru'));
    positionColumns = Object.fromEntries(M.ENGINES.map(engine => [engine, archive ? archive.dates[engine].map((d,i,dates) => ({...d,key:i,role:i === dates.length - 1 ? 'after' : i === 0 ? 'start' : 'before'})) :
      ['start','before','after'].filter(role => view[role] && (role !== 'start' || view.start.date !== view.after.date)).map(role => ({key:role,role,date:view[role].date}))]));
    const counts = Object.fromEntries(M.ENGINES.map(e => [e,positionColumns[e].length]));
    const selected = M.filterRows(rows,state.filters,report.rankings?.cohorts);
    const heading = engine => positionColumns[engine].map((column,i) => {
      const share = M.topShare(selected,engine,column.key,{archive:!!archive});
      const shareId = `rank-share-${engine}-${column.key}`;
      const metric = `<span class="rank-header-share"><span class="rank-header-range" aria-hidden="true">1–10</span><span id="${shareId}" class="rank-header-percent" aria-label="${topShareLabel(share)}" title="${topShareLabel(share)}">${topShareText(share)}</span></span>`;
      return `<th id="rank-${engine}-${column.key}" scope="col" class="engine-${engine} period-${column.role} ${i === 0 ? 'engine-start' : ''} ${column.role === 'after' ? 'current' : ''}" aria-label="${dateLabel(column.date)}" aria-describedby="${shareId}"><time datetime="${column.date}" aria-label="${dateLabel(column.date)}"><span class="rank-date-full">${dateLabel(column.date)}</span><span class="rank-date-short" aria-hidden="true">${dateLabel(column.date).slice(0,5)}</span></time>${metric}</th>`;
    }).join('');
    const columns = M.ENGINES.map(engine => positionColumns[engine].map(() => `<col class="rank-col engine-${engine}">`).join('')).join('');
    const cohorts = report.rankings?.cohorts || [], downloads = report.rankings?.downloads || [];
    const cohortFilter = cohorts.length ? `<div class="filter-field cohort"><label for="cohort-filter">Выборка запросов</label><div class="select-wrap"><select id="cohort-filter"><option value="all">Все ${rows.length} запросов</option>${cohorts.filter(c => c.id !== 'all').map(c => `<option value="${esc(c.id)}">${esc(c.label)}</option>`).join('')}${!archive && view.newRows.length ? `<option value="new">Новые запросы (${view.newRows.length})</option>` : ''}</select>${icon('chevron')}</div></div>` : '';
    const legend = `<div class="rank-legend" aria-label="Обозначения текущих позиций"><span>Текущие позиции:</span><span><i class="rank-key rank-top3" aria-hidden="true"></i>Топ-3</span><span><i class="rank-key rank-top10" aria-hidden="true"></i>4–10</span><span><i class="rank-key rank-top30" aria-hidden="true"></i>11–30</span><span><i class="rank-key rank-other" aria-hidden="true"></i>31 и ниже</span></div>`;
    return `<section class="queries-card surface"><div class="section-heading"><h2>Позиции запросов</h2><div class="ranking-downloads"><button id="export-positions" class="button-secondary" type="button">Скачать позиции</button></div></div><div class="table-filters"><div class="filter-field search"><label for="query-search">Найти запрос</label><input id="query-search" type="search" placeholder="Например, подбор контактных линз" value="${esc(state.filters.search)}"></div>${cohortFilter}<div class="filter-field direction"><label for="direction-filter">Направление</label><div class="select-wrap"><select id="direction-filter"><option value="">Все направления</option>${directions.map(d => `<option value="${esc(d)}">${esc(d)}</option>`).join('')}</select>${icon('chevron')}</div></div>${!archive && view.before ? `<div class="filter-field trend"><label for="trend-filter">Динамика за месяц</label><div class="select-wrap"><select id="trend-filter">${[['all','Все изменения'],['up','Рост'],['down','Снижение'],['same','Без изменений']].map(([v,label]) => `<option value="${v}">${label}</option>`).join('')}</select>${icon('chevron')}</div></div>` : ''}</div>${legend}<div class="mobile-engine" role="group" aria-label="Поисковик в таблице"><button type="button" data-engine="yandex" aria-pressed="${state.engine === 'yandex'}">Яндекс</button><button type="button" data-engine="google" aria-pressed="${state.engine === 'google'}">Google</button></div><p class="table-scroll-hint">Проведите по таблице влево, чтобы увидеть текущие позиции.</p><div class="table-scroll" id="positions-wrap" data-engine="${state.engine}" role="region" tabindex="0" aria-label="Позиции запросов"><table class="positions-table snapshot-positions" style="--rank-columns:${counts.yandex + counts.google};--yandex-columns:${counts.yandex};--google-columns:${counts.google}"><caption class="sr-only">Позиции запросов за ${esc(M.monthLabel(state.month).toLowerCase())}</caption><colgroup><col class="query-col">${columns}</colgroup><thead><tr><th id="query-heading" rowspan="2" scope="col" class="query-heading">Запрос</th><th id="engine-yandex" colspan="${counts.yandex}" scope="colgroup" class="engine-yandex engine-title engine-start">Яндекс</th><th id="engine-google" colspan="${counts.google}" scope="colgroup" class="engine-google engine-title engine-start">Google</th></tr><tr>${M.ENGINES.map(heading).join('')}</tr></thead><tbody id="query-rows"></tbody></table></div><p id="query-empty" class="query-empty" hidden>Запросы не найдены. Измените поиск или фильтры.</p><div class="table-footer"><span id="query-count" role="status" aria-live="polite"></span><button type="button" class="button-secondary" id="show-more">Показать ещё 25</button></div></section>`;
  }
  function renderQueries() {
    if (!$('query-rows')) return;
    const archive = report.archive, allRows = queryPopulation();
    const filtered = M.filterRows(allRows,state.filters,report.rankings?.cohorts), visible = filtered.slice(0,state.limit);
    if (!archive) {
      view.stats = M.statsForRows(filtered,{comparable:state.filters.cohort !== 'new'});
      $('ranking-summary').innerHTML = engineKpisHTML() + rankCharts();
    }
    for (const engine of M.ENGINES) for (const column of positionColumns[engine]) {
      const element = $(`rank-share-${engine}-${column.key}`);
      if (!element) continue;
      const share = M.topShare(filtered,engine,column.key,{archive:!!archive});
      element.textContent = topShareText(share);
      element.title = topShareLabel(share);
      element.setAttribute('aria-label',topShareLabel(share));
    }
    $('query-rows').innerHTML = visible.map((row,rowIndex) => `<tr><th id="query-${rowIndex}" scope="row" class="query-name">${esc(row.query)}</th>${M.ENGINES.map(engine => positionColumns[engine].map((column,i) => {
      const value = row[engine][column.key], change = !archive && column.role === 'after' && row[engine].change;
      const movement = change && ['up','down'].includes(change.kind) ? `<sup class="rank-movement ${change.kind === 'up' ? 'positive' : 'negative'}" aria-label="${change.kind === 'up' ? 'Рост' : 'Снижение'} на ${change.amount}">${change.kind === 'up' ? '↑' : '↓'}${number(change.amount)}</sup>` : '';
      return `<td headers="query-${rowIndex} engine-${engine} rank-${engine}-${column.key}" class="engine-${engine} period-${column.role} ${i === 0 ? 'engine-start' : ''} ${column.role === 'after' ? 'current' : ''}">${rankCell(value,!!archive,row[engine].observations?.[column.role])}${movement}</td>`;
    }).join('')).join('')}</tr>`).join('');
    $('positions-wrap').hidden = filtered.length === 0; $('query-empty').hidden = filtered.length !== 0;
    $('query-count').textContent = `Показано: ${visible.length} из ${filtered.length}${filtered.length === allRows.length ? '' : ` · всего ${allRows.length} запросов`}`; $('show-more').hidden = state.limit >= filtered.length;
  }
  function resultsHTML() {
    view = M.rankingsView(report.rankings);
    const introBody = report.intro.map(report.archive ? paragraphsHTML : detailParagraphsHTML).join('');
    let intro = introBody && !report.archive ? `<div class="results-intro">${introBody}</div>` : introBody;
    if (report.conclusions.length) intro += '<p class="archive-conclusion-title">Выводы</p>' + report.conclusions.map(paragraphsHTML).join('');
    return `<div class="results-heading"><h2>Результаты за ${M.monthLabel(state.month).toLowerCase()}</h2>${intro}</div>${report.archive || view ? `<div id="ranking-summary">${engineKpisHTML() + rankCharts()}</div>` + queryTableHTML() : pendingHTML('results')}`;
  }
  function worksHTML() {
    if (!report.works.length) return pendingHTML('works');
    const details = hasWorkDetails(state.month);
    return `<div class="works-heading"><h2>Работы за ${M.monthLabel(state.month).toLowerCase()}</h2></div><section class="surface"><table class="works-table${details ? '' : ' without-details'}"><thead><tr><th scope="col">Что сделали</th><th scope="col">Краткое описание</th><th scope="col">Для чего это нужно</th>${details ? '<th scope="col">Подробнее</th>' : ''}</tr></thead><tbody>${report.works.map(work => `<tr><td><h3 class="work-name">${esc(work.title)}</h3></td><td class="work-summary">${esc(work.summary)}</td><td data-label="Для чего это нужно">${work.why ? paragraphsHTML(work.why) : '—'}</td>${details ? `<td><button type="button" class="work-open" data-work="${esc(work.id)}" aria-label="Подробнее: ${esc(work.title)}">Подробнее${icon('arrow')}</button></td>` : ''}</tr>`).join('')}</tbody></table></section>`;
  }
  function tableHTML(item, emphasize = false) {
    const isUrlMap = item.rows.length > 0 && item.rows.every(row => row.length === 3 && [row[1],row[2]].every(value => typeof value === 'string' && value.startsWith('/')));
    const content = emphasize ? strongHTML : esc;
    return `<div class="table-scroll" role="region" aria-label="${esc(item.label)}"${isUrlMap ? '' : ' tabindex="0"'}><table class="evidence-table${isUrlMap ? ' evidence-url-map' : ''}" role="table"><thead role="rowgroup"><tr role="row">${item.columns.map(c => `<th scope="col" role="columnheader">${content(c)}</th>`).join('')}</tr></thead><tbody role="rowgroup">${item.rows.map(row => `<tr role="row">${item.columns.map((column,i) => `<td data-label="${esc(column)}" role="cell">${isUrlMap && i > 0 ? content(row[i]).replaceAll('/','/<wbr>').replaceAll('-','-<wbr>') : content(row[i])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }
  function evidenceHTML(item) {
    if (item.type === 'image' && M.safeImageHref(item.url)) return `<figure class="evidence-block comparison-screenshot"><a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer"><img src="${esc(item.url)}" alt="${esc(item.alt || item.label)}" loading="lazy" decoding="async"></a>${item.caption ? `<figcaption>${esc(item.caption)}</figcaption>` : ''}</figure>`;
    if (item.type === 'link') return `<p class="detail-resource">${linkHTML(item)}</p>`;
    let body = '';
    const hasImages = item.type === 'comparison' && M.safeImageHref(item.beforeImage) && M.safeImageHref(item.afterImage);
    if (item.type === 'comparison') {
      const sideHTML = (side,label) => `<div><h4>${label}</h4>${item[side] ? `<p>${esc(item[side])}</p>` : ''}${hasImages ? `<figure class="comparison-screenshot"><a href="${esc(item[side + 'Image'])}" target="_blank" rel="noopener noreferrer" aria-label="${label}: открыть снимок в полном размере"><img src="${esc(item[side + 'Image'])}" alt="${esc(item[side + 'Alt'])}" loading="eager" decoding="async"></a><figcaption>Нажмите на снимок, чтобы открыть его в полном размере.</figcaption></figure>` : ''}</div>`;
      body = `<div class="comparison-grid${hasImages ? ' has-images' : ''}">${sideHTML('before','Было')}${sideHTML('after','Стало')}</div>`;
    }
    if (item.type === 'table') body = tableHTML(item);
    return `<details class="evidence-block"${hasImages || item.type === 'table' ? ' open' : ''}><summary>${esc(item.label)}</summary><div class="evidence-content">${body}${item.links?.length ? `<ul class="detail-links">${item.links.map(l=>`<li>${linkHTML(l)}</li>`).join('')}</ul>` : ''}</div></details>`;
  }
  function sectionHTML(section) {
    return `<section class="detail-section">${section.title?.trim() ? `<h3>${esc(section.title)}</h3>` : ''}${detailParagraphsHTML(section.text)}${section.bullets?.length ? `<ul>${section.bullets.map(b => `<li>${strongHTML(b)}</li>`).join('')}</ul>` : ''}${section.table ? tableHTML({...section.table,label:section.table.label || section.title || 'Таблица'},true) : ''}${detailParagraphsHTML(section.afterText)}${section.links?.length ? `<ul class="detail-links">${section.links.map(l => `<li>${linkHTML(l)}</li>`).join('')}</ul>` : ''}</section>`;
  }
  function renderDetail() {
    const work = state.tab === 'works' && hasWorkDetails(state.month) && report.works.find(w => w.id === state.detail);
    const key = work ? `${state.month}:${work.id}` : null;
    if (!work) {
      if (dialog.open) { dialog.close(); document.body.classList.remove('dialog-open'); (lastOpener?.isConnected ? lastOpener : $('tab-' + state.tab)).focus({preventScroll:true}); }
      currentDetail = null; return;
    }
    if (key === currentDetail && dialog.open) return;
    dialog.dataset.reportView = 'works'; $('detail-title').textContent = work.title; $('detail-meta').hidden = true;
    const sections = (work.sections || []).map(sectionHTML).join('');
    $('detail-body').innerHTML = `<section class="actual-result"><h3>Что сделали</h3>${detailParagraphsHTML(work.result)}${work.resultBullets?.length ? `<ul class="result-bullets">${work.resultBullets.map(b => `<li>${strongHTML(b)}</li>`).join('')}</ul>` : ''}${sections}${(work.evidence || []).map(evidenceHTML).join('')}</section>`;
    if (!dialog.open) { dialog.showModal(); document.body.classList.add('dialog-open'); }
    $('detail-body').scrollTop = 0; $('close-detail').focus({preventScroll:true}); currentDetail = key;
  }
  function render() {
    report = M.getReport(data,state.month); $('report-month').value = state.month;
    if (renderedMonth !== state.month) { $('panel-results').innerHTML = resultsHTML(); $('panel-works').innerHTML = worksHTML(); renderedMonth = state.month; }
    for (const tab of tabs) { $('tab-' + tab).setAttribute('aria-selected',String(state.tab === tab)); $('tab-' + tab).tabIndex = state.tab === tab ? 0 : -1; $('panel-' + tab).hidden = state.tab !== tab; }
    $('work-count').hidden = !report.works.length; $('work-count').textContent = report.works.length;
    document.title = `Отчёт по продвижению сайта «${data.project.name}» — ${M.monthLabel(state.month)}`;
    renderQueries(); renderDetail();
  }
  $('report-client').textContent = `«${data.project.name}»`;
  $('site-link').href = M.safeHref(data.project.website); $('site-link').innerHTML = esc(new URL(data.project.website).hostname) + icon('external');
  $('period-label').textContent = `${M.monthLabel(months[0])} — ${M.monthLabel(months.at(-1)).toLowerCase()}`;
  $('report-month').innerHTML = months.map(month => `<option value="${month}">${M.monthLabel(month)}</option>`).join('');
  $('report-month').addEventListener('change',event => { navigate({month:event.target.value,detail:null}); $('announcement').textContent = `Выбран ${M.monthLabel(state.month)}.`; });
  tabs.forEach((tab,index) => {
    $('tab-' + tab).addEventListener('click',() => navigate({tab,detail:null}));
    $('tab-' + tab).addEventListener('keydown',event => {
      if (event.ctrlKey || event.metaKey || event.altKey || !['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
      event.preventDefault(); const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      navigate({tab:tabs[next],detail:null},{focusTab:true});
    });
  });
  document.addEventListener('click',event => {
    const work = event.target.closest('[data-work]'); if (work) { lastOpener = work; navigate({detail:work.dataset.work}); return; }
    const engine = event.target.closest('button[data-engine]');
    if (engine) { state.engine = engine.dataset.engine; $('positions-wrap').dataset.engine = state.engine; document.querySelectorAll('button[data-engine]').forEach(b => b.setAttribute('aria-pressed',String(b.dataset.engine === state.engine))); return; }
    if (event.target.closest('#show-more')) { state.limit += 25; renderQueries(); }
  });
  document.addEventListener('input',event => { if (event.target.id === 'query-search') { state.filters.search = event.target.value; state.limit = 25; renderQueries(); } });
  document.addEventListener('change',event => {
    if (event.target.id === 'direction-filter') state.filters.direction = event.target.value;
    else if (event.target.id === 'trend-filter') state.filters.trend = event.target.value;
    else if (event.target.id === 'cohort-filter') state.filters.cohort = event.target.value; else return;
    state.limit = 25; renderQueries();
  });
  $('close-detail').addEventListener('click',() => navigate({detail:null}));
  dialog.addEventListener('cancel',event => { event.preventDefault(); navigate({detail:null}); });
  dialog.addEventListener('click',event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) navigate({detail:null}); } });
  function exportPositions() {
    const filtered=M.filterRows(queryPopulation(),state.filters,report.rankings.cohorts),ids=new Set(filtered.map(r=>r.id));
    const records=[['Запрос','Направление','Поисковик','Дата','Позиция','Есть замер','Статус','URL','Источник']];
    for(const row of window.REPORT_OCTOBER_RANKINGS.rows.filter(r=>ids.has(r.id))) for(const engine of ['yandex','google']) {
      const raw=engine==='yandex'?row:row.google;
      window.REPORT_OCTOBER_RANKINGS.dates.forEach((date,i)=>records.push([row.query,row.group,engine,date.date,raw.positions[i]??'',raw.available[i]?'1':'0',i===2?raw.status:!raw.available[i]?'missing':raw.positions[i]==null?'not_found':'found',raw.urls[i]||'',i===2?'XMLStock':'Topvisor']));
    }
    const csv='\ufeff'+records.map(row=>row.map(value=>`"${String(value).replaceAll('"','""')}"`).join(';')).join('\r\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='moscow-positions-2026-10.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  document.addEventListener('click',event=>{if(event.target.closest('#export-positions'))exportPositions();});
  function showClickTooltip(event) {
    const point=event.target.closest?.('.click-point');if(!point)return;
    const week=window.REPORT_OCTOBER_CLICKS.weekly[Number(point.dataset.week)];
    $('click-tooltip').textContent=`${dateLabel(week.date)} — ${dateLabel(week.endDate)} · ${number(week.clicks)} кликов`;
  }
  document.addEventListener('pointerover',showClickTooltip);document.addEventListener('focusin',showClickTooltip);
  document.addEventListener('keydown',event=>{
    const point=event.target.closest?.('.click-point');if(!point||!['ArrowLeft','ArrowRight'].includes(event.key))return;
    event.preventDefault();const points=[...point.parentElement.querySelectorAll('.click-point')],index=points.indexOf(point);points[Math.max(0,Math.min(points.length-1,index+(event.key==='ArrowRight'?1:-1)))].focus();
  });
  function restoreRoute() {
    if(new URLSearchParams(location.search).get('month')==='2026-09') { location.reload(); return; }
    navigate(readRoute(),{replace:true});
  }
  window.addEventListener('popstate',restoreRoute); window.addEventListener('hashchange',restoreRoute);
  navigate(readRoute(),{replace:true});
})();
