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
  const snapshotDate = (snapshot, engine) => snapshot?.engines?.[engine]?.checkedAt || snapshot?.date;
  const icon = (name, cls = '') => `<svg class="${cls}" width="20" height="20" aria-hidden="true" viewBox="0 0 24 24">${{
    arrow:'<path d="M5 12h14m-5-5 5 5-5 5"/>', chevron:'<path d="m9 5 7 7-7 7"/>',
    external:'<path d="M7 17 17 7M7 7h10v10"/>', work:'<rect x="5" y="5" width="14" height="16" rx="2"/><path d="M9 5V3h6v2m-6 6h6m-6 5h6"/>',
    chart:'<path d="M4 3v17h17M9 15v-4m5 4V6m5 9V9"/>', up:'<path d="M12 20V4m-6 6 6-6 6 6"/>', down:'<path d="M12 4v16m-6-6 6 6 6-6"/>'
  }[name] || ''}</svg>`;
  const tabs = ['results','works'], months = M.months(data), dialog = $('detail-dialog');
  const hasWorkDetails = month => month >= '2026-10';
  function defaultTab(month) {
    const selected = M.getReport(data, month);
    return selected?.works.length && !selected.rankings && !selected.archive ? 'works' : 'results';
  }
  function filtersForMonth(month) {
    return {search:'', direction:'', trend:'all', cohort:M.getReport(data,month)?.rankings?.defaultCohort || 'all'};
  }
  const state = {month:M.defaultMonth(data),tab:'results',detail:null,filters:filtersForMonth(M.defaultMonth(data)),limit:25,engine:'yandex'};
  let view = null, report = null, positionColumns = null, renderedMonth = null, currentDetail = null, lastOpener = null;
  const linkHTML = item => M.safeHref(item.url) ? `<a href="${esc(M.safeHref(item.url))}" target="_blank" rel="noopener noreferrer">${esc(item.label || item.url)}${icon('external')}</a>` : esc(item.label || 'Ссылка недоступна');
  const imageViewer = document.createElement('dialog');
  imageViewer.id = 'evidence-image-dialog';
  imageViewer.className = 'moscow-image-viewer';
  imageViewer.setAttribute('aria-labelledby','evidence-image-title');
  imageViewer.innerHTML = '<header class="moscow-image-viewer__toolbar"><h2 id="evidence-image-title" class="sr-only">Просмотр изображения</h2><button id="evidence-image-close" class="moscow-image-viewer__close" type="button" aria-label="Закрыть изображение"><svg width="20" height="20" aria-hidden="true" viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"/></svg><span>Закрыть</span></button></header><div class="moscow-image-viewer__body" tabindex="0"><img id="evidence-image-full" alt="" decoding="async"></div>';
  dialog.append(imageViewer);
  const imageFull = $('evidence-image-full'), imageClose = $('evidence-image-close');
  let imageOpener = null, detailScrollBeforeImage = 0;
  function closeImageViewer(restoreFocus = true) {
    const opener = imageOpener;
    imageOpener = null;
    if (imageViewer.open) imageViewer.close();
    imageFull.removeAttribute('src'); imageFull.alt = '';
    if (restoreFocus && dialog.open && opener?.isConnected && $('detail-body').contains(opener)) {
      $('detail-body').scrollTop = detailScrollBeforeImage;
      opener.focus({preventScroll:true});
    }
  }
  function openImageViewer(link) {
    const source = M.safeImageHref(link.getAttribute('href'));
    if (!source || !dialog.open) return false;
    imageOpener = link;
    detailScrollBeforeImage = $('detail-body').scrollTop;
    imageFull.alt = link.querySelector('img')?.alt || '';
    imageFull.src = source;
    imageViewer.showModal();
    imageViewer.querySelector('.moscow-image-viewer__body').scrollTop = 0;
    imageClose.focus({preventScroll:true});
    return true;
  }
  function readRoute() {
    const url = new URL(location.href), requestedMonth = url.searchParams.get('month'), tab = url.hash.slice(1);
    const month = months.includes(requestedMonth) ? requestedMonth : M.defaultMonth(data);
    const legacyWork = tab.startsWith('work/') ? decodeURIComponent(tab.slice(5)) : null;
    return {month, tab:legacyWork ? 'works' : tabs.includes(tab) ? tab : defaultTab(month), detail:url.searchParams.get('work') || legacyWork};
  }
  function routeURL() {
    const url = new URL(location.href);
    url.searchParams.set('month',state.month); url.searchParams.delete('task');
    if (state.detail) url.searchParams.set('work',state.detail); else url.searchParams.delete('work');
    url.hash = state.tab; return url;
  }
  function navigate(changes, {replace = false, focusTab = false} = {}) {
    closeImageViewer(false);
    if (changes.month && changes.month !== state.month) { state.filters = filtersForMonth(changes.month); state.limit = 25; }
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
  function rankSummaryHTML() {
    return report.resultLayout === 'monthly' ? visibilityHTML() : engineKpisHTML() + rankCharts();
  }
  function visibilityHTML() {
    const stats = view.stats;
    const total = stats.yandex.total;
    const population = report.rankings.defaultCohort && total !== view.rows.length ? number(total) + ' из ' + number(view.rows.length) : number(total);
    const engines = M.ENGINES.map(engine => {
      const name = engine === 'yandex' ? 'Яндекс' : 'Google';
      const metrics = [10,3].map(top => {
        const {before,after} = stats[engine]['top'+top];
        const change = before === null ? null : after - before;
        const sign = change > 0 ? '+' : change < 0 ? '−' : '';
        const mood = change > 0 ? 'positive' : change < 0 ? 'negative' : 'neutral';
        const share = total ? `<span class="visibility-share">${number(after / total * 100)}%</span>` : '';
        return `<tr><th scope="row">Топ-${top}</th><td class="visibility-before">${before === null ? '—' : number(before)}</td><td class="visibility-current"><strong>${total ? number(after) : '—'}</strong>${share}</td><td class="visibility-change ${mood}">${change === null ? '—' : sign + number(Math.abs(change))}</td></tr>`;
      }).join('');
      return `<section class="visibility-engine visibility-${engine}" aria-labelledby="visibility-${engine}"><h4 id="visibility-${engine}">${name}</h4><table class="visibility-metrics"><thead><tr><th scope="col"><span class="sr-only">Позиции</span></th><th scope="col">Было</th><th scope="col">Стало</th><th scope="col">Разница</th></tr></thead><tbody>${metrics}</tbody></table></section>`;
    }).join('');
    return `<section class="visibility-summary surface" aria-labelledby="visibility-heading"><div class="visibility-heading"><h3 id="visibility-heading">Запросы в топе</h3><p>${stats.yandex.comparable ? 'Запросов в сравнении' : 'Запросов в выборке'} — ${population}</p></div><div class="visibility-engines">${engines}</div></section>`;
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
      return `<section class="ranking-chart surface" aria-label="${name}: ${archive ? 'доли запросов по архивной сводке' : 'количество запросов'}"><h3>${name}</h3>${archive ? '<p class="archive-chart-note">Доли запросов по сводке архивного отчёта</p>' : ''}<div class="rank-bars">${bars}</div><div class="chart-legend">${comparable ? `<span><i class="before-key"></i>Было${archive ? '' : ' · ' + dateLabel(snapshotDate(view.before,engine))}</span>` : ''}<span><i></i>${comparable ? 'Стало' : 'Сейчас'}${archive ? '' : ' · ' + dateLabel(snapshotDate(view.after,engine))}</span></div></section>`;
    }).join('')}</div>`;
  }
  function periodLabel(period) {
    const format = day => new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long',timeZone:'UTC'}).format(new Date(day + 'T12:00:00Z'));
    if (period.from === period.to) return format(period.to);
    if (period.from.slice(0,7) === period.to.slice(0,7)) return `${Number(period.from.slice(-2))}–${format(period.to)}`;
    return `${format(period.from)} — ${format(period.to)}`;
  }
  function weekHasForecast(week, traffic) {
    return !!traffic.forecastPeriod && week.to >= traffic.forecastPeriod.from;
  }
  function weekLabel(week,traffic) {
    const start = dateLabel(week.from).slice(0,5);
    const range = week.from === week.to ? start : `${start}–${dateLabel(week.to).slice(0,5)}`;
    const breakdown = weekHasForecast(week,traffic) ? week.actual ? ` · факт ${number(week.actual)}, прогноз ${number(week.forecast)}` : ' · прогноз' : '';
    const visits = new Intl.PluralRules('ru').select(week.visits);
    return `${range} · ${number(week.visits)} ${{one:'визит',few:'визита'}[visits] || 'визитов'}${breakdown}`;
  }
  function weeklyTrafficChart(traffic,variant,width,height) {
    const weeks = traffic.weekly, last = weeks.length - 1;
    const left = 38, right = width - 15, top = 25, bottom = height - 32;
    const largest = Math.max(5, ...weeks.map(week => week.visits));
    const unit = 10 ** Math.floor(Math.log10(largest / 5));
    const step = [1,2,2.5,5,10].map(value=>value*unit).find(value=>value>=largest/5);
    const intervals = Math.ceil(largest / step);
    const x = i => Number((left + (right-left) * i / Math.max(1,last)).toFixed(1));
    const y = value => Number((bottom - (bottom-top)*value/(step*intervals)).toFixed(1));
    const series = weeks.map((week,i)=>({week,i}));
    const actual = series.filter(({week})=>!weekHasForecast(week,traffic));
    const predicted = series.filter(({week})=>weekHasForecast(week,traffic));
    const point = ({week,i}) => `${x(i)},${y(week.visits)}`;
    const observed = actual.map(point);
    const grid = Array.from({length:intervals+1},(_,i) => `<line class="weekly-gridline" x1="${left}" x2="${right}" y1="${y(step*i)}" y2="${y(step*i)}"/><text x="${left-7}" y="${y(step*i)+4}" text-anchor="end">${number(step*i)}</text>`).join('');
    const area = actual.length ? `<polygon class="weekly-area" points="${x(actual[0].i)},${bottom} ${observed.join(' ')} ${x(actual.at(-1).i)},${bottom}"/><polyline class="weekly-line" points="${observed.join(' ')}"/>` : '';
    const projected = predicted.length ? `<polyline class="weekly-line weekly-line-forecast" points="${[...actual.slice(-1),...predicted].map(point).join(' ')}"/>` : '';
    const dots = weeks.map((week,i) => `<g class="weekly-mark${weekHasForecast(week,traffic) ? ' is-forecast' : ''}${i === last ? ' is-current' : ''}" tabindex="${i === last ? 0 : -1}" data-visit-week="${i}" aria-label="${esc(weekLabel(week,traffic))}"><circle class="weekly-hit" cx="${x(i)}" cy="${y(week.visits)}" r="11"/><circle class="weekly-dot" cx="${x(i)}" cy="${y(week.visits)}" r="3.5"/></g>`).join('');
    const stride = Math.max(1,Math.ceil(last/(variant === 'mobile' ? 4 : 6)));
    const labels = weeks.map((week,i) => i === last || i % stride === 0 && last-i >= stride/2 ? `<text x="${x(i)}" y="${height-10}" text-anchor="${i === 0 ? 'start' : i === last ? 'end' : 'middle'}">${dateLabel(i === last ? week.to : week.from).slice(0,5)}</text>` : '').join('');
    return `<svg class="weekly-chart weekly-chart-${variant}" viewBox="0 0 ${width} ${height}" role="group" aria-label="Визиты из поиска по неделям">${grid}${area}${projected}${labels}${dots}</svg>`;
  }
  function trafficHTML(traffic) {
    if (!traffic?.weekly?.length) return '';
    const {visits,previousVisits,forecastPeriod,period,comparisonPeriod,weekly} = traffic;
    const change = previousVisits ? Math.round((visits-previousVisits)/previousVisits*1000)/10 : null;
    const delta = Number.isFinite(change) && change !== 0 ? `<span class="visits-change ${change > 0 ? 'positive' : 'negative'}">${change > 0 ? '+' : '−'}${number(Math.abs(change))}%</span>` : '';
    const previous = comparisonPeriod ? `<span class="visits-before">${number(previousVisits)}</span>${icon('arrow','visits-arrow')}` : '';
    const lastWeek = weekly.at(-1);
    const estimate = forecastPeriod ? `<div class="visits-estimate"><p>${periodLabel(lastWeek)} · прогноз</p><strong>${number(lastWeek.visits)}</strong><span>визитов</span></div>` : '';
    const range = periodLabel({from:weekly[0].from,to:lastWeek.to});
    const forecastKey = forecastPeriod ? `<span><i class="forecast-key"></i>Прогноз на ${periodLabel(forecastPeriod)}</span>` : '';
    return `<section class="surface search-visits" aria-labelledby="search-visits-heading"><div class="visits-heading"><div><h3 id="search-visits-heading">Поисковый трафик</h3><p class="visits-period">${comparisonPeriod ? `${periodLabel(comparisonPeriod)} и ` : ''}${periodLabel(period)}</p><div class="visits-metric">${previous}<strong>${number(visits)}</strong>${delta}</div></div>${estimate}</div><figure class="weekly-figure"><div class="weekly-figure-heading"><figcaption>Визиты из поиска по неделям <span class="weekly-period">${range}</span></figcaption><div class="weekly-legend"><span><i></i>Факт</span>${forecastKey}</div></div>${weeklyTrafficChart(traffic,'desktop',1000,236)}${weeklyTrafficChart(traffic,'mobile',320,196)}<p id="visits-readout" class="weekly-readout" aria-live="polite">${weekLabel(lastWeek,traffic)}</p></figure></section>`;
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
    if (share.percent === null && share.measured > 0) return 'Нет замера для части выбранных запросов';
    return share.percent === null ? 'Нет замеров для расчёта' : `${number(share.count)} из ${number(share.total)} запросов в топ-10`;
  }
  function filteredShare(rows,engine,role,archive) {
    const share=M.topShare(rows,engine,role,{archive});
    if(report.rankings?.defaultCohort && share.measured!==share.total) return {...share,percent:null};
    return share;
  }
  function queryPopulation() {
    if (report.rankings?.defaultCohort) return view.rows;
    return report.archive ? report.archive.rows : state.filters.cohort === 'new' ? view.newRows : view.comparisonRows;
  }
  function queryTableHTML() {
    if (!report.archive && !view) return '';
    const archive = report.archive, rows = queryPopulation();
    const directions = [...new Set((archive ? rows : view.rows).map(r => r.direction).filter(Boolean))].sort((a,b) => a.localeCompare(b,'ru'));
    positionColumns = Object.fromEntries(M.ENGINES.map(engine => [engine, archive ? archive.dates[engine].map((d,i,dates) => ({...d,key:i,role:i === dates.length - 1 ? 'after' : i === 0 ? 'start' : 'before'})) :
      ['start','before','after'].filter(role => view[role] && (role !== 'start' || snapshotDate(view.start,engine) !== snapshotDate(view.after,engine))).map(role => ({key:role,role,date:snapshotDate(view[role],engine)}))]));
    const counts = Object.fromEntries(M.ENGINES.map(e => [e,positionColumns[e].length]));
    const selected = M.filterRows(rows,state.filters,report.rankings?.cohorts);
    const heading = engine => positionColumns[engine].map((column,i) => {
      const share = filteredShare(selected,engine,column.key,!!archive);
      const shareId = `rank-share-${engine}-${column.key}`;
      const metric = `<span class="rank-header-share"><span class="rank-header-range" aria-hidden="true">1–10</span><span id="${shareId}" class="rank-header-percent" aria-label="${topShareLabel(share)}" title="${topShareLabel(share)}">${topShareText(share)}</span></span>`;
      return `<th id="rank-${engine}-${column.key}" scope="col" class="engine-${engine} period-${column.role} ${i === 0 ? 'engine-start' : ''} ${column.role === 'after' ? 'current' : ''}" aria-label="${dateLabel(column.date)}" aria-describedby="${shareId}"><time datetime="${column.date}" aria-label="${dateLabel(column.date)}"><span class="rank-date-full">${dateLabel(column.date)}</span><span class="rank-date-short" aria-hidden="true">${dateLabel(column.date).slice(0,5)}</span></time>${metric}</th>`;
    }).join('');
    const columns = M.ENGINES.map(engine => positionColumns[engine].map(() => `<col class="rank-col engine-${engine}">`).join('')).join('');
    const cohorts = report.rankings?.cohorts || [];
    const options = report.rankings?.defaultCohort ? cohorts : [
      {id:'all',label:`Все ${rows.length} запросов`},
      ...cohorts.filter(item=>item.id!=='all'),
      ...(!archive && view.newRows.length ? [{id:'new',label:`Новые запросы (${view.newRows.length})`}] : [])
    ];
    const optionHTML = options.map(item =>
      `<option value="${esc(item.id)}"${item.id===state.filters.cohort?' selected':''}>${esc(item.label)}</option>`
    ).join('');
    const cohortFilter = cohorts.length ? `<div class="filter-field cohort"><label for="cohort-filter">Выборка запросов</label><div class="select-wrap"><select id="cohort-filter">${optionHTML}</select>${icon('chevron')}</div></div>` : '';
    const legend = `<div class="rank-legend" aria-label="Обозначения текущих позиций"><span>Текущие позиции:</span><span><i class="rank-key rank-top3" aria-hidden="true"></i>Топ-3</span><span><i class="rank-key rank-top10" aria-hidden="true"></i>4–10</span><span><i class="rank-key rank-top30" aria-hidden="true"></i>11–30</span><span><i class="rank-key rank-other" aria-hidden="true"></i>31 и ниже</span></div>`;
    const download = report.resultLayout === 'monthly' && !report.rankings?.defaultCohort ? '' : '<div class="ranking-downloads"><button id="export-positions" class="button-secondary" type="button">Скачать позиции</button></div>';
    return `<section class="queries-card surface"><div class="section-heading"><h2>Позиции запросов</h2>${download}</div><div class="table-filters"><div class="filter-field search"><label for="query-search">Найти запрос</label><input id="query-search" type="search" placeholder="Например, подбор контактных линз" value="${esc(state.filters.search)}"></div>${cohortFilter}<div class="filter-field direction"><label for="direction-filter">Направление</label><div class="select-wrap"><select id="direction-filter"><option value="">Все направления</option>${directions.map(d => `<option value="${esc(d)}">${esc(d)}</option>`).join('')}</select>${icon('chevron')}</div></div>${!archive && view.before ? `<div class="filter-field trend"><label for="trend-filter">Динамика за месяц</label><div class="select-wrap"><select id="trend-filter">${[['all','Все изменения'],['up','Рост'],['down','Снижение'],['same','Без изменений']].map(([v,label]) => `<option value="${v}">${label}</option>`).join('')}</select>${icon('chevron')}</div></div>` : ''}</div>${legend}<div class="mobile-engine" role="group" aria-label="Поисковик в таблице"><button type="button" data-engine="yandex" aria-pressed="${state.engine === 'yandex'}">Яндекс</button><button type="button" data-engine="google" aria-pressed="${state.engine === 'google'}">Google</button></div><p class="table-scroll-hint">Проведите по таблице влево, чтобы увидеть текущие позиции.</p><div class="table-scroll" id="positions-wrap" data-engine="${state.engine}" role="region" tabindex="0" aria-label="Позиции запросов"><table class="positions-table snapshot-positions" style="--rank-columns:${counts.yandex + counts.google};--yandex-columns:${counts.yandex};--google-columns:${counts.google}"><caption class="sr-only">Позиции запросов за ${esc(M.monthLabel(state.month).toLowerCase())}</caption><colgroup><col class="query-col">${columns}</colgroup><thead><tr><th id="query-heading" rowspan="2" scope="col" class="query-heading">Запрос</th><th id="engine-yandex" colspan="${counts.yandex}" scope="colgroup" class="engine-yandex engine-title engine-start">Яндекс</th><th id="engine-google" colspan="${counts.google}" scope="colgroup" class="engine-google engine-title engine-start">Google</th></tr><tr>${M.ENGINES.map(heading).join('')}</tr></thead><tbody id="query-rows"></tbody></table></div><p id="query-empty" class="query-empty" hidden>Запросы не найдены. Измените поиск или фильтры.</p><div class="table-footer"><span id="query-count" role="status" aria-live="polite"></span><button type="button" class="button-secondary" id="show-more">Показать ещё 25</button></div></section>`;
  }
  function renderQueries() {
    if (!$('query-rows')) return;
    const archive = report.archive, allRows = queryPopulation();
    const filtered = M.filterRows(allRows,state.filters,report.rankings?.cohorts), visible = filtered.slice(0,state.limit);
    if (!archive) {
      const comparable = report.rankings.defaultCohort
        ? filtered.every(row=>M.ENGINES.every(engine=>['before','after'].every(role=>['found','not_found'].includes(row[engine].observations[role].status))))
        : state.filters.cohort !== 'new';
      view.stats = M.statsForRows(filtered,{comparable});
      $('ranking-summary').innerHTML = rankSummaryHTML();
    }
    for (const engine of M.ENGINES) for (const column of positionColumns[engine]) {
      const element = $(`rank-share-${engine}-${column.key}`);
      if (!element) continue;
      const share = filteredShare(filtered,engine,column.key,!!archive);
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
    const heading = `<div class="results-heading"><h2>Результаты за ${M.monthLabel(state.month).toLowerCase()}</h2>${intro}</div>`;
    const content = report.archive || view ? `<div id="ranking-summary">${rankSummaryHTML()}</div>` + queryTableHTML() : pendingHTML('results');
    return report.resultLayout === 'monthly' ? `<div class="monthly-results">${heading}${trafficHTML(report.traffic)}${content}</div>` : heading + content;
  }
  function worksHTML() {
    if (!report.works.length) return pendingHTML('works');
    const details = hasWorkDetails(state.month);
    if (state.month === '2026-11') {
      const groups = [
        {id:'analysis', title:'Аналитика и подготовка'},
        {id:'content', title:'Новые услуги и статьи'},
        {id:'site', title:'Улучшения сайта'}
      ];
      const groupHTML = group => {
        const items = report.works.filter(work => work.group === group.id);
        if (!items.length) return '';
        const rows = items.map(work => `<tr><td><h4 class="work-name">${esc(work.title)}</h4></td><td class="work-summary">${esc(work.summary)}</td><td class="work-action"><button type="button" class="work-open" data-work="${esc(work.id)}" aria-label="Подробнее: ${esc(work.title)}">Подробнее${icon('arrow')}</button></td></tr>`).join('');
        return `<section class="works-group" aria-label="${esc(group.title)}"><h3 class="works-group-title">${esc(group.title)}</h3><div class="surface"><table class="works-table works-table-compact"><thead><tr><th scope="col">Работа</th><th scope="col">Что сделали</th><th scope="col">Подробнее</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
      };
      return `<div class="works-heading"><h2>Работы за ${M.monthLabel(state.month).toLowerCase()}</h2></div>${groups.map(groupHTML).join('')}`;
    }
    return `<div class="works-heading"><h2>Работы за ${M.monthLabel(state.month).toLowerCase()}</h2></div><section class="surface"><table class="works-table${details ? '' : ' without-details'}"><thead><tr><th scope="col">Что сделали</th><th scope="col">Краткое описание</th><th scope="col">Для чего это нужно</th>${details ? '<th scope="col">Подробнее</th>' : ''}</tr></thead><tbody>${report.works.map(work => `<tr><td><h3 class="work-name">${esc(work.title)}</h3></td><td class="work-summary">${esc(work.summary)}</td><td data-label="Для чего это нужно">${work.why ? paragraphsHTML(work.why) : '—'}</td>${details ? `<td><button type="button" class="work-open" data-work="${esc(work.id)}" aria-label="Подробнее: ${esc(work.title)}">Подробнее${icon('arrow')}</button></td>` : ''}</tr>`).join('')}</tbody></table></section>`;
  }
  function tableHTML(item, emphasize = false) {
    const isUrlMap = item.rows.length > 0 && item.rows.every(row => row.length === 3 && [row[1],row[2]].every(value => typeof value === 'string' && value.startsWith('/')));
    const content = emphasize ? strongHTML : esc;
    return `<div class="table-scroll" role="region" aria-label="${esc(item.label)}"${isUrlMap ? '' : ' tabindex="0"'}><table class="evidence-table${isUrlMap ? ' evidence-url-map' : ''}" role="table"><thead role="rowgroup"><tr role="row">${item.columns.map(c => `<th scope="col" role="columnheader">${content(c)}</th>`).join('')}</tr></thead><tbody role="rowgroup">${item.rows.map(row => `<tr role="row">${item.columns.map((column,i) => `<td data-label="${esc(column)}" role="cell">${isUrlMap && i > 0 ? content(row[i]).replaceAll('/','/<wbr>').replaceAll('-','-<wbr>') : content(row[i])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }
  function evidenceHTML(item) {
    if (item.type === 'image' && M.safeImageHref(item.url)) return `<figure class="evidence-block comparison-screenshot"><a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer"><img src="${esc(item.url)}" alt="${esc(item.alt || item.label)}" loading="eager" decoding="async"></a>${item.caption ? `<figcaption>${esc(item.caption)}</figcaption>` : ''}</figure>`;
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
    if (!work || key !== currentDetail) closeImageViewer(false);
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
  $('report-month').addEventListener('change',event => {
    const month = event.target.value;
    navigate({month,tab:defaultTab(month) === 'works' ? 'works' : state.tab,detail:null});
    $('announcement').textContent = `Выбран ${M.monthLabel(state.month)}.`;
  });
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
  $('detail-body').addEventListener('click',event => {
    if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest('a[href]');
    if (!link || !$('detail-body').contains(link) || !M.safeImageHref(link.getAttribute('href'))) return;
    if (openImageViewer(link)) event.preventDefault();
  });
  imageClose.addEventListener('click',() => closeImageViewer());
  imageViewer.addEventListener('cancel',event => { event.preventDefault(); event.stopPropagation(); closeImageViewer(); });
  imageViewer.addEventListener('close',() => { if (!imageViewer.open) closeImageViewer(); });
  imageViewer.addEventListener('click',event => {
    if (event.target !== imageViewer) return;
    const rect = imageViewer.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeImageViewer();
  });
  document.addEventListener('keydown',event => {
    if (event.key !== 'Escape' || !imageViewer.open) return;
    event.preventDefault(); event.stopImmediatePropagation(); closeImageViewer();
  },true);
  dialog.addEventListener('cancel',event => {
    if (event.target !== dialog) return;
    event.preventDefault();
    if (imageViewer.open) { closeImageViewer(); return; }
    navigate({detail:null});
  });
  dialog.addEventListener('click',event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) navigate({detail:null}); } });
  function exportPositions() {
    const filtered=M.filterRows(queryPopulation(),state.filters,report.rankings.cohorts);
    const records=report.rankings.defaultCohort ? monthlyPositionRecords(filtered) : octoberPositionRecords(filtered);
    const csv='\ufeff'+records.map(row=>row.map(value=>`"${String(value).replaceAll('"','""')}"`).join(';')).join('\r\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=`moscow-positions-${state.month}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function monthlyPositionRecords(rows) {
    const records=[['ID','Запрос','Направление','Поисковик','Дата','Позиция в таблице','Исходная позиция','Есть замер','Статус','URL','Источник','Глубина проверки','Топвизор за текущую дату','XMLStock за текущую дату','Контроль первой страницы','Код региона XMLStock','Глубина Топвизора','Глубина XMLStock','Регион контрольной выдачи']];
    const saved = item => item?.status==='found' ? item.position : item?.status==='not_found' ? 'Не найден' : item?.status==='error' ? 'Ошибка' : '';
    for (const row of rows) for (const engine of M.ENGINES) for (const role of ['start','before','after']) {
      const item=row[engine].observations[role];
      const measured=item.status==='found' || item.status==='not_found';
      const display=item.status==='error' ? '' : item.value ?? 101;
      records.push([row.id,row.query,row.direction,engine==='yandex'?'Яндекс':'Google',item.checkedAt,display,item.value??'',measured?1:0,item.status,item.url||'',item.source||'',item.depth??'',saved(item.topvisor),saved(item.xmlstock),saved(item.control),item.regionCode||'',item.topvisor?.depth??'',item.xmlstock?.depth??'',item.control?.regionCode||'']);
    }
    return records;
  }
  function octoberPositionRecords(filtered) {
    const ids=new Set(filtered.map(row=>row.id));
    const records=[['Запрос','Направление','Поисковик','Дата','Позиция','Есть замер','Статус','URL','Источник']];
    for(const row of window.REPORT_OCTOBER_RANKINGS.rows.filter(r=>ids.has(r.id))) for(const engine of M.ENGINES) {
      const raw=engine==='yandex'?row:row.google;
      ['start','before','after'].forEach((role,i)=>records.push([row.query,row.group,engine,snapshotDate(view[role],engine),raw.positions[i]??'',raw.available[i]?'1':'0',i===2?raw.status:!raw.available[i]?'missing':raw.positions[i]==null?'not_found':'found',raw.urls[i]||'',i===2?'XMLStock':'Topvisor']));
    }
    return records;
  }
  document.addEventListener('click',event=>{if(event.target.closest('#export-positions'))exportPositions();});
  function showVisitWeek(event) {
    const point = event.target.closest?.('[data-visit-week]');
    if (!point) return;
    const readout = $('visits-readout');
    const label = point.getAttribute('aria-label');
    if (readout.textContent !== label) readout.textContent = label;
    for (const mark of point.closest('.weekly-figure').querySelectorAll('[data-visit-week]')) {
      const current = mark.dataset.visitWeek === point.dataset.visitWeek;
      mark.classList.toggle('is-current',current);
      mark.setAttribute('tabindex',current?'0':'-1');
    }
  }
  for (const type of ['pointerover','click','focusin']) document.addEventListener(type,showVisitWeek);
  document.addEventListener('keydown',event=>{
    const point = event.target.closest?.('[data-visit-week]');
    if (!point || !['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    event.preventDefault();
    const points = [...point.parentElement.querySelectorAll('[data-visit-week]')];
    const index = points.indexOf(point), last = points.length-1;
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? last : Math.max(0,Math.min(last,index+(event.key==='ArrowRight'?1:-1)));
    points[next].focus();
  });
  function restoreRoute() {
    if(new URLSearchParams(location.search).get('month')==='2026-09') { location.reload(); return; }
    navigate(readRoute(),{replace:true});
  }
  window.addEventListener('popstate',restoreRoute); window.addEventListener('hashchange',restoreRoute);
  navigate(readRoute(),{replace:true});
})();
