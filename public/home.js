(function () {
  'use strict';

  const body = document.body;
  const drawer = document.getElementById('site-drawer');
  const menuToggle = document.querySelector('.menu-toggle');
  const closeButtons = document.querySelectorAll('[data-close-drawer]');
  const panels = document.querySelectorAll('[data-panel]');
  const creatorPreview = new URLSearchParams(window.location.search).get('creator-preview') === '1';
  const defaultLayout = {
    accent: '#c6ef46',
    hero: { titleX: 50, titleY: 50, titleScale: 100, imageX: 54, imageY: 50, overlay: 66 },
    content: {
      cardWidth: 960,
      cards: {
        who: { x: 42, y: 50 },
        features: { x: 58, y: 50 },
        contact: { x: 42, y: 50 },
        support: { x: 42, y: 50 }
      }
    }
  };
  let homepageLayout = JSON.parse(JSON.stringify(defaultLayout));
  let lastFocusedElement = null;

  function numberInRange(value, fallback, min, max) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
  }

  function normalizeLayout(value) {
    const source = value && typeof value === 'object' ? value : {};
    const hero = source.hero && typeof source.hero === 'object' ? source.hero : {};
    const content = source.content && typeof source.content === 'object' ? source.content : {};
    const inputCards = content.cards && typeof content.cards === 'object' ? content.cards : {};
    const cards = {};
    Object.keys(defaultLayout.content.cards).forEach(id => {
      const input = inputCards[id] && typeof inputCards[id] === 'object' ? inputCards[id] : {};
      const fallback = defaultLayout.content.cards[id];
      cards[id] = {
        x: numberInRange(input.x, fallback.x, 12, 88),
        y: numberInRange(input.y, fallback.y, 18, 82)
      };
    });
    const accent = /^#[0-9a-f]{6}$/i.test(String(source.accent || ''))
      ? String(source.accent).toLowerCase()
      : defaultLayout.accent;
    return {
      accent,
      hero: {
        titleX: numberInRange(hero.titleX, defaultLayout.hero.titleX, 12, 88),
        titleY: numberInRange(hero.titleY, defaultLayout.hero.titleY, 18, 82),
        titleScale: numberInRange(hero.titleScale, defaultLayout.hero.titleScale, 55, 145),
        imageX: numberInRange(hero.imageX, defaultLayout.hero.imageX, 0, 100),
        imageY: numberInRange(hero.imageY, defaultLayout.hero.imageY, 0, 100),
        overlay: numberInRange(hero.overlay, defaultLayout.hero.overlay, 20, 90)
      },
      content: {
        cardWidth: numberInRange(content.cardWidth, defaultLayout.content.cardWidth, 520, 1120),
        cards
      }
    };
  }

  function applyHomepageLayout(value) {
    homepageLayout = normalizeLayout(value);
    const root = document.documentElement.style;
    root.setProperty('--accent', homepageLayout.accent);
    root.setProperty('--hero-title-x', `${homepageLayout.hero.titleX}%`);
    root.setProperty('--hero-title-y', `${homepageLayout.hero.titleY}%`);
    root.setProperty('--hero-title-scale', String(homepageLayout.hero.titleScale / 100));
    root.setProperty('--hero-image-x', `${homepageLayout.hero.imageX}%`);
    root.setProperty('--hero-image-y', `${homepageLayout.hero.imageY}%`);
    root.setProperty('--hero-overlay', String(homepageLayout.hero.overlay / 100));
    root.setProperty('--card-width', `${homepageLayout.content.cardWidth}px`);
    Object.entries(homepageLayout.content.cards).forEach(([id, position]) => {
      const panel = document.getElementById(id);
      if (!panel) return;
      panel.style.setProperty('--card-x', `${position.x}%`);
      panel.style.setProperty('--card-y', `${position.y}%`);
    });
  }

  function notifyCreator(type, extra = {}) {
    if (!creatorPreview || window.parent === window) return;
    window.parent.postMessage({ type, ...extra }, window.location.origin);
  }

  function initializeCreatorPreview() {
    if (!creatorPreview) return;
    document.documentElement.classList.add('creator-preview');
    document.querySelectorAll('a, button').forEach(element => {
      element.addEventListener('click', event => event.preventDefault());
    });

    let drag = null;
    const beginDrag = (event, kind, id, element, bounds) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      document.querySelectorAll('.is-creator-selected').forEach(node => node.classList.remove('is-creator-selected'));
      element.classList.add('is-creator-selected', 'is-creator-dragging');
      drag = { kind, id, element, bounds };
      element.setPointerCapture?.(event.pointerId);
      notifyCreator('mosankai:creator-selection', { selection: kind === 'card' ? id : kind });
    };

    const hero = document.getElementById('home');
    const heroTitle = hero?.querySelector('.hero__content');
    hero?.addEventListener('pointerdown', event => {
      if (event.target.closest('.hero__content')) return;
      beginDrag(event, 'background', 'home', hero, hero.getBoundingClientRect());
    });
    heroTitle?.addEventListener('pointerdown', event => {
      beginDrag(event, 'title', 'home', heroTitle, hero.getBoundingClientRect());
    });
    Object.keys(defaultLayout.content.cards).forEach(id => {
      const panel = document.getElementById(id);
      const card = panel?.querySelector('.qa-card');
      card?.addEventListener('pointerdown', event => {
        beginDrag(event, 'card', id, card, panel.getBoundingClientRect());
      });
    });

    document.addEventListener('pointermove', event => {
      if (!drag) return;
      const x = (event.clientX - drag.bounds.left) / drag.bounds.width * 100;
      const y = (event.clientY - drag.bounds.top) / drag.bounds.height * 100;
      if (drag.kind === 'title') {
        homepageLayout.hero.titleX = numberInRange(x, 50, 12, 88);
        homepageLayout.hero.titleY = numberInRange(y, 50, 18, 82);
      } else if (drag.kind === 'background') {
        homepageLayout.hero.imageX = numberInRange(x, 54, 0, 100);
        homepageLayout.hero.imageY = numberInRange(y, 50, 0, 100);
      } else {
        homepageLayout.content.cards[drag.id].x = numberInRange(x, 50, 12, 88);
        homepageLayout.content.cards[drag.id].y = numberInRange(y, 50, 18, 82);
      }
      applyHomepageLayout(homepageLayout);
      notifyCreator('mosankai:creator-change', { layout: homepageLayout });
    });

    const endDrag = () => {
      if (!drag) return;
      drag.element.classList.remove('is-creator-dragging');
      drag = null;
    };
    document.addEventListener('pointerup', endDrag);
    document.addEventListener('pointercancel', endDrag);
    window.addEventListener('message', event => {
      if (event.origin !== window.location.origin || event.data?.type !== 'mosankai:creator-settings') return;
      applyHomepageLayout(event.data.layout);
      if (event.data.coverImage) {
        document.documentElement.style.setProperty('--hero-image', `url(${JSON.stringify(event.data.coverImage)})`);
      }
    });
    notifyCreator('mosankai:creator-ready');
  }

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
      applyHomepageLayout(settings?.layout);
      initializeCreatorPreview();
    })
    .catch(() => {
      applyHomepageLayout(defaultLayout);
      initializeCreatorPreview();
    });
}());
