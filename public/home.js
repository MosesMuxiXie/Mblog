(function () {
  'use strict';

  const body = document.body;
  const drawer = document.getElementById('site-drawer');
  const menuToggle = document.querySelector('.menu-toggle');
  const closeButtons = document.querySelectorAll('[data-close-drawer]');
  let panels = document.querySelectorAll('[data-panel]');
  const creatorPreview = new URLSearchParams(window.location.search).get('creator-preview') === '1';
  const defaultLayout = {
    accent: '#c6ef46',
    hero: { titleX: 50, titleY: 50, titleScale: 100, imageX: 54, imageY: 50, overlay: 66 },
    content: {
      cardWidth: 960,
      cards: {
        who: { x: 42, y: 50, backgroundImage: '', imageX: 50, imageY: 50, overlay: 78 },
        features: { x: 58, y: 50, backgroundImage: '', imageX: 50, imageY: 50, overlay: 78 },
        contact: { x: 42, y: 50, backgroundImage: '', imageX: 50, imageY: 50, overlay: 78 },
        support: { x: 42, y: 50, backgroundImage: '', imageX: 50, imageY: 50, overlay: 78 }
      },
      extraPages: []
    }
  };
  let homepageLayout = JSON.parse(JSON.stringify(defaultLayout));
  let extraPagesSignature = '';
  let panelObserver = null;
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
    const safeBackground = value => {
      const candidate = String(value || '').trim();
      return candidate.startsWith('/') && !candidate.startsWith('//')
        || /^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(candidate)
        ? candidate
        : '';
    };
    const pageVisual = (input, fallback) => ({
      x: numberInRange(input.x, fallback.x, 12, 88),
      y: numberInRange(input.y, fallback.y, 18, 82),
      backgroundImage: safeBackground(input.backgroundImage),
      imageX: numberInRange(input.imageX, 50, 0, 100),
      imageY: numberInRange(input.imageY, 50, 0, 100),
      overlay: numberInRange(input.overlay, 78, 20, 95)
    });
    Object.keys(defaultLayout.content.cards).forEach(id => {
      const input = inputCards[id] && typeof inputCards[id] === 'object' ? inputCards[id] : {};
      const fallback = defaultLayout.content.cards[id];
      cards[id] = pageVisual(input, fallback);
    });
    const extraPages = (Array.isArray(content.extraPages) ? content.extraPages : []).slice(0, 8)
      .filter(page => /^custom-[a-z0-9-]{4,48}$/.test(String(page?.id || '')))
      .map((page, index) => ({
        id: String(page.id),
        label: String(page.label || `PAGE / ${String(index + 5).padStart(2, '0')}`).slice(0, 48),
        title: String(page.title || '新页面标题').slice(0, 120),
        body: String(page.body || '在创作者模式中编辑这个页面的内容。').slice(0, 1000),
        ...pageVisual(page, { x: index % 2 ? 58 : 42, y: 50 })
      }));
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
        cards,
        extraPages
      }
    };
  }

  function renderExtraPages(extraPages) {
    const signature = JSON.stringify(extraPages.map(page => page.id));
    if (signature === extraPagesSignature) return;
    extraPagesSignature = signature;
    document.querySelectorAll('[data-extra-homepage-page]').forEach(panel => panel.remove());

    const stack = document.querySelector('.page-stack');
    const support = document.getElementById('support');
    const supportBackLink = support?.querySelector('.back-to-top');
    support?.classList.toggle('qa-panel--final', !extraPages.length);
    if (supportBackLink) supportBackLink.hidden = Boolean(extraPages.length);

    extraPages.forEach((page, index) => {
      const number = index + 5;
      const panel = document.createElement('section');
      panel.id = page.id;
      panel.dataset.panel = '';
      panel.dataset.extraHomepagePage = '';
      panel.className = `panel qa-panel${number % 2 === 0 ? ' qa-panel--reverse' : ''}`;

      const pageNumber = document.createElement('div');
      pageNumber.className = 'qa-panel__number';
      pageNumber.setAttribute('aria-hidden', 'true');
      pageNumber.textContent = String(number).padStart(2, '0');

      const card = document.createElement('div');
      card.className = 'qa-card reveal';
      const label = document.createElement('p');
      label.className = 'qa-card__label';
      label.textContent = page.label;
      const title = document.createElement('h2');
      title.textContent = page.title;
      const rule = document.createElement('div');
      rule.className = 'qa-card__rule';
      rule.setAttribute('aria-hidden', 'true');
      const bodyCopy = document.createElement('p');
      bodyCopy.textContent = page.body;
      card.append(label, title, rule, bodyCopy);
      panel.append(pageNumber, card);

      if (index === extraPages.length - 1) {
        const backLink = document.createElement('a');
        backLink.className = 'back-to-top';
        backLink.href = '#home';
        backLink.textContent = '返回顶部 ↑';
        panel.append(backLink);
      }
      stack?.append(panel);
      if (panelObserver) panelObserver.observe(panel);
      else if (!('IntersectionObserver' in window)) panel.classList.add('is-visible');
    });
    panels = document.querySelectorAll('[data-panel]');
  }

  function applyPageVisual(id, page) {
    const panel = document.getElementById(id);
    if (!panel) return;
    if (panel.hasAttribute('data-extra-homepage-page')) {
      panel.querySelector('.qa-card__label').textContent = page.label;
      panel.querySelector('.qa-card h2').textContent = page.title;
      panel.querySelector('.qa-card > p:last-of-type').textContent = page.body;
    }
    panel.style.setProperty('--card-x', `${page.x}%`);
    panel.style.setProperty('--card-y', `${page.y}%`);
    panel.style.setProperty('--page-image-x', `${page.imageX}%`);
    panel.style.setProperty('--page-image-y', `${page.imageY}%`);
    panel.style.setProperty('--page-overlay', String(page.overlay / 100));
    panel.classList.toggle('has-page-background', Boolean(page.backgroundImage));
    if (page.backgroundImage) {
      panel.style.setProperty('--page-background', `url(${JSON.stringify(page.backgroundImage)})`);
    } else {
      panel.style.removeProperty('--page-background');
    }
  }

  function applyHomepageLayout(value) {
    homepageLayout = normalizeLayout(value);
    renderExtraPages(homepageLayout.content.extraPages);
    const root = document.documentElement.style;
    root.setProperty('--accent', homepageLayout.accent);
    root.setProperty('--hero-title-x', `${homepageLayout.hero.titleX}%`);
    root.setProperty('--hero-title-y', `${homepageLayout.hero.titleY}%`);
    root.setProperty('--hero-title-scale', String(homepageLayout.hero.titleScale / 100));
    root.setProperty('--hero-image-x', `${homepageLayout.hero.imageX}%`);
    root.setProperty('--hero-image-y', `${homepageLayout.hero.imageY}%`);
    root.setProperty('--hero-overlay', String(homepageLayout.hero.overlay / 100));
    root.setProperty('--card-width', `${homepageLayout.content.cardWidth}px`);
    Object.entries(homepageLayout.content.cards).forEach(([id, page]) => applyPageVisual(id, page));
    homepageLayout.content.extraPages.forEach(page => applyPageVisual(page.id, page));
  }

  function notifyCreator(type, extra = {}) {
    if (!creatorPreview || window.parent === window) return;
    window.parent.postMessage({ type, ...extra }, window.location.origin);
  }

  function initializeCreatorPreview() {
    if (!creatorPreview) return;
    document.documentElement.classList.add('creator-preview');
    document.addEventListener('click', event => {
      if (event.target.closest('a, button')) event.preventDefault();
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
      notifyCreator('mosankai:creator-selection', {
        selection: kind === 'card' ? id : kind,
        pageId: id
      });
    };

    document.addEventListener('pointerdown', event => {
      const hero = event.target.closest('#home');
      const heroTitle = event.target.closest('.hero__content');
      if (heroTitle && hero) {
        beginDrag(event, 'title', 'home', heroTitle, hero.getBoundingClientRect());
        return;
      }
      if (hero) {
        beginDrag(event, 'hero-background', 'home', hero, hero.getBoundingClientRect());
        return;
      }
      const panel = event.target.closest('.qa-panel');
      if (!panel) return;
      const card = event.target.closest('.qa-card');
      if (card) {
        beginDrag(event, 'card', panel.id, card, panel.getBoundingClientRect());
      } else {
        beginDrag(event, 'page-background', panel.id, panel, panel.getBoundingClientRect());
      }
    });

    document.addEventListener('pointermove', event => {
      if (!drag) return;
      const x = (event.clientX - drag.bounds.left) / drag.bounds.width * 100;
      const y = (event.clientY - drag.bounds.top) / drag.bounds.height * 100;
      if (drag.kind === 'title') {
        homepageLayout.hero.titleX = numberInRange(x, 50, 12, 88);
        homepageLayout.hero.titleY = numberInRange(y, 50, 18, 82);
        notifyCreator('mosankai:creator-change', { patch: { kind: 'title', x, y } });
      } else if (drag.kind === 'hero-background') {
        homepageLayout.hero.imageX = numberInRange(x, 54, 0, 100);
        homepageLayout.hero.imageY = numberInRange(y, 50, 0, 100);
        notifyCreator('mosankai:creator-change', { patch: { kind: 'hero-background', x, y } });
      } else {
        const page = homepageLayout.content.cards[drag.id]
          || homepageLayout.content.extraPages.find(item => item.id === drag.id);
        if (!page) return;
        if (drag.kind === 'card') {
          page.x = numberInRange(x, 50, 12, 88);
          page.y = numberInRange(y, 50, 18, 82);
        } else {
          page.imageX = numberInRange(x, 50, 0, 100);
          page.imageY = numberInRange(y, 50, 0, 100);
        }
        notifyCreator('mosankai:creator-change', {
          patch: { kind: drag.kind, id: drag.id, x, y }
        });
      }
      applyHomepageLayout(homepageLayout);
    });

    const endDrag = () => {
      if (!drag) return;
      drag.element.classList.remove('is-creator-dragging');
      drag = null;
    };
    document.addEventListener('pointerup', endDrag);
    document.addEventListener('pointercancel', endDrag);
    window.addEventListener('message', event => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'mosankai:creator-scroll') {
        document.getElementById(String(event.data.id || ''))?.scrollIntoView({ behavior: 'smooth' });
        return;
      }
      if (event.data?.type !== 'mosankai:creator-settings') return;
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
    panelObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) entry.target.classList.add('is-visible');
      });
    }, { threshold: 0.45 });

    panels.forEach(panel => panelObserver.observe(panel));
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
