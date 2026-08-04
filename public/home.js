(function () {
  'use strict';

  const body = document.body;
  const drawer = document.getElementById('site-drawer');
  const menuToggle = document.querySelector('.menu-toggle');
  const closeButtons = document.querySelectorAll('[data-close-drawer]');
  const panels = document.querySelectorAll('[data-panel]');
  let lastFocusedElement = null;

  function setDrawer(open) {
    body.classList.toggle('drawer-open', open);
    menuToggle.setAttribute('aria-expanded', String(open));
    drawer.setAttribute('aria-hidden', String(!open));

    if (open) {
      lastFocusedElement = document.activeElement;
      drawer.querySelector('.drawer-close').focus();
    } else if (lastFocusedElement) {
      lastFocusedElement.focus();
      lastFocusedElement = null;
    }
  }

  menuToggle.addEventListener('click', () => {
    setDrawer(menuToggle.getAttribute('aria-expanded') !== 'true');
  });

  closeButtons.forEach(button => {
    button.addEventListener('click', () => setDrawer(false));
  });

  drawer.addEventListener('click', event => {
    if (event.target.closest('a')) setDrawer(false);
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && body.classList.contains('drawer-open')) {
      setDrawer(false);
    }
  });

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) entry.target.classList.add('is-visible');
      });
    }, { threshold: 0.45 });

    panels.forEach(panel => observer.observe(panel));
  } else {
    panels.forEach(panel => panel.classList.add('is-visible'));
  }

  fetch('/api/site-settings', { cache: 'no-store' })
    .then(response => response.ok ? response.json() : null)
    .then(settings => {
      const coverImage = String(settings?.coverImage || '');
      const validCover = coverImage.startsWith('/') && !coverImage.startsWith('//')
        || /^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(coverImage);
      if (validCover) {
        document.documentElement.style.setProperty('--hero-image', `url(${JSON.stringify(coverImage)})`);
      }
    })
    .catch(() => {});
}());
