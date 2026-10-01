(() => {
  'use strict';
  const data = window.REPORT_DATA;
  if (!data || !window.ReportWorks) {
    const notice = document.createElement('p');
    notice.className = 'noscript-notice';
    notice.textContent = 'Не удалось загрузить интерактивную часть отчёта. Обновите страницу.';
    document.querySelector('main').prepend(notice);
    return;
  }
  const $ = id => document.getElementById(id);
  const tabs = [$('tab-results'), $('tab-work')];
  const panels = [$('panel-results'), $('panel-work')];
  const pageSize = window.matchMedia('(max-width:700px)').matches ? 10 : 25;
  const state = {tab:0, search:'', direction:'', limit:pageSize, engine:'yandex', scroll:[0,0]};
  const rows = data.ranking.rows;
  let routing = false;
  let queryTimer;
  $('show-more').firstChild.textContent = `Показать ещё ${pageSize} `;
  const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const normalize = text => String(text).toLocaleLowerCase('ru-RU').replaceAll('ё','е').trim();

  function delta(before, after) {
    if (before === null && after !== null) return '<span class="delta delta-new" aria-label="Появился в замере">Появился</span>';
    if (after === null || before === after) return '<span class="delta delta-none" aria-label="' + (after === null ? 'Позиция не указана' : 'Без изменений') + '">—</span>';
    const increase = before > after;
    const path = increase ? '<path d="m3 8 3-4 3 4M6 4v8"/>' : '<path d="m3 8 3 4 3-4M6 12V4"/>';
    return `<span class="delta delta-${increase?'positive':'negative'}" aria-label="${increase?'Рост':'Снижение'} на ${Math.abs(before-after)}"><svg aria-hidden="true" viewBox="0 0 12 16">${path}</svg>${Math.abs(before-after)}</span>`;
  }

  function renderRow(row) {
    let html = `<tr><td><span class="query-text">${escape(row.query)}</span></td>`;
    for (const engine of ['yandex','google']) {
      const value = row[engine];
      const before = value.before === null ? '—' : value.before;
      const after = value.after === null ? '—' : value.after;
      const top = value.after !== null && value.after <= 10 ? ' rank-top' : '';
      html += `<td class="engine-${engine} rank-before">${before}</td><td class="engine-${engine} rank-after${top}">${after}</td><td class="engine-${engine}">${delta(value.before,value.after)}</td>`;
    }
    return html + '</tr>';
  }

  function renderQueries({announce = true} = {}) {
    const term = normalize(state.search);
    const selected = rows.filter(row => (!state.direction || row.displayName === state.direction) && (!term || normalize(row.query).includes(term)));
    const visible = selected.slice(0,state.limit);
    $('query-rows').innerHTML = visible.map(renderRow).join('');
    $('positions-wrap').hidden = selected.length === 0;
    $('query-empty').hidden = selected.length !== 0;
    $('show-more').hidden = state.limit >= selected.length;
    $('search-clear').hidden = !state.search;
    $('query-count').textContent = `Показано: ${visible.length} из ${selected.length}`;
    if (!selected.length) {
      $('query-empty').querySelector('h3').textContent = term ? 'Запросы не найдены' : 'В этом направлении нет выросших запросов';
      $('query-empty').querySelector('p').textContent = term ? 'Попробуйте другое слово или выберите другое направление.' : 'Это направление учтено в общей сводке. Выберите другое направление, чтобы посмотреть выросшие запросы.';
    }
  }

  function chooseTab(index, {focus = false, updateRoute = true} = {}) {
    if (index !== state.tab) {
      state.scroll[state.tab] = window.scrollY;
      state.tab = index;
      tabs.forEach((tab,i) => {
        tab.setAttribute('aria-selected', String(i === index));
        tab.tabIndex = i === index ? 0 : -1;
        panels[i].hidden = i !== index;
      });
      requestAnimationFrame(() => window.scrollTo({top:state.scroll[index],behavior:'instant'}));
    }
    if (focus) tabs[index].focus({preventScroll:true});
    if (updateRoute) history.replaceState(null,'',index === 1 ? '#works' : '#results');
  }

  tabs.forEach((tab,index) => {
    tab.addEventListener('click', () => chooseTab(index));
    tab.addEventListener('keydown', event => {
      if (event.ctrlKey || event.altKey || event.metaKey) return;
      if (['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) {
        event.preventDefault();
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? 1 : 1-index;
        chooseTab(next,{focus:true});
      }
    });
  });

  $('query-search').addEventListener('input',event => {
    state.search = event.target.value;
    state.limit = pageSize;
    clearTimeout(queryTimer);
    queryTimer = setTimeout(renderQueries,100);
  });
  $('cluster-filter').addEventListener('change',event => {
    state.direction = event.target.value;
    state.limit = pageSize;
    renderQueries();
  });
  $('search-clear').addEventListener('click',() => {
    $('query-search').value = state.search = '';
    state.limit = pageSize;
    renderQueries();
    $('query-search').focus();
  });
  $('reset-filters').addEventListener('click',() => {
    $('query-search').value = state.search = '';
    $('cluster-filter').value = state.direction = '';
    state.limit = pageSize;
    renderQueries();
    $('query-search').focus();
  });
  $('show-more').addEventListener('click', () => {
    state.limit += pageSize;
    renderQueries();
  });
  document.querySelectorAll('[data-engine]').forEach(button => {
    if (button.tagName !== 'BUTTON') return;
    button.addEventListener('click', () => {
      state.engine = button.dataset.engine;
      $('positions-wrap').dataset.engine = state.engine;
      document.querySelectorAll('.mobile-engine button').forEach(item => item.setAttribute('aria-pressed',String(item === button)));
    });
  });

  window.ReportWorks.init(data.work.works,{
    onOpen(id) {
      if (!routing) history.pushState(null,'',`#work/${encodeURIComponent(id)}`);
    },
    onClose() {
      if (!routing) history.replaceState(null,'','#works');
    }
  });

  function route() {
    routing = true;
    const hash = location.hash;
    if (hash.startsWith('#work/')) {
      chooseTab(1,{updateRoute:false});
      let id;
      try { id = decodeURIComponent(hash.slice(6)); } catch { id = ''; }
      if (!window.ReportWorks.openWork(id)) history.replaceState(null,'','#works');
    } else {
      window.ReportWorks.close();
      chooseTab(hash === '#works' ? 1 : 0,{updateRoute:false});
    }
    routing = false;
  }
  window.addEventListener('hashchange',route);
  window.addEventListener('popstate',route);
  renderQueries({announce:false});
  route();
})();
