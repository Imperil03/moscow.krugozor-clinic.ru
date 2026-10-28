(() => {
  'use strict';
  const host = document.getElementById('october-results');
  if (!host) return;
  const data = window.REPORT_OCTOBER_RANKINGS;
  const $ = name => document.getElementById(`oct-${name}`);
  const text = value => String(value ?? '');
  const escape = value => text(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm = value => text(value).toLocaleLowerCase('ru-RU').replaceAll('ё','е').trim();
  const position = value => Number.isInteger(value) && value > 0 ? value : null;
  const successful = row => ['found','not_found'].includes(row.status);
  const dateLabel = date => new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long',timeZone:'UTC'}).format(new Date(`${date}T12:00:00Z`));
  const shortDate = date => text(date).slice(5).split('-').reverse().join('.');
  if (!data || data.schemaVersion !== 2 || !Array.isArray(data.rows) || !Array.isArray(data.dates) || data.dates.length !== 3) {
    $('loading').textContent = 'Проверенные позиции за три даты пока недоступны. Обновите страницу позже.';
    return;
  }
  const rows = data.rows, dates = data.dates;
  const pageSize = window.matchMedia('(max-width:700px)').matches ? 10 : 25;
  const state = {cohort:'all',group:'',search:'',limit:pageSize};
  const cohorts = data.cohorts || [{id:'all',label:'Весь проект'}];
  $('cohort').innerHTML = cohorts.map(c => `<option value="${escape(c.id)}">${escape(c.label)}</option>`).join('');
  $('cohort').value = state.cohort;
  $('loading').hidden = true; $('content').hidden = false;
  function cohortRows() { return rows.filter(r => r.cohorts?.includes(state.cohort)); }
  function filteredRows() { const q = norm(state.search);return cohortRows().filter(r => (!state.group || r.group === state.group) && (!q || norm(r.query).includes(q))); }
  function buildGroups() {
    const names = [...new Set(cohortRows().map(r => r.group))].filter(Boolean).sort((a,b) => a.localeCompare(b,'ru'));
    if (!names.includes(state.group)) state.group = '';
    $('group').innerHTML = '<option value="">Все направления</option>'+names.map(n => `<option value="${escape(n)}">${escape(n)}</option>`).join('');
    $('group').value = state.group;
  }
  function commonRows(selected, from = null) {
    return selected.filter(r => successful(r) && (from === null ? r.available?.every(Boolean) : r.available?.[from] && r.available?.[2]));
  }
  function countTop(selected, index, top) { return selected.filter(r => position(r.positions?.[index]) !== null && r.positions[index] <= top).length; }
  function percentage(count,total) { return total ? new Intl.NumberFormat('ru-RU',{minimumFractionDigits:1,maximumFractionDigits:1}).format(100*count/total)+'%' : '—'; }
  function card(top,from,label,selected) {
    const common = commonRows(selected,from), before = countTop(common,from,top), after = countTop(common,2,top), diff = after-before;
    return `<section class="kpi-card" aria-labelledby="oct-kpi-${top}-${from}"><h2 id="oct-kpi-${top}-${from}">Яндекс · топ-${top} ${label}</h2><div class="kpi-values"><span class="kpi-value-column"><span class="kpi-period">${shortDate(dates[from].date)}</span><span class="kpi-before">${percentage(before,common.length)}</span></span><span class="kpi-arrow" aria-hidden="true">→</span><span class="kpi-value-column"><span class="kpi-period">${shortDate(dates[2].date)}</span><strong class="kpi-after${diff<0?' delta-negative':''}">${percentage(after,common.length)}</strong></span></div><p class="kpi-count" title="По ${common.length} запросам с историей">${common.length ? before+' <span aria-hidden="true">→</span> '+after+' запросов' : 'Нет сопоставимых замеров'}</p></section>`;
  }
  function chart(top, values, roof, common) {
    const legendClasses=['legend-before','legend-middle','legend-after'];
    $(`legend-top${top}`).innerHTML=dates.map((d,i)=>`<span><i class="${legendClasses[i]}"></i>${dateLabel(d.date)}</span>`).join('');
    function svg(mobile) {
      const width=mobile?350:630,left=mobile?29:40,right=width-8,base=208,plotHeight=186;
      const id=`oct-svg-${top}-${mobile?'mobile':'desktop'}`;
      if (!common) return `<svg class="chart-svg-${mobile?'mobile':'desktop'}" viewBox="0 0 ${width} 250" role="img" aria-label="Нет сопоставимых замеров"><text class="chart-label" x="${width/2}" y="125" text-anchor="middle">Нет сопоставимых замеров</text></svg>`;
      let content='';
      for(let i=0;i<=4;i++) { const y=base-plotHeight*i/4;content+=`<line class="chart-grid-line" x1="${left}" x2="${right}" y1="${y}" y2="${y}"/><text class="chart-label" x="${left-10}" y="${y+5}" text-anchor="end">${roof*i/4}</text>`; }
      content+=`<path class="chart-axis" fill="none" d="M${left} 22V${base}H${right}"/>`;
      const available=right-left,slot=available/3,barWidth=mobile?38:77;
      values.forEach((n,i)=> {const x=left+slot*(i+.5)-barWidth/2,h=plotHeight*n/roof,y=base-h;content+=`<rect class="chart-bar-${['before','middle','after'][i]}" x="${x}" y="${y}" width="${barWidth}" height="${h}" rx="2"/><text class="chart-value" x="${x+barWidth/2}" y="${Math.max(15,y-10)}" text-anchor="middle">${n}</text><text class="chart-label chart-category" x="${x+barWidth/2}" y="237" text-anchor="middle">${shortDate(dates[i].date)}</text>`;});
      return `<svg class="chart-svg-${mobile?'mobile':'desktop'}" viewBox="0 0 ${width} 250" role="img" aria-labelledby="${id}-title ${id}-desc"><title id="${id}-title">Яндекс: запросы в топ-${top} за три даты</title><desc id="${id}-desc">${dates.map((d,i)=>dateLabel(d.date)+': '+values[i]).join('. ')}. По ${common} запросам с замерами на всех трёх датах.</desc>${content}</svg>`;
    }
    $(`chart-top${top}`).innerHTML=svg(false)+svg(true);
  }
  function renderOverview() {
    const selected=filteredRows(),common=commonRows(selected),values3=[0,1,2].map(i=>countTop(common,i,3)),values10=[0,1,2].map(i=>countTop(common,i,10));
    $('kpis').innerHTML=card(10,1,'за месяц',selected)+card(3,1,'за месяц',selected)+card(10,0,'с начала',selected)+card(3,0,'с начала',selected);
    const nice=[1,2,3,5,10,15,20,25,50,100,150,200];const max=Math.max(1,...values3,...values10);const step=nice.find(n=>n>=max/4)||Math.ceil(max/4/100)*100;const roof=step*4;
    chart(3,values3,roof,common.length);chart(10,values10,roof,common.length);

  }
  function delta(row) {
    if (!successful(row)) return {label:'Ошибка',kind:'none'};
    if (!row.available?.[1]) return {label:'—',kind:'none'};
    const before=position(row.positions?.[1]),after=position(row.positions?.[2]);
    if (before!==null && after!==null) { const n=before-after;return {label:n?String(Math.abs(n)):'—',kind:n>0?'positive':n<0?'negative':'none',number:n}; }
    if(before===null && after!==null) return {label:after>50?'Найден':'Появился',kind:'new'};
    return {label:before!==null?'Не найден':'—',kind:before!==null?'negative':'none'};
  }
  function deltaHtml(row) {
    const d=delta(row);let arrow='';
    if(d.number) arrow=`<svg aria-hidden="true" viewBox="0 0 12 16"><path d="${d.number>0?'m3 8 3-4 3 4M6 4v8':'m3 8 3 4 3-4M6 12V4'}"/></svg>`;
    return `<span class="delta delta-${d.kind}"${d.number?' aria-label="'+(d.number>0?'Рост':'Снижение')+' на '+Math.abs(d.number)+'"':''}>${arrow}${escape(d.label)}</span>`;
  }
  function valueLabel(row,i) {return i===2&&!successful(row)?'Ошибка':position(row.positions?.[i])===null?'101':String(row.positions[i]);}
  function renderRows() {
    const selected=filteredRows(),visible=selected.slice(0,state.limit);
    $('rows').innerHTML=visible.map(r=>`<tr><td><span class="query-text">${escape(r.query)}</span></td>${[0,1,2].map(i=>`<td class="${i===2?'rank-after':'rank-before'}${i===2&&position(r.positions?.[i])!==null&&r.positions[i]<=10?' rank-top':''}" title="${escape(!r.available?.[i]?'Запрос добавлен позже':position(r.positions?.[i])===null?'Нет позиции в замере':'')}">${escape(valueLabel(r,i))}</td>`).join('')}<td>${deltaHtml(r)}</td></tr>`).join('');
    $('table-wrap').hidden=!selected.length;$('empty').hidden=!!selected.length;$('more').hidden=visible.length>=selected.length;
    $('row-count').textContent=`Показано ${visible.length} из ${selected.length}`;$('more').textContent=`Показать ещё ${pageSize}`;$('export').disabled=!selected.length;$('search-clear').hidden=!state.search;
  }
  function render() {renderOverview();renderRows();}
  $('cohort').addEventListener('change',e=>{state.cohort=e.target.value;state.limit=pageSize;buildGroups();render();});
  $('group').addEventListener('change',e=>{state.group=e.target.value;state.limit=pageSize;render();});
  $('search').addEventListener('input',e=>{state.search=e.target.value;state.limit=pageSize;render();});
  $('search-clear').addEventListener('click',()=>{state.search='';$('search').value='';state.limit=pageSize;render();$('search').focus();});
  $('more').addEventListener('click',()=>{state.limit+=pageSize;renderRows();});
  $('export').addEventListener('click',()=>{
    const cell=v=>'"'+(/^[=+\-@\t\r]/.test(text(v))?"'":'')+text(v).replaceAll('"','""')+'"';
    const values=[['Запрос','Группа',...dates.map(d=>d.date),'Изменение за месяц','Найденная страница','Источники','Особенности'],...filteredRows().map(r=>[r.query,r.group,...[0,1,2].map(i=>valueLabel(r,i)),delta(r).number??delta(r).label,r.currentUrl,dates.map(d=>d.date+': '+d.source).join('; '),'101 — условное обозначение отсутствующей позиции. Доступность исторического замера хранится отдельно.'+(r.providerWarnings?.length?' Особенности порядка ответа XMLStock.':'')])];
    const url=URL.createObjectURL(new Blob(['\uFEFF'+values.map(r=>r.map(cell).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='krugozor-yandex-three-dates-2026-10-28.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),0);
  });
  buildGroups();render();
})();
