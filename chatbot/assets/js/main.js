/*
=====================================================
MARKSTREET MENU CONTROLLER
=====================================================

This controller:
- reads data from window.MARKSTREET_MENU
- renders primary navigation
- renders secondary navigation
- controls open/close state
- controls desktop expanded state
- controls mobile forward/back state

Do not hardcode menu labels in this file.
Edit assets/js/menu-data.js instead.

=====================================================
*/

(() => {
  const body = document.body;
  const header = document.querySelector('.ms-header');
  const menuLayer = document.querySelector('#markstreet-menu-layer');
  const menu = document.querySelector('#markstreet-menu');
  const menuToggle = document.querySelector('[data-menu-toggle]');
  const primaryList = document.querySelector('[data-menu-primary-list]');
  const secondary = document.querySelector('[data-menu-secondary]');
  const secondaryList = document.querySelector('[data-menu-secondary-list]');
  const sectionLabel = document.querySelector('[data-menu-section-label]');
  const sectionDescription = document.querySelector('[data-menu-section-description]');
  const sectionLink = document.querySelector('[data-menu-section-link]');
  const menuData = Array.isArray(window.MARKSTREET_MENU) ? window.MARKSTREET_MENU : [];

  let activeSectionId = null;

  /*
  PRIMARY NAVIGATION
  Buttons are rendered from menu-data.js. A primary button opens its
  secondary level; the main page remains available as "Open section".
  */
  function renderPrimaryMenu() {
    if (!primaryList) return;

    primaryList.replaceChildren();

    menuData.forEach((section) => {
      const button = document.createElement('button');
      button.className = `markstreet-menu__primary-item markstreet-menu__primary-item--${section.type}`;
      button.type = 'button';
      button.textContent = section.label;
      button.dataset.menuSection = section.id;
      button.setAttribute('aria-controls', 'markstreet-menu-secondary');
      button.setAttribute('aria-expanded', 'false');
      primaryList.append(button);
    });
  }

  /*
  SECONDARY NAVIGATION
  Every heading, description, main link and child link is populated
  from the selected object in menu-data.js.
  */
  function renderSecondaryMenu(section) {
    if (!section || !secondaryList || !sectionLabel || !sectionDescription || !sectionLink) return;

    sectionLabel.textContent = section.label;
    sectionDescription.textContent = section.description || '';
    sectionLink.href = section.href;
    sectionLink.textContent = `Open ${section.label}`;
    secondaryList.replaceChildren();

    (section.children || []).forEach((child) => {
      const link = document.createElement('a');
      link.className = 'markstreet-menu__secondary-item';
      link.href = child.href;
      link.textContent = child.label;
      secondaryList.append(link);
    });

    secondary.scrollTop = 0;
  }

  /* Expand the same desktop shell and move to the secondary view on mobile. */
  function openMenuSection(sectionId) {
    const section = menuData.find((item) => item.id === sectionId);
    if (!section || !menu || !secondary) return;

    activeSectionId = section.id;
    renderSecondaryMenu(section);
    menu.classList.add('is-expanded');
    secondary.setAttribute('aria-hidden', 'false');

    primaryList?.querySelectorAll('[data-menu-section]').forEach((item) => {
      const isActive = item.dataset.menuSection === activeSectionId;
      item.classList.toggle('is-active', isActive);
      item.setAttribute('aria-expanded', String(isActive));
    });
  }

  /* Return to the primary level without closing the overall menu. */
  function closeMenuSection({ restoreFocus = true } = {}) {
    if (!menu || !secondary) return;

    const previousSectionId = activeSectionId;
    activeSectionId = null;
    menu.classList.remove('is-expanded');
    secondary.setAttribute('aria-hidden', 'true');
    secondary.scrollTop = 0;

    primaryList?.querySelectorAll('[data-menu-section]').forEach((item) => {
      item.classList.remove('is-active');
      item.setAttribute('aria-expanded', 'false');
    });

    if (restoreFocus && previousSectionId) {
      primaryList?.querySelector(`[data-menu-section="${previousSectionId}"]`)?.focus();
    }
  }

  /* Open the root layer in its initial, primary-only state. */
  function openMarkStreetMenu() {
    if (!menuLayer || !menu) return;

    document.dispatchEvent(new CustomEvent('markstreet:menu-opening'));
    closeMenuSection({ restoreFocus: false });
    body.classList.add('menu-open');
    menuLayer.classList.add('is-open');
    menu.classList.add('is-open');
    menuLayer.setAttribute('aria-hidden', 'false');
    menuToggle?.setAttribute('aria-expanded', 'true');
    menuToggle?.setAttribute('aria-label', 'Close menu');

    requestAnimationFrame(() => {
      primaryList?.querySelector('[data-menu-section]')?.focus();
    });
  }

  /* Close the layer and fully reset expanded/active state for the next open. */
  function closeMarkStreetMenu({ restoreFocus = true } = {}) {
    if (!menuLayer || !menu) return;

    closeMenuSection({ restoreFocus: false });
    body.classList.remove('menu-open');
    menuLayer.classList.remove('is-open');
    menu.classList.remove('is-open');
    menuLayer.setAttribute('aria-hidden', 'true');
    menuToggle?.setAttribute('aria-expanded', 'false');
    menuToggle?.setAttribute('aria-label', 'Open menu');

    if (restoreFocus) menuToggle?.focus();
  }

  /* Connect rendered controls to the reusable shell once the DOM is ready. */
  function initMarkStreetMenu() {
    if (!menuLayer || !menu || !primaryList || menuData.length === 0) return;

    renderPrimaryMenu();

    menuToggle?.addEventListener('click', () => {
      if (menuLayer.classList.contains('is-open')) closeMarkStreetMenu();
      else openMarkStreetMenu();
    });

    menuLayer.querySelectorAll('[data-menu-close]').forEach((control) => {
      control.addEventListener('click', () => closeMarkStreetMenu());
    });

    primaryList.addEventListener('click', (event) => {
      const item = event.target.closest('[data-menu-section]');
      if (item) openMenuSection(item.dataset.menuSection);
    });

    menuLayer.querySelector('[data-menu-back]')?.addEventListener('click', () => {
      closeMenuSection();
    });

    secondaryList?.addEventListener('click', (event) => {
      if (event.target.closest('a')) closeMarkStreetMenu({ restoreFocus: false });
    });

    sectionLink?.addEventListener('click', () => {
      closeMarkStreetMenu({ restoreFocus: false });
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && menuLayer.classList.contains('is-open')) {
        closeMarkStreetMenu();
      }
    });

    document.addEventListener('signal-desk:opening', () => {
      if (menuLayer.classList.contains('is-open')) {
        closeMarkStreetMenu({ restoreFocus: false });
      }
    });
  }

  initMarkStreetMenu();

  /* Existing header scroll treatment (unrelated to menu rendering). */
  const setHeaderState = () => {
    if (!header) return;
    header.classList.toggle('is-scrolled', window.scrollY > 18);
  };

  setHeaderState();
  window.addEventListener('scroll', setHeaderState, { passive: true });

  /* Existing reveal-on-scroll behavior used throughout the site. */
  const revealItems = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.14, rootMargin: '0px 0px -40px 0px' });

    revealItems.forEach((item, index) => {
      item.style.transitionDelay = `${Math.min(index % 6, 5) * 80}ms`;
      observer.observe(item);
    });
  } else {
    revealItems.forEach((item) => item.classList.add('is-visible'));
  }

})();
