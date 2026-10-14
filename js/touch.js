/* ============================================================
   ERGONOMIE TACTILE (iPhone)
   - Infobulles (pastilles série / jetons, badges) : elles n'apparaissaient qu'au survol de la souris,
     donc jamais au toucher. Un toucher les ouvre, un toucher ailleurs les ferme.
   - Quand le clavier s'ouvre, le champ en cours de saisie est ramené dans la zone visible.
   ============================================================ */
(function setupTouchHelpers(){
  if(typeof document === 'undefined' || typeof document.addEventListener !== 'function') return;

  const TIP_HOSTS = '.info-pill, .medallion-item';
  function closeTips(except){
    document.querySelectorAll('.tip-open').forEach(el => { if(el !== except) el.classList.remove('tip-open'); });
  }
  document.addEventListener('click', e => {
    const target = e.target;
    const host = target && typeof target.closest === 'function' ? target.closest(TIP_HOSTS) : null;
    // les médaillons de jeu sont des boutons qui lancent le jeu : seuls les pastilles et les badges ouvrent une infobulle
    if(host && (host.classList.contains('info-pill') || host.tagName !== 'BUTTON')){
      const open = !host.classList.contains('tip-open');
      closeTips();
      host.classList.toggle('tip-open', open);
    } else {
      closeTips();
    }
  });

  function isTextField(el){
    return !!el && (el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' ||
      (el.tagName === 'INPUT' && !/^(range|checkbox|radio|file|button|submit)$/.test(el.type || 'text')));
  }
  function keepFocusedFieldVisible(){
    const el = document.activeElement;
    if(isTextField(el) && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block:'center', behavior:'smooth' });
  }
  // « focusin » : le clavier met environ 300 ms à apparaître ; le redimensionnement de la zone visible confirme.
  document.addEventListener('focusin', () => { setTimeout(keepFocusedFieldVisible, 320); });
  if(typeof window !== 'undefined' && window.visualViewport && typeof window.visualViewport.addEventListener === 'function'){
    window.visualViewport.addEventListener('resize', keepFocusedFieldVisible);
  }
})();
