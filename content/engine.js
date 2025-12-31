/**
 * Smart Dark Mode - Content Script (The Muscle)
 * DEBUG MODE ENABLED
 */

// IMMEDIATE: Prevent flash of white by hiding page until dark mode ready
(function () {
    const html = document.documentElement;
    html.setAttribute('data-sdm-loading', 'true');
    const preloadStyle = document.createElement('style');
    preloadStyle.id = 'sdm-preload';
    preloadStyle.textContent = `
    html[data-sdm-loading="true"] {
      background: #1a1a1a !important;
      visibility: hidden;
    }
  `;
    (document.head || document.documentElement).appendChild(preloadStyle);
})();

const DEBUG = true;
function log(...args) { if (DEBUG) console.log('[ENGINE]', ...args); }
function logError(...args) { console.error('[ENGINE ERROR]', ...args); }

const DEFAULT_PROFILE = {
    brightness: 100,
    contrast: 100,
    sepia: 0,
    grayscale: 0
};

const ENGINE = {
    // Received state from Brain
    state: null,

    // Local detection cache (per-tab)
    nativeDarkCache: null,

    // Render scheduling
    pendingRender: false,
    observersAttached: false,
    mutationObserver: null,

    // ==================== INITIALIZATION ====================
    init() {
        log('init() called on', location.hostname);

        // 1. Message Listener
        chrome.runtime.onMessage.addListener((request) => {
            log('Message received:', request.type);
            if (request.type === 'state_update') {
                this.onStateReceived(request.data);
            }
        });

        // 2. Pull Points
        document.addEventListener('visibilitychange', () => {
            log('visibilitychange, hidden:', document.hidden);
            if (!document.hidden && this.isContextValid()) {
                this.requestState();
            }
        });

        window.addEventListener('pageshow', (event) => {
            log('pageshow, persisted:', event.persisted);
            if (event.persisted && this.isContextValid()) {
                // BFCache restore
                this.requestState();
            }
        });

        // 3. Initial Pull
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.onDomReady());
        } else {
            this.onDomReady();
        }
    },

    onDomReady() {
        log('onDomReady() - requesting state');
        this.requestState();
    },

    // ==================== STATE HANDLING ====================
    onStateReceived(data) {
        log('onStateReceived():', data);
        this.state = data;
        this.scheduleRender();
    },

    requestState() {
        if (!this.isContextValid()) {
            log('requestState() - context invalid, skipping');
            return;
        }
        log('requestState() - sending req_state');
        try {
            chrome.runtime.sendMessage({ type: 'req_state' }).catch((e) => {
                logError('requestState failed:', e);
            });
        } catch (e) {
            logError('requestState exception:', e);
        }
    },

    isContextValid() {
        const valid = chrome.runtime && !!chrome.runtime.id;
        if (!valid) log('Context invalid!');
        return valid;
    },

    // ==================== RENDER PIPELINE ====================
    scheduleRender() {
        if (this.pendingRender) return;
        this.pendingRender = true;

        requestAnimationFrame(() => {
            try {
                this.executeRenderPipeline();
            } catch (e) {
                this.failureCleanup();
            }
            this.pendingRender = false;
        });
    },

    executeRenderPipeline() {
        // Remove loading state immediately
        document.documentElement.removeAttribute('data-sdm-loading');

        if (!this.state) {
            log('No state, skipping render');
            return;
        }
        log('executeRenderPipeline() mode:', this.state.mode, 'profile:', this.state.renderProfile);

        // STEP 1: Disable Short-Circuit
        if (this.state.mode === 'disable' || this.state.sitePolicy === 'force-off') {
            log('Disable mode - hard off');
            this.hardOff();
            return;
        }

        // STEP 2: Native Dark Detection
        const nativeDark = this.detectNativeDark();
        log('nativeDark:', nativeDark);

        // Get profile from state (preset values or manual values)
        const profile = this.state.renderProfile || DEFAULT_PROFILE;
        log('Using profile:', profile);

        // AUTO MODE: Apply preset or default if no preset selected
        if (this.state.mode === 'auto') {
            if (nativeDark) {
                log('Auto: Native dark detected, applying filters only');
                this.applyFiltersOnly(profile);
            } else {
                log('Auto: Light site, applying inversion + filters');
                this.applyInversion(profile);
            }
            return;
        }

        // MANUAL MODE: Apply user's universal settings
        if (this.state.mode === 'manual') {
            if (nativeDark) {
                log('Manual: Native dark, filters only');
                this.applyFiltersOnly(profile);
            } else {
                log('Manual: Light site, inversion + filters');
                this.applyInversion(profile);
            }
        }
    },

    applyInversion(profile) {
        const html = document.documentElement;
        html.setAttribute('data-sdm-enabled', 'true');
        html.setAttribute('data-sdm-native-dark', 'false');
        this.applyFilters(profile);
        this.attachObserversIfNeeded();
    },

    applyFiltersOnly(profile) {
        const html = document.documentElement;
        html.setAttribute('data-sdm-enabled', 'true');
        html.setAttribute('data-sdm-native-dark', 'true');
        this.applyFilters(profile);
        this.attachObserversIfNeeded();
    },

    applyFilters(profile) {
        const html = document.documentElement;
        html.style.setProperty('--sdm-brightness', `${profile.brightness || 100}%`);
        html.style.setProperty('--sdm-contrast', `${profile.contrast || 100}%`);
        html.style.setProperty('--sdm-sepia', `${profile.sepia || 0}%`);
        html.style.setProperty('--sdm-grayscale', `${profile.grayscale || 0}%`);
        html.style.setProperty('--sdm-blue-filter', `${profile.blueFilter || 0}%`);
        html.style.setProperty('--sdm-blue-filter-raw', profile.blueFilter || 0);
    },

    attachObserversIfNeeded() {
        if (!this.observersAttached) {
            this.attachObservers();
            this.observersAttached = true;
        }
    },

    hardOff() {
        // True disable: No CSS, no observers
        const html = document.documentElement;
        html.removeAttribute('data-sdm-enabled');
        html.removeAttribute('data-sdm-native-dark');
        html.removeAttribute('data-sdm-loading');
        html.style.removeProperty('--sdm-brightness');
        html.style.removeProperty('--sdm-contrast');
        html.style.removeProperty('--sdm-sepia');
        html.style.removeProperty('--sdm-grayscale');
        html.style.removeProperty('--sdm-blue-filter');

        // Remove preload style
        const preloadStyle = document.getElementById('sdm-preload');
        if (preloadStyle) preloadStyle.remove();

        // Detach observers
        if (this.mutationObserver) {
            this.mutationObserver.disconnect();
            this.mutationObserver = null;
            this.observersAttached = false;
        }
    },

    failureCleanup() {
        this.hardOff();
    },

    // ==================== NATIVE DARK DETECTION ====================
    detectNativeDark() {
        // Check cache first
        const hostname = window.location.hostname;
        const cacheKey = `sdm_native_${hostname}`;
        const cached = sessionStorage.getItem(cacheKey);
        if (cached !== null) {
            return cached === 'true';
        }

        // Perform bounded detection
        const result = this.isNativeDarkMode();
        sessionStorage.setItem(cacheKey, result ? 'true' : 'false');
        return result;
    },

    isNativeDarkMode() {
        const doc = document.documentElement;

        // 1. Color Scheme
        const colorScheme = getComputedStyle(doc).colorScheme;
        if (colorScheme === 'dark') return true;

        // 2. Common Attributes (bounded check)
        const htmlClass = (doc.getAttribute('class') || '').toLowerCase();
        const htmlTheme = (doc.getAttribute('data-theme') || '').toLowerCase();
        const bodyClass = document.body ? (document.body.getAttribute('class') || '').toLowerCase() : '';

        const darkKeywords = ['dark', 'night', 'black'];
        const hasDarkKeyword = (str) => darkKeywords.some(k => str.includes(k) && !str.includes('light'));

        if (hasDarkKeyword(htmlClass) || hasDarkKeyword(htmlTheme) || hasDarkKeyword(bodyClass)) {
            return this.checkBrightness(doc) < 128;
        }

        // 3. Background Brightness
        if (this.checkBrightness(doc) < 50) return true;
        if (document.body && this.checkBrightness(document.body) < 50) return true;

        return false;
    },

    checkBrightness(el) {
        if (!el) return 255;
        const bg = getComputedStyle(el).backgroundColor;
        const rgba = bg.match(/\d+/g);
        if (!rgba) return 255;
        const r = +rgba[0], g = +rgba[1], b = +rgba[2];
        const a = rgba[3] ? +rgba[3] : 1;
        if (a === 0) return 255;
        return (r * 299 + g * 587 + b * 114) / 1000;
    },

    invalidateNativeDarkCache() {
        const hostname = window.location.hostname;
        sessionStorage.removeItem(`sdm_native_${hostname}`);
        this.nativeDarkCache = null;
    },

    // ==================== OBSERVERS ====================
    attachObservers() {
        let timeout;
        this.mutationObserver = new MutationObserver((mutations) => {
            // Debounce
            if (timeout) clearTimeout(timeout);
            timeout = setTimeout(() => {
                const relevant = mutations.some(m =>
                    m.type === 'attributes' &&
                    ['class', 'data-theme', 'style'].includes(m.attributeName)
                );
                if (relevant) {
                    this.invalidateNativeDarkCache();
                    this.scheduleRender();
                }
            }, 300);
        });

        this.mutationObserver.observe(document.documentElement, { attributes: true });
        if (document.body) {
            this.mutationObserver.observe(document.body, { attributes: true });
        }

        // prefers-color-scheme listener
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
            this.invalidateNativeDarkCache();
            this.scheduleRender();
        });
    }
};

ENGINE.init();
