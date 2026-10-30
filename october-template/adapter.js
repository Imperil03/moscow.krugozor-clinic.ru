(() => {
 'use strict';
 const R=window.REPORT_OCTOBER_RANKINGS,C=window.REPORT_OCTOBER_CLICKS,W=window.REPORT_OCTOBER_WORKS;
 if(!R||!C||!W) throw new Error('Данные московского отчёта не загружены.');
 document.body.innerHTML="\n  <a class=\"skip-link\" href=\"#report-content\">К содержанию отчёта</a>\n  <div class=\"report-shell\">\n    <header class=\"report-header\">\n      <div class=\"report-heading\"><h1>Отчёт по продвижению сайта <span id=\"report-client\">«Кругозор»</span></h1></div>\n      <div class=\"month-picker\"><label for=\"report-month\">Месяц отчёта</label><div class=\"select-wrap\"><select id=\"report-month\" aria-label=\"Месяц отчёта\"></select><svg aria-hidden=\"true\" viewBox=\"0 0 24 24\"><path d=\"m7 10 5 5 5-5\"/></svg></div></div>\n    </header>\n    <nav class=\"report-nav\" aria-label=\"Разделы отчёта\">\n      <div class=\"tabs\" role=\"tablist\" aria-label=\"Отчёт по продвижению сайта\">\n        <button type=\"button\" role=\"tab\" id=\"tab-results\" aria-controls=\"panel-results\" aria-selected=\"true\" tabindex=\"0\">Результаты</button>\n        <button type=\"button\" role=\"tab\" id=\"tab-works\" aria-controls=\"panel-works\" aria-selected=\"false\" tabindex=\"-1\">Работы <span id=\"work-count\" class=\"tab-count\" hidden></span></button>\n      </div>\n    </nav>\n    <main id=\"report-content\">\n      <section id=\"panel-results\" role=\"tabpanel\" aria-labelledby=\"tab-results\" tabindex=\"-1\"><p class=\"loading-message\" role=\"status\">Загружаем отчёт…</p></section>\n      <section id=\"panel-works\" role=\"tabpanel\" aria-labelledby=\"tab-works\" tabindex=\"-1\" hidden></section>\n      <noscript><p class=\"notice\">Для переключения месяцев и просмотра отчёта включите JavaScript в браузере.</p></noscript>\n    </main>\n    <footer class=\"report-footer\"><a id=\"site-link\" href=\"https://moscow.krugozor-clinic.ru/\" target=\"_blank\" rel=\"noopener noreferrer\">moscow.krugozor-clinic.ru <svg aria-hidden=\"true\" viewBox=\"0 0 24 24\"><path d=\"M7 17 17 7M7 7h10v10\"/></svg></a><span id=\"period-label\">Сентябрь 2026 — октябрь 2026</span></footer>\n  </div>\n  <dialog id=\"detail-dialog\" class=\"detail-dialog\" aria-labelledby=\"detail-title\">\n    <div class=\"drawer-header\"><div><h2 id=\"detail-title\"></h2><p id=\"detail-meta\"></p></div><button type=\"button\" id=\"close-detail\" class=\"icon-button\" aria-label=\"Закрыть подробности\" autofocus><svg aria-hidden=\"true\" viewBox=\"0 0 24 24\"><path d=\"m6 6 12 12M18 6 6 18\"/></svg></button></div>\n    <div id=\"detail-body\" class=\"drawer-body\"></div>\n  </dialog>\n  <p id=\"announcement\" class=\"sr-only\" role=\"status\" aria-live=\"polite\"></p>\n";
 const dates=R.dates.map(item=>item.date);
 const engineDates={yandex:R.dates,google:R.googleDates||R.dates};
 const snapshot=index=>({date:dates[index],region:R.context.region,device:R.context.device,engines:{yandex:{searcher:0,checkedAt:engineDates.yandex[index].date,region:R.context.region,regionId:R.context.regionId,device:R.context.device,language:R.context.language},google:{searcher:1,checkedAt:engineDates.google[index].date,region:R.context.region,regionId:R.context.regionId,device:R.context.device,language:R.context.language}},rows:R.rows.map(row=>{
  const value={id:row.id,query:row.query,direction:row.group,observations:{}};
  for(const engine of ['yandex','google']) {
   const raw=engine==='yandex'?row:row.google,available=raw.available[index],position=raw.positions[index];
   const status=index===2&&raw.status==='error'?'error':!available?'missing':position==null?'not_found':'found';
   if(available&&status!=='error') value[engine]=position;
   value.observations[engine]={status,checkedAt:engineDates[engine][index].date,url:raw.urls[index]||'',source:index===2?'XMLStock':'Topvisor'};
  }
  return value;
 })});
 const works=W.works.map(work=>({...work,
  resultBullets:(work.facts||[]).map(f=>`${f.value} — ${f.label}`),
  sections:[...(work.sections||[]).map(s=>({...s,text:(s.paragraphs||[]).join('\n\n')})),...(work.links?.length?[{title:'Страницы сайта',links:work.links}]:[])],
  evidence:(work.evidence||[]).map(e=>({...e,label:e.title,type:e.type==='text-comparison'?'comparison':e.type}))
 }));
 window.REPORT_DATA={project:{id:'moscow',name:'Кругозор',website:'https://moscow.krugozor-clinic.ru/',currentMonth:'2026-10'},reports:[
  {projectId:'moscow',month:'2026-09',intro:[],conclusions:[],works:[]},
  {projectId:'moscow',month:'2026-10',status:'in_progress',intro:[
   "В октябре продолжили развивать московский сайт клиники «Кругозор». **Опубликовали 9 новых материалов — 5 статей и 4 страницы услуг**, расширив информацию о заболеваниях глаз, диагностике и коррекции зрения. Также обновили структуру каталога и навигацию на главной странице, улучшили внутренние ссылки, поисковые заголовки и устранили ряд технических недочётов.",
   "**Поисковая видимость сайта продолжает улучшаться.** В Яндексе количество запросов в ТОП-10 увеличилось с 37 до 64 — рост на 73%. В Google сайт сохраняет достигнутые позиции: 67 запросов в первой десятке против 66 в начале периода.",
   "Таким образом, в октябре мы не только улучшили текущие позиции, но и расширили возможности дальнейшего продвижения за счёт новых страниц услуг и статей. В следующих месяцах будем отслеживать их индексацию и результаты в поиске."
  ],conclusions:[],works,rankings:{start:snapshot(0),before:snapshot(1),after:snapshot(2),cohorts:R.cohorts.map(c=>({...c,keywordIds:R.rows.filter(r=>r.cohorts.includes(c.id)).map(r=>r.id)}))}}
 ]};
 document.getElementById('report-month').addEventListener('change',event=>{
  if(event.target.value!=='2026-10'){event.stopImmediatePropagation();const url=new URL(location.href);url.searchParams.set('month',event.target.value);url.searchParams.delete('work');location.assign(url);}
 },true);
})();
