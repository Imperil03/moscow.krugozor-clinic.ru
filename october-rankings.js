(() => {
  'use strict';
  const host=document.getElementById('october-results');if(!host)return;
  const data=window.REPORT_OCTOBER_RANKINGS;
  const $=name=>document.getElementById(`oct-${name}`),text=v=>String(v??'');
  const escape=v=>text(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=v=>text(v).toLocaleLowerCase('ru-RU').replaceAll('ё','е').trim();
  const position=v=>Number.isInteger(v)&&v>0?v:null;
  const shortDate=v=>text(v).slice(5).split('-').reverse().join('.');
  const dateLabel=v=>new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long',timeZone:'UTC'}).format(new Date(`${v}T12:00:00Z`));
  if(!data||data.schemaVersion!==2||!Array.isArray(data.rows)||data.dates?.length!==3){$('loading').textContent='Позиции пока недоступны. Обновите страницу позже.';return;}
  const rows=data.rows,dates=data.dates,googleReady=data.googleCollected===true;
  const pageSize=window.matchMedia('(max-width:700px)').matches?10:25;
  const state={cohort:'all',group:'',search:'',limit:pageSize,engine:'yandex'};
  const cohorts=data.cohorts||[{id:'all',label:'Весь проект'}];
  const engineName=e=>e==='google'?'Google':'Яндекс';
  const record=(row,engine='yandex')=>engine==='google'?(row.google||{positions:[null,null,null],available:[false,false,false],urls:['','',''],status:'pending'}):row;
  const successful=r=>['found','not_found'].includes(r.status);
  $('cohort').innerHTML=cohorts.map(c=>`<option value="${escape(c.id)}">${escape(c.label)}</option>`).join('');$('cohort').value=state.cohort;
  $('loading').hidden=true;$('content').hidden=false;
  host.classList.toggle('oct-single-engine',!googleReady);$('engine-google').hidden=!googleReady;$('google-chart-card').hidden=!googleReady;
  function cohortRows(){return rows.filter(r=>r.cohorts?.includes(state.cohort));}
  function filteredRows(){const q=norm(state.search);return cohortRows().filter(r=>(!state.group||r.group===state.group)&&(!q||norm(r.query).includes(q)));}
  function buildGroups(){const names=[...new Set(cohortRows().map(r=>r.group))].filter(Boolean).sort((a,b)=>a.localeCompare(b,'ru'));if(!names.includes(state.group))state.group='';$('group').innerHTML='<option value="">Все направления</option>'+names.map(n=>`<option value="${escape(n)}">${escape(n)}</option>`).join('');$('group').value=state.group;}
  function commonRows(selected,engine,from=null){return selected.map(r=>record(r,engine)).filter(r=>successful(r)&&(from===null?r.available?.every(Boolean):r.available?.[from]&&r.available?.[2]));}
  const countTop=(selected,i,top)=>selected.filter(r=>position(r.positions?.[i])!==null&&r.positions[i]<=top).length;
  const percentage=(n,total)=>total?new Intl.NumberFormat('ru-RU',{minimumFractionDigits:1,maximumFractionDigits:1}).format(100*n/total)+'%':'—';
  function card(engine,from,label,selected){const common=commonRows(selected,engine,from),before=countTop(common,from,10),after=countTop(common,2,10),diff=after-before;
    return `<section class="kpi-card" aria-labelledby="oct-kpi-${engine}-${from}"><h2 id="oct-kpi-${engine}-${from}">${engineName(engine)} · топ-10 ${label}</h2><div class="kpi-values"><span class="kpi-value-column"><span class="kpi-period">${shortDate(dates[from].date)}</span><span class="kpi-before">${percentage(before,common.length)}</span></span><span class="kpi-arrow" aria-hidden="true">→</span><span class="kpi-value-column"><span class="kpi-period">${shortDate(dates[2].date)}</span><strong class="kpi-after${diff<0?' delta-negative':''}">${percentage(after,common.length)}</strong></span></div><p class="kpi-count" title="По ${common.length} запросам с историей">${common.length?before+' <span aria-hidden="true">→</span> '+after+' запросов':'Нет прежнего замера'}</p></section>`;
  }
  function chart(engine,values,roof,total){const classes=['before','middle','after'];$(`legend-${engine}`).innerHTML=dates.map((d,i)=>`<span><i class="legend-${classes[i]}"></i>${dateLabel(d.date)}</span>`).join('');
    function svg(mobile){const width=mobile?350:630,left=mobile?29:40,right=width-8,base=208,plot=186,id=`oct-svg-${engine}-${mobile?'mobile':'desktop'}`;
      if(!total)return `<svg class="chart-svg-${mobile?'mobile':'desktop'}" viewBox="0 0 ${width} 250" role="img" aria-label="Нет прежнего замера"></svg>`;
      let content='';for(let i=0;i<=4;i++){const y=base-plot*i/4;content+=`<line class="chart-grid-line" x1="${left}" x2="${right}" y1="${y}" y2="${y}"/><text class="chart-label" x="${left-10}" y="${y+5}" text-anchor="end">${roof*i/4}</text>`;}
      content+=`<path class="chart-axis" fill="none" d="M${left} 22V${base}H${right}"/>`;
      const groupWidth=(right-left)/2,barWidth=mobile?24:53,gap=mobile?5:8;
      [3,10].forEach((top,g)=>{const cx=left+groupWidth*(g+.5);values[g].forEach((n,i)=>{const x=cx+(i-1)*(barWidth+gap)-barWidth/2,h=plot*n/roof,y=base-h;content+=`<rect class="chart-bar-${classes[i]}" x="${x}" y="${y}" width="${barWidth}" height="${h}" rx="2"/><text class="chart-value" x="${x+barWidth/2}" y="${Math.max(15,y-10)}" text-anchor="middle">${n}</text>`;});content+=`<text class="chart-label chart-category" x="${cx}" y="237" text-anchor="middle">В топ-${top}</text>`;});
      const desc=[3,10].map((top,g)=>`Топ-${top}: `+dates.map((d,i)=>`${dateLabel(d.date)} — ${values[g][i]}`).join(', ')).join('. ');
      return `<svg class="chart-svg-${mobile?'mobile':'desktop'}" viewBox="0 0 ${width} 250" role="img" aria-labelledby="${id}-title ${id}-desc"><title id="${id}-title">${engineName(engine)}: запросы в топ-3 и топ-10</title><desc id="${id}-desc">${escape(desc)}.</desc>${content}</svg>`;
    }$(`chart-${engine}`).innerHTML=svg(false)+svg(true);
  }
  function renderOverview(){const selected=filteredRows();$('kpis').innerHTML=card('yandex',1,'за месяц',selected)+card('yandex',0,'с начала',selected)+(googleReady?card('google',1,'за месяц',selected)+card('google',0,'с начала',selected):'');
    const engines=googleReady?['yandex','google']:['yandex'],series={};let max=1;
    for(const e of engines){const common=commonRows(selected,e),values=[3,10].map(top=>[0,1,2].map(i=>countTop(common,i,top)));series[e]={values,total:common.length};max=Math.max(max,...values.flat());}
    const nice=[1,2,3,5,10,15,20,25,50,100,150,200],step=nice.find(n=>n>=max/4)||Math.ceil(max/4/100)*100,roof=step*4;
    for(const e of engines)chart(e,series[e].values,roof,series[e].total);
  }
  function delta(row,engine=state.engine){const r=record(row,engine);if(!successful(r))return {kind:'none',label:'Ошибка'};if(!r.available?.[1])return {kind:'none',label:'Новый запрос'};
    const before=position(r.positions?.[1]),after=position(r.positions?.[2]);if(before!==null&&after!==null){const number=before-after;return{kind:number>0?'positive':number<0?'negative':'none',number,label:number?`${number>0?'Рост':'Снижение'} на ${Math.abs(number)}`:'Без изменений'};}
    if(before===null&&after!==null)return{kind:'new',label:'Появился в замере'};return{kind:before!==null?'negative':'none',label:before!==null?'Не найден в замере':'Нет позиции'};
  }
  function deltaHtml(row){const d=delta(row);if(d.number===0||d.kind==='none')return '';const up=d.kind==='positive'||d.kind==='new',path=up?'m3 8 3-4 3 4M6 4v8':'m3 8 3 4 3-4M6 12V4';
    return `<sup class="oct-rank-change delta-${d.kind==='new'?'positive':d.kind}" aria-label="${escape(d.label)}" title="${escape(d.label)}"><svg aria-hidden="true" viewBox="0 0 12 16"><path d="${path}"/></svg>${Number.isInteger(d.number)?Math.abs(d.number):''}</sup>`;
  }
  function valueLabel(row,i,engine=state.engine){const r=record(row,engine);return i===2&&!successful(r)?'Ошибка':position(r.positions?.[i])===null?'101':String(r.positions[i]);}
  function renderRows(){const selected=filteredRows(),visible=selected.slice(0,state.limit);$('engine-heading').textContent=engineName(state.engine);$('table-caption').textContent=`Позиции ${engineName(state.engine)}: ${dates.map(d=>dateLabel(d.date)).join(', ')}.`;$('table-wrap').setAttribute('aria-label',`Позиции ${engineName(state.engine)} за три даты`);
    $('rows').innerHTML=visible.map(row=>{const r=record(row,state.engine);return `<tr><td><span class="query-text">${escape(row.query)}</span></td>${[0,1,2].map(i=>`<td class="${i===2?'rank-after':'rank-before'}${i===2&&successful(r)&&position(r.positions?.[i])!==null&&r.positions[i]<=10?' rank-top':''}" title="${escape(!r.available?.[i]?'Запрос добавлен позже':position(r.positions?.[i])===null?'Нет позиции в замере':'')}">${escape(valueLabel(row,i))}${i===2?deltaHtml(row):''}</td>`).join('')}</tr>`;}).join('');
    $('table-wrap').hidden=!selected.length;$('empty').hidden=!!selected.length;$('more').hidden=visible.length>=selected.length;$('row-count').textContent=`Показано ${visible.length} из ${selected.length}`;$('more').textContent=`Показать ещё ${pageSize}`;$('export').disabled=!selected.length;$('search-clear').hidden=!state.search;
  }
  function render(){renderOverview();renderRows();}
  $('cohort').addEventListener('change',e=>{state.cohort=e.target.value;state.limit=pageSize;buildGroups();render();});$('group').addEventListener('change',e=>{state.group=e.target.value;state.limit=pageSize;render();});$('search').addEventListener('input',e=>{state.search=e.target.value;state.limit=pageSize;render();});$('search-clear').addEventListener('click',()=>{state.search='';$('search').value='';state.limit=pageSize;render();$('search').focus();});$('more').addEventListener('click',()=>{state.limit+=pageSize;renderRows();});
  for(const e of ['yandex','google'])$(`engine-${e}`).addEventListener('click',()=>{if(e==='google'&&!googleReady)return;state.engine=e;state.limit=pageSize;for(const name of ['yandex','google'])$(`engine-${name}`).setAttribute('aria-pressed',String(name===e));renderRows();});
  $('export').addEventListener('click',()=>{const cell=v=>'"'+(/^[=+\-@\t\r]/.test(text(v))?"'":'')+text(v).replaceAll('"','""')+'"';const sourceDates=state.engine==='google'?(data.googleDates||dates.map((d,i)=>({...d,source:i===2?'XMLStock · Google XML':'Topvisor · Google'}))):dates;
    const values=[['Запрос','Группа','Поисковая система',...dates.map(d=>d.date),'Изменение за месяц','Найденная страница','Источники','Особенности'],...filteredRows().map(row=>{const r=record(row,state.engine),change=delta(row);return[row.query,row.group,engineName(state.engine),...[0,1,2].map(i=>valueLabel(row,i)),change.number??change.label,r.currentUrl||r.urls?.[2]||'',sourceDates.map(d=>d.date+': '+d.source).join('; '),'101 — условное обозначение отсутствующей позиции. Доступность исторического замера хранится отдельно.'+(r.providerWarnings?.length?' Особенности порядка ответа провайдера.':'')];})];
    const url=URL.createObjectURL(new Blob(['\uFEFF'+values.map(r=>r.map(cell).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`krugozor-${state.engine}-three-dates-2026-10-28.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),0);
  });
  function clickWord(n){const a=n%100,b=n%10;return a>=11&&a<=14?'кликов':b===1?'клик':b>=2&&b<=4?'клика':'кликов';}
  function renderClicks(){const clicks=window.REPORT_OCTOBER_CLICKS,points=clicks?.weekly?.filter(p=>p.complete!==false&&Number.isFinite(p.clicks)&&p.clicks>=0)||[];if(points.length<2)return;$('clicks-section').hidden=false;
    const max=Math.max(1,...points.map(p=>p.clicks)),step=[1,2,5,10,20,50,100,200,250,500,1000,2000,5000].find(n=>n>=max/4)||Math.ceil(max/4/1000)*1000,roof=step*4;
    function svg(mobile){const width=mobile?350:1120,left=mobile?42:52,right=width-15,base=208,plot=180,x=i=>left+(right-left)*i/(points.length-1),y=n=>base-plot*n/roof;let s='';
      for(let i=0;i<=4;i++){const yy=base-plot*i/4;s+=`<line class="chart-grid-line" x1="${left}" x2="${right}" y1="${yy}" y2="${yy}"/><text class="chart-label" x="${left-10}" y="${yy+5}" text-anchor="end">${new Intl.NumberFormat('ru-RU').format(roof*i/4)}</text>`;}
      s+=`<path class="chart-axis" fill="none" d="M${left} 28V${base}H${right}"/><path class="oct-click-line" d="${points.map((p,i)=>(i?'L':'M')+x(i)+','+y(p.clicks)).join(' ')}"/>`;
      points.forEach((p,i)=>{const label=`${dateLabel(p.date)} — ${dateLabel(p.endDate)}: ${p.clicks} ${clickWord(p.clicks)}`,showTick=!mobile||i%2===0||i===points.length-1;s+=`<circle class="oct-click-dot" cx="${x(i)}" cy="${y(p.clicks)}" r="4"/><circle class="oct-click-hit" data-week="${i}" tabindex="0" role="img" aria-label="${escape(label)}" cx="${x(i)}" cy="${y(p.clicks)}" r="14"/>`;if(showTick)s+=`<text class="chart-label" x="${x(i)}" y="237" text-anchor="middle">${shortDate(p.date)}</text>`;});
      return `<svg class="chart-svg-${mobile?'mobile':'desktop'}" viewBox="0 0 ${width} 250" role="group" aria-label="Клики из Google">${s}</svg>`;
    }
    $('clicks-chart').innerHTML=svg(false)+svg(true)+'<div id="oct-click-tooltip" class="oct-click-tooltip" role="status" hidden></div>';
    const hits=[...$('clicks-chart').querySelectorAll('.oct-click-hit')],tip=$('click-tooltip');
    function show(hit){const p=points[Number(hit.getAttribute('data-week'))],plot=$('clicks-chart').getBoundingClientRect(),r=hit.getBoundingClientRect();tip.textContent=`${dateLabel(p.date)} — ${dateLabel(p.endDate)} · ${new Intl.NumberFormat('ru-RU').format(p.clicks)} ${clickWord(p.clicks)}`;tip.hidden=false;const left=Math.min(Math.max(r.left+r.width/2-plot.left-tip.offsetWidth/2,0),Math.max(0,plot.width-tip.offsetWidth));tip.style.left=left+'px';tip.style.top=Math.max(0,r.top-plot.top-42)+'px';}
    for(const hit of hits){hit.addEventListener('pointerenter',()=>show(hit));hit.addEventListener('focus',()=>show(hit));hit.addEventListener('click',()=>show(hit));hit.addEventListener('pointerleave',()=>{tip.hidden=true;});hit.addEventListener('blur',()=>{tip.hidden=true;});hit.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Escape'].includes(event.key))return;event.preventDefault();if(event.key==='Escape'){tip.hidden=true;return;}const siblings=[...hit.parentElement.querySelectorAll('.oct-click-hit')],i=siblings.indexOf(hit),next=Math.max(0,Math.min(siblings.length-1,i+(event.key==='ArrowRight'?1:-1)));siblings[next].focus();});}
  }
  buildGroups();render();renderClicks();
})();
