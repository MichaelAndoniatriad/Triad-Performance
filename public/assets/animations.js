(function () {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const STAGGER_MS = 400;
  const observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const delay = parseInt(el.dataset.animateDelay || '0', 10) * 4;
        el.style.transitionDelay = delay + 'ms';
        el.classList.add('is-visible');
        observer.unobserve(el);
      });
    },
    { threshold: 0.08, rootMargin: '0px 0px -50px 0px' }
  );

  function observeAll() {
    document.querySelectorAll('[data-animate]:not(.is-visible)').forEach(function (el) {
      observer.observe(el);
    });
  }

  function init() {
    requestAnimationFrame(observeAll);
  }

  window.observeTriadAnimations = observeAll;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
