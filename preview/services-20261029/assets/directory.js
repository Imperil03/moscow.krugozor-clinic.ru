(() => {
  'use strict';
  const mobile = window.matchMedia('(max-width: 767px)');
  document.querySelectorAll('.msk-service-directory').forEach(directory => {
    if (directory.dataset.mskDirectoryReady === '1') return;
    directory.dataset.mskDirectoryReady = '1';
    const groups = [...directory.querySelectorAll('.msk-service-directory__group')];
    const apply = () => groups.forEach(group => { group.open = !mobile.matches; });
    apply();
    if (mobile.addEventListener) mobile.addEventListener('change', apply);
    else mobile.addListener(apply);
  });
})();
