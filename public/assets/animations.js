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

  function init() {
    requestAnimationFrame(function () {
      document.querySelectorAll('[data-animate]').forEach(function (el) {
        observer.observe(el);
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
