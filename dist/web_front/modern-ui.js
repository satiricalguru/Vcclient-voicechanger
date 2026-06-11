/**
 * Voice Changer Client — Modern Glassmorphism UI
 * Interactive settings drawer, particle background, toast system,
 * enhanced VU meter, floating status badge.
 */

(function () {
  "use strict";
  console.log("[VC] Modern UI v2 loaded.");

  // ── Theme init (prevent flash) ──────────────────────────
  const initialTheme = localStorage.getItem('vcclient-theme') || 'theme-violet';
  document.documentElement.className = initialTheme;
  document.body.className = initialTheme;

  // ── SVG Icons (Lucide-based) ────────────────────────────
  const ICONS = {
    gain:    `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="vc-icon"><path d="M12 2v20M17 5v14M22 9v6M7 8v8M2 10v4"/></svg>`,
    pitch:   `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="vc-icon"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`,
    formant: `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="vc-icon"><path d="M4 10a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2M20 10a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2M12 4v16M8 8v8M16 8v8"/></svg>`,
    noise:   `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="vc-icon"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
    chunk:   `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="vc-icon"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
    audio:   `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="vc-icon"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/></svg>`,
    analyzer:`<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="vc-icon"><path d="M3 3v18h18M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"/></svg>`,
    gear:    `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
    close:   `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`
  };

  // ── Theme definitions ────────────────────────────────────
  const THEMES = [
    { id: 'theme-violet',    name: 'Violet',    color: '#8b5cf6', bg: '#0c0c18' },
    { id: 'theme-indigo',    name: 'Indigo',    color: '#6366f1', bg: '#06060e' },
    { id: 'theme-emerald',   name: 'Emerald',   color: '#10b981', bg: '#040e0a' },
    { id: 'theme-rose',      name: 'Rose',      color: '#ec4899', bg: '#0e060a' },
    { id: 'theme-cyberpunk', name: 'Cyber',     color: '#ff007f', bg: '#06020c' },
    { id: 'theme-amber',     name: 'Amber',     color: '#f59e0b', bg: '#0a0a0f' },
    { id: 'theme-light',     name: 'Light',     color: '#6366f1', bg: '#f4f5f7' },
  ];

  // ── State ───────────────────────────────────────────────
  let isVoiceChangerActive = false;
  let initialLanguageApplied = false;
  let vuAnimationFrame = null;
  let particlesEnabled = localStorage.getItem('vc-particles') !== 'false';
  let settingsOpen = false;

  // ── React event trigger helper ──────────────────────────
  function triggerReactChange(el, value) {
    var proto = null;
    if (el instanceof HTMLSelectElement) proto = window.HTMLSelectElement.prototype;
    else if (el instanceof HTMLInputElement) proto = window.HTMLInputElement.prototype;
    else proto = window.HTMLTextAreaElement.prototype;
    var setter = Object.getOwnPropertyDescriptor(proto, 'value');
    if (setter && setter.set) {
      setter.set.call(el, value);
    } else {
      el.value = value;
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }


  // ══════════════════════════════════════════════════════════
  // TOAST NOTIFICATION SYSTEM
  // ══════════════════════════════════════════════════════════

  function ensureToastContainer() {
    let c = document.querySelector('.vc-toast-container');
    if (!c) {
      c = document.createElement('div');
      c.className = 'vc-toast-container';
      document.body.appendChild(c);
    }
    return c;
  }

  function showToast(message, icon = '✦') {
    const container = ensureToastContainer();
    const toast = document.createElement('div');
    toast.className = 'vc-toast';
    toast.innerHTML = `
      <div class="vc-toast-accent"></div>
      <span class="vc-toast-icon">${icon}</span>
      <span>${message}</span>
    `;
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast-exit');
      setTimeout(() => toast.remove(), 350);
    }, 3000);
  }


  // ══════════════════════════════════════════════════════════
  // PARTICLE BACKGROUND
  // ══════════════════════════════════════════════════════════

  let particleContainer = null;
  let particleInterval = null;

  function initParticles() {
    if (particleContainer) return;
    particleContainer = document.createElement('div');
    particleContainer.className = 'vc-particles-container';
    document.body.appendChild(particleContainer);
    spawnParticles();
  }

  function spawnParticles() {
    if (particleInterval) clearInterval(particleInterval);
    particleInterval = setInterval(() => {
      if (!particlesEnabled || !particleContainer) return;
      if (particleContainer.children.length > 30) return;

      const p = document.createElement('div');
      p.className = 'vc-particle';
      const x = Math.random() * 100;
      const size = 3 + Math.random() * 5;
      const duration = 12 + Math.random() * 20;
      const delay = Math.random() * 5;
      p.style.cssText = `
        left: ${x}%;
        width: ${size}px;
        height: ${size}px;
        animation-duration: ${duration}s;
        animation-delay: ${delay}s;
      `;
      particleContainer.appendChild(p);

      setTimeout(() => p.remove(), (duration + delay) * 1000);
    }, 1500);
  }

  function destroyParticles() {
    if (particleInterval) clearInterval(particleInterval);
    particleInterval = null;
    if (particleContainer) {
      particleContainer.remove();
      particleContainer = null;
    }
  }


  // ══════════════════════════════════════════════════════════
  // VU METER
  // ══════════════════════════════════════════════════════════

  function getVuMeterHtml(isActive) {
    const segmentCount = 20;
    const statusClass = isActive ? "status-active" : "status-standby";
    const statusText = isActive ? "ACTIVE" : "STANDBY";

    let segmentsHtml = '';
    for (let ch = 0; ch < 2; ch++) {
      let segs = '';
      for (let i = 0; i < segmentCount; i++) {
        segs += `<div class="modern-vu-segment" data-vu="${ch}-${i}"></div>`;
      }
      segmentsHtml += `<div class="modern-vu-channel">${segs}</div>`;
    }

    const dbMarks = ['+6', '0', '-6', '-12', '-18', '-24', '-30', '-∞'];
    let dbHtml = '';
    for (const db of dbMarks) {
      dbHtml += `<div class="modern-vu-db-mark">${db}</div>`;
    }

    return `
      <div class="modern-vu-container">
        <div class="modern-vu-label">LEVEL</div>
        <div class="modern-vu-meters">
          <div class="modern-vu-db-scale">${dbHtml}</div>
          ${segmentsHtml}
        </div>
        <div class="modern-vu-status ${statusClass}">${statusText}</div>
      </div>
    `;
  }

  function animateVuMeter() {
    const segs = document.querySelectorAll('.modern-vu-segment');
    if (segs.length === 0 || !isVoiceChangerActive) {
      segs.forEach(seg => { seg.className = 'modern-vu-segment'; });
      if (vuAnimationFrame) {
        cancelAnimationFrame(vuAnimationFrame);
        vuAnimationFrame = null;
      }
      return;
    }

    const now = performance.now();
    segs.forEach(seg => {
      const parts = seg.dataset.vu.split('-');
      const ch = parseInt(parts[0]);
      const idx = parseInt(parts[1]);
      const total = 20;

      const baseLevel = 12 + Math.sin(now / 400 + ch * 2) * 5;
      const jitter = Math.sin(now / 80 + idx * 3 + ch * 7) * 2;
      const level = Math.max(0, Math.min(total, baseLevel + jitter));
      const threshold = total - idx - 1;

      if (threshold < level) {
        if (idx >= total - 3) {
          seg.className = 'modern-vu-segment lit-red';
        } else if (idx >= total - 7) {
          seg.className = 'modern-vu-segment lit-amber';
        } else {
          seg.className = 'modern-vu-segment lit-green';
        }
      } else {
        seg.className = 'modern-vu-segment';
      }
    });

    vuAnimationFrame = requestAnimationFrame(animateVuMeter);
  }

  function startVuAnimation() {
    if (vuAnimationFrame) cancelAnimationFrame(vuAnimationFrame);
    vuAnimationFrame = requestAnimationFrame(animateVuMeter);
  }

  function stopVuAnimation() {
    if (vuAnimationFrame) {
      cancelAnimationFrame(vuAnimationFrame);
      vuAnimationFrame = null;
    }
    const segs = document.querySelectorAll('.modern-vu-segment');
    segs.forEach(seg => { seg.className = 'modern-vu-segment'; });
  }


  // ══════════════════════════════════════════════════════════
  // INTERACTIVE SETTINGS DRAWER
  // ══════════════════════════════════════════════════════════

  function openSettings() {
    if (settingsOpen) return;
    settingsOpen = true;

    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'vc-settings-overlay active';
    overlay.addEventListener('click', closeSettings);
    document.body.appendChild(overlay);

    // Create drawer
    const drawer = document.createElement('div');
    drawer.className = 'vc-settings-drawer';
    drawer.id = 'vc-settings-drawer';

    const currentTheme = localStorage.getItem('vcclient-theme') || 'theme-violet';
    const currentLang = localStorage.getItem('vcclient-lang') || 'en';
    const particlesOn = localStorage.getItem('vc-particles') !== 'false';

    // Build theme swatches
    let swatchesHtml = '';
    THEMES.forEach(t => {
      const isActive = currentTheme === t.id;
      swatchesHtml += `
        <div class="vc-theme-swatch ${isActive ? 'active' : ''}" 
             data-theme="${t.id}" 
             style="background: ${t.bg}; color: ${t.color};"
             title="${t.name}">
          <div class="vc-theme-swatch-dot" style="background: ${t.color};"></div>
          <div class="vc-theme-swatch-name">${t.name}</div>
        </div>
      `;
    });

    drawer.innerHTML = `
      <div class="vc-settings-header">
        <div class="vc-settings-title">⚙ Settings</div>
        <div class="vc-settings-close" id="vc-settings-close-btn">${ICONS.close}</div>
      </div>
      <div class="vc-settings-body">

        <div class="vc-settings-section">
          <div class="vc-settings-section-title">Appearance</div>
          <div class="vc-theme-grid" id="vc-theme-grid">
            ${swatchesHtml}
          </div>
        </div>

        <div class="vc-settings-section">
          <div class="vc-settings-section-title">Language</div>
          <div class="vc-settings-row">
            <div>
              <div class="vc-settings-row-label">Interface Language</div>
              <div class="vc-settings-row-desc">Change app display language</div>
            </div>
            <select id="vc-drawer-lang" class="theme-select-dropdown" style="min-width:120px;">
              <option value="en" ${currentLang === 'en' ? 'selected' : ''}>English</option>
              <option value="ja" ${currentLang === 'ja' ? 'selected' : ''}>日本語</option>
              <option value="zh" ${currentLang === 'zh' ? 'selected' : ''}>简体中文</option>
            </select>
          </div>
        </div>

        <div class="vc-settings-section">
          <div class="vc-settings-section-title">Effects</div>
          <div class="vc-settings-row">
            <div>
              <div class="vc-settings-row-label">Background Particles</div>
              <div class="vc-settings-row-desc">Floating particle effects</div>
            </div>
            <div class="vc-toggle ${particlesOn ? 'active' : ''}" id="vc-particles-toggle"></div>
          </div>
        </div>

        <div class="vc-settings-section" style="margin-top:auto; padding-top:12px; border-top:1px solid var(--border-subtle);">
          <div style="font-family:var(--font-mono); font-size:0.5rem; color:var(--text-dim); letter-spacing:0.06em; text-align:center; opacity:0.5;">
            Voice Changer Client • Modern UI v2
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(drawer);

    // Wire up close button
    document.getElementById('vc-settings-close-btn').addEventListener('click', closeSettings);

    // Wire up theme swatches
    document.getElementById('vc-theme-grid').addEventListener('click', (e) => {
      const swatch = e.target.closest('.vc-theme-swatch');
      if (!swatch) return;
      const newTheme = swatch.dataset.theme;
      localStorage.setItem('vcclient-theme', newTheme);
      document.documentElement.className = newTheme;
      document.body.className = newTheme;

      // Update active state
      document.querySelectorAll('.vc-theme-swatch').forEach(s => s.classList.remove('active'));
      swatch.classList.add('active');

      const themeName = THEMES.find(t => t.id === newTheme)?.name || newTheme;
      showToast(`Theme: ${themeName}`, '🎨');
    });

    // Wire up language selector
    document.getElementById('vc-drawer-lang').addEventListener('change', (e) => {
      const newLang = e.target.value;
      localStorage.setItem('vcclient-lang', newLang);
      localStorage.setItem('i18nextLng', newLang);
      const orig = document.querySelector('select[class*="_1fwpqca6"]');
      if (orig) {
        triggerReactChange(orig, newLang);
      }
      showToast('Language updated — reloading...', '🌐');
      setTimeout(() => location.reload(), 800);
    });

    // Wire up particles toggle
    document.getElementById('vc-particles-toggle').addEventListener('click', function() {
      this.classList.toggle('active');
      particlesEnabled = this.classList.contains('active');
      localStorage.setItem('vc-particles', particlesEnabled);
      if (particlesEnabled) {
        initParticles();
        showToast('Particles enabled', '✨');
      } else {
        destroyParticles();
        showToast('Particles disabled', '✨');
      }
    });

    // Close on Escape key
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        closeSettings();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);
  }

  function closeSettings() {
    settingsOpen = false;
    const drawer = document.getElementById('vc-settings-drawer');
    const overlay = document.querySelector('.vc-settings-overlay');

    if (drawer) {
      drawer.classList.add('closing');
      setTimeout(() => drawer.remove(), 350);
    }
    if (overlay) {
      overlay.style.opacity = '0';
      setTimeout(() => overlay.remove(), 350);
    }
  }


  // ══════════════════════════════════════════════════════════
  // FLOATING UI ELEMENTS
  // ══════════════════════════════════════════════════════════

  function injectFloatingUI() {
    // Settings gear button
    if (!document.querySelector('.vc-gear-btn')) {
      const gear = document.createElement('div');
      gear.className = 'vc-gear-btn';
      gear.innerHTML = ICONS.gear;
      gear.title = 'Settings';
      gear.addEventListener('click', openSettings);
      document.body.appendChild(gear);
    }

    // Status badge
    if (!document.querySelector('.vc-status-badge')) {
      const badge = document.createElement('div');
      badge.className = 'vc-status-badge';
      badge.innerHTML = `
        <div class="vc-status-dot"></div>
        <span class="vc-status-text">STANDBY</span>
      `;
      document.body.appendChild(badge);
    }
  }

  function updateStatusBadge() {
    const badge = document.querySelector('.vc-status-badge');
    if (!badge) return;

    const textEl = badge.querySelector('.vc-status-text');
    if (isVoiceChangerActive) {
      badge.classList.add('active');
      if (textEl) textEl.textContent = 'ACTIVE';
    } else {
      badge.classList.remove('active');
      if (textEl) textEl.textContent = 'STANDBY';
    }
  }


  // ══════════════════════════════════════════════════════════
  // INJECTED STYLES
  // ══════════════════════════════════════════════════════════

  const styleEl = document.createElement("style");
  styleEl.innerHTML = `
    .vc-icon {
      vertical-align: middle;
      margin-right: 5px;
      opacity: 0.6;
      color: var(--text-dim);
    }
  `;
  document.head.appendChild(styleEl);


  // ══════════════════════════════════════════════════════════
  // DEBOUNCE HELPER
  // ══════════════════════════════════════════════════════════

  let debounceTimer = null;
  function debouncedUpdate() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => updateDOM(), 100);
  }


  // ══════════════════════════════════════════════════════════
  // HELPERS
  // ══════════════════════════════════════════════════════════

  function findMoreActionsContainer() {
    const containers = document.querySelectorAll('div[class*="c6o5vrh"]');
    for (const container of containers) {
      const buttons = container.querySelectorAll('div[class*="c6o5vrj"]');
      if (buttons.length >= 3) {
        for (const btn of buttons) {
          const text = btn.textContent.toLowerCase().trim();
          if (text.includes('setting') || text.includes('設定') || text.includes('设置') || text.includes('settings')) {
            return container;
          }
        }
      }
    }
    return null;
  }

  function findAdvancedSettingButton() {
    const container = findMoreActionsContainer();
    if (container) {
      const elements = container.querySelectorAll('div, button');
      for (let el of elements) {
        const text = el.textContent.trim();
        if (text.includes("Setting") || text.includes("設定") || text.includes("设置")) {
          return el;
        }
      }
    }
    const all = document.querySelectorAll('div, button, a, span');
    for (const el of all) {
      if (el.textContent.trim().toLowerCase().includes("advanced setting")) {
        if (el.querySelectorAll('*').length < 10) return el;
      }
    }
    return null;
  }

  function findOriginalResetButton() {
    const header = document.querySelector('div[class*="_1fwpqca0"]');
    if (!header) return null;
    const buttons = header.querySelectorAll('button');
    for (const btn of buttons) {
      if (btn.classList.contains('vc-header-btn')) continue;
      const text = btn.textContent.toLowerCase().trim();
      if (text === 'initialize' || text === '初期化' || text === '初始化' || text === 'reset') {
        return btn;
      }
    }
    return null;
  }


  // ══════════════════════════════════════════════════════════
  // HEADER CONTROLS
  // ══════════════════════════════════════════════════════════

  function handleHeaderControls() {
    const header = document.querySelector('div[class*="_1fwpqca0"]');
    if (!header) return;

    // Hide language dropdown and its label
    const langSelect = header.querySelector('select');
    if (langSelect) {
      langSelect.style.setProperty('display', 'none', 'important');
    }
    const allLabels = header.querySelectorAll('span, div');
    allLabels.forEach(el => {
      if (el.textContent.trim().toLowerCase().includes('language:')) {
        el.style.setProperty('display', 'none', 'important');
      }
    });

    // Hide icon links row
    const iconRow = header.querySelector('div[class*="_1fwpqca4"]');
    if (iconRow) {
      iconRow.style.setProperty('display', 'none', 'important');
    }

    // Hide "dml" tooltip
    const allSpans = header.querySelectorAll('span, div, p');
    allSpans.forEach(el => {
      if (el.textContent.trim() === 'dml') {
        el.style.setProperty('display', 'none', 'important');
      }
    });

    // Hide "MORE...::" section
    const configGrid = document.querySelector('div.c6o5vr0');
    if (configGrid) {
      Array.from(configGrid.children).forEach(card => {
        const firstChild = card.querySelector('div');
        if (firstChild && /^more\.\.\./i.test(firstChild.textContent.trim())) {
          card.style.setProperty('display', 'none', 'important');
        }
      });
    }

    // Hide original buttons
    const buttons = header.querySelectorAll('button');
    buttons.forEach(btn => {
      if (btn.classList.contains('vc-header-btn')) {
        btn.remove();
        return;
      }
      const text = btn.textContent.toLowerCase().trim();
      if (text.includes('dark') || text.includes('light') || text.includes('暗') || text.includes('明') ||
          text === 'initialize' || text === '初期化' || text === '初始化' || text === 'reset') {
        btn.style.setProperty('display', 'none', 'important');
      }
    });
  }


  // ══════════════════════════════════════════════════════════
  // MOVE BUTTONS TO MENUBAR
  // ══════════════════════════════════════════════════════════

  function moveButtonsToMenubar() {
    let header = document.querySelector('div[class*="_1fwpqca0"]');
    if (!header) return;
    if (header.querySelector('.vc-menubar')) return;

    const btnContainer = findMoreActionsContainer();
    if (!btnContainer) return;

    const buttons = btnContainer.querySelectorAll('div[class*="c6o5vrj"]');
    if (buttons.length === 0) return;

    const menubar = document.createElement('div');
    menubar.className = 'vc-menubar';

    const lbl = document.createElement('span');
    lbl.className = 'vc-menubar-label';
    lbl.textContent = 'MENU';
    menubar.appendChild(lbl);

    buttons.forEach((btn, index) => {
      const clone = btn.cloneNode(true);
      clone.className = 'vc-menubar-btn';
      clone.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const currentContainer = findMoreActionsContainer();
        if (currentContainer) {
          const currentButtons = currentContainer.querySelectorAll('div[class*="c6o5vrj"]');
          const currentBtn = currentButtons[index];
          if (currentBtn) {
            currentBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
          }
        }
      });
      menubar.appendChild(clone);
    });

    // Reset button
    const origReset = findOriginalResetButton();
    if (origReset) {
      const resetMenuBtn = document.createElement('div');
      resetMenuBtn.className = 'vc-menubar-btn vc-menubar-reset-btn';
      resetMenuBtn.textContent = 'Reset';
      resetMenuBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const currentReset = findOriginalResetButton();
        if (currentReset) {
          currentReset.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        }
      });
      menubar.appendChild(resetMenuBtn);
    }

    header.appendChild(menubar);

    btnContainer.style.setProperty('display', 'none', 'important');
    const moreSection = btnContainer.closest('div[class*="c6o5vrg"]');
    if (moreSection) {
      moreSection.style.setProperty('display', 'none', 'important');
      let card = moreSection.parentElement;
      if (card) {
        card.style.setProperty('display', 'none', 'important');
      }
    }
  }


  // ══════════════════════════════════════════════════════════
  // SETTINGS MODAL (injected into original modal)
  // ══════════════════════════════════════════════════════════

  // Advanced Settings Modal theme/lang customization removed per user request


  // ══════════════════════════════════════════════════════════
  // DOM UPDATE LOOP
  // ══════════════════════════════════════════════════════════

  function updateDOM() {
    handleHeaderControls();
    moveButtonsToMenubar();

    if (!initialLanguageApplied) {
      const savedLang = localStorage.getItem('vcclient-lang') || 'en';
      localStorage.setItem('i18nextLng', savedLang);
      const originalLangSelect = document.querySelector('select[class*="_1fwpqca6"]');
      if (originalLangSelect) {
        if (originalLangSelect.value !== savedLang) {
          triggerReactChange(originalLangSelect, savedLang);
        }
        initialLanguageApplied = true;
      }
    }

    // handleAdvancedSettingsModal();

    // ── VU Meter Visualizer (Disabled per user request to display model image instead) ──
    // const avatarCanvas = document.querySelector('canvas[class*="_1v4ujr5d"]');
    // const avatarWrapper = document.querySelector('div[class*="_1v4ujr5c"]');
    // 
    // if (avatarWrapper) {
    //   if (avatarCanvas) avatarCanvas.style.display = "none";
    // 
    //   let vu = avatarWrapper.querySelector(".modern-vu-container");
    //   if (!vu) {
    //     avatarWrapper.insertAdjacentHTML("beforeend", getVuMeterHtml(isVoiceChangerActive));
    //     if (isVoiceChangerActive) startVuAnimation();
    //   } else {
    //     const statusEl = vu.querySelector('.modern-vu-status');
    //     if (statusEl) {
    //       statusEl.className = 'modern-vu-status status-' + (isVoiceChangerActive ? 'active' : 'standby');
    //       statusEl.textContent = isVoiceChangerActive ? 'ACTIVE' : 'STANDBY';
    //     }
    //   }
    // }

    // ── Icons on labels ──────────────────────────────────
    const labels = document.querySelectorAll(
      'div[class*="_1v4ujr5l"], div[class*="_1v4ujr53"], div[class*="c6o5vr5"], div[class*="c6o5vr6"], div[class*="c6o5vr7"], div[class*="c6o5vr8"], div[class*="c6o5vr9"]'
    );
    labels.forEach(label => {
      if (label.querySelector(".vc-icon")) return;
      const text = label.textContent.trim().toLowerCase();
      if (text.includes("gain") || text.includes("ゲイン") || text.includes("增益"))       label.insertAdjacentHTML("afterbegin", ICONS.gain);
      else if (text.includes("pitch") || text.includes("ピッチ") || text.includes("音高"))   label.insertAdjacentHTML("afterbegin", ICONS.pitch);
      else if (text.includes("formant") || text.includes("フォルマント") || text.includes("共振峰")) label.insertAdjacentHTML("afterbegin", ICONS.formant);
      else if (text.includes("noise") || text.includes("ノイズ") || text.includes("噪"))   label.insertAdjacentHTML("afterbegin", ICONS.noise);
      else if (text.includes("chunk") || text.includes("チャンク") || text.includes("分块"))   label.insertAdjacentHTML("afterbegin", ICONS.chunk);
      else if (text.includes("audio") || text.includes("オーディオ") || text.includes("音频") || text.includes("音量"))   label.insertAdjacentHTML("afterbegin", ICONS.audio);
      else if (text.includes("analyzer") || text.includes("アナライザー") || text.includes("分析"))label.insertAdjacentHTML("afterbegin", ICONS.analyzer);
    });

    // ── Detect active state ──────────────────────────────
    const startActive = document.querySelector('div[class*="_1v4ujr5q"]');
    const isNowActive = !!startActive;

    if (isNowActive !== isVoiceChangerActive) {
      isVoiceChangerActive = isNowActive;

      if (isVoiceChangerActive) {
        startVuAnimation();
        showToast('Voice changer activated', '🎙️');
      } else {
        stopVuAnimation();
        showToast('Voice changer deactivated', '⏹️');
      }

      const detailPanel = document.querySelector('div[class*="_1v4ujr50"]');
      if (detailPanel) {
        detailPanel.classList.toggle("voice-changer-active", isVoiceChangerActive);
      }
    }

    // ── Update status badge ──────────────────────────────
    updateStatusBadge();

    // ── Inject floating UI ───────────────────────────────
    injectFloatingUI();
  }


  // ══════════════════════════════════════════════════════════
  // INITIALIZATION
  // ══════════════════════════════════════════════════════════

  // Start particles if enabled
  if (particlesEnabled) {
    initParticles();
  }

  // Observer
  const observer = new MutationObserver(() => debouncedUpdate());
  observer.observe(document.body, { childList: true, subtree: true });

  window.addEventListener("DOMContentLoaded", () => updateDOM());
  setInterval(updateDOM, 1000);
})();
