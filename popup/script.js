/**
 * MoonEye - Popup Controller
 */

const DEBUG = false;
function log(...args) { if (DEBUG) console.log('[POPUP]', ...args); }

const UI = {
    powerToggle: document.getElementById('power-toggle'),
    statusLabel: document.getElementById('status-label'),
    siteLabel: document.getElementById('site-label'),
    presetsSection: document.getElementById('presets-section'),
    btns: { auto: document.getElementById('btn-auto'), manual: document.getElementById('btn-manual') },
    presets: { bw: document.getElementById('preset-bw'), bluelight: document.getElementById('preset-bluelight'), midnight: document.getElementById('preset-midnight') },
    controls: document.getElementById('controls'),
    inputs: { brightness: document.getElementById('brightness'), contrast: document.getElementById('contrast'), sepia: document.getElementById('sepia'), grayscale: document.getElementById('grayscale') },
    vals: { brightness: document.getElementById('brightness-val'), contrast: document.getElementById('contrast-val'), sepia: document.getElementById('sepia-val'), grayscale: document.getElementById('grayscale-val') },
    bluelight: document.getElementById('bluelight'),
    bluelightVal: document.getElementById('bluelight-val'),
    whitelist: document.getElementById('btn-whitelist'),
    statTime: document.getElementById('stat-time'),
    statSites: document.getElementById('stat-sites'),
    btnReset: document.getElementById('btn-reset'),
    btnSchedule: document.getElementById('btn-schedule'),
    btnSettings: document.getElementById('btn-settings')
};

const PRESETS = {
    bw: { brightness: 100, contrast: 110, sepia: 0, grayscale: 100 },
    bluelight: { brightness: 95, contrast: 100, sepia: 30, grayscale: 0 },
    midnight: { brightness: 85, contrast: 100, sepia: 20, grayscale: 50 }
};

let currentHostname = '';
let isEnabled = true;
let currentMode = 'auto';
let currentPreset = 'bluelight';
let isWhitelisted = false;

document.addEventListener('DOMContentLoaded', init);

async function init() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.url && !tab.url.startsWith('chrome://')) {
            currentHostname = new URL(tab.url).hostname.replace(/^www\./, '').replace(/^m\./, '');
            UI.siteLabel.textContent = currentHostname;
        } else {
            UI.siteLabel.textContent = 'System Page';
            UI.powerToggle.disabled = true;
            return;
        }
        await loadState();
        await loadStats();
        attachListeners();
    } catch (e) { log('init error:', e); }
}

function attachListeners() {
    UI.powerToggle?.addEventListener('click', togglePower);
    UI.btns.auto?.addEventListener('click', () => setMode('auto'));
    UI.btns.manual?.addEventListener('click', () => setMode('manual'));
    Object.entries(UI.presets).forEach(([k, btn]) => btn?.addEventListener('click', () => applyPreset(k)));
    Object.values(UI.inputs).forEach(el => {
        el?.addEventListener('input', (e) => { handleInput(); updateSliderFill(e.target); });
        if (el) updateSliderFill(el);
    });
    UI.bluelight?.addEventListener('input', (e) => {
        UI.bluelightVal.textContent = `${e.target.value}%`;
        updateSliderFill(e.target, '#fb923c');
        chrome.storage.sync.set({ blue_filter: parseInt(e.target.value) });
        requestUpdate();
    });
    if (UI.bluelight) updateSliderFill(UI.bluelight, '#fb923c');
    UI.whitelist?.addEventListener('click', toggleWhitelist);
    UI.btnReset?.addEventListener('click', resetSettings);
    UI.btnSchedule?.addEventListener('click', () => alert('Schedule coming soon!'));
    UI.btnSettings?.addEventListener('click', () => alert('Settings coming soon!'));
}

function applyPreset(key) {
    currentPreset = key;
    Object.values(UI.presets).forEach(btn => btn?.classList.remove('active'));
    UI.presets[key]?.classList.add('active');
    updateInputs(PRESETS[key]);
    chrome.storage.sync.set({ auto_preset: key, manual_settings: PRESETS[key] });
    requestUpdate();
}

function updateSliderFill(input, color = '#22c55e') {
    const pct = ((input.value - input.min) / (input.max - input.min)) * 100;
    input.style.background = `linear-gradient(to right, ${color} ${pct}%, rgba(255,255,255,0.15) ${pct}%)`;
}

async function toggleWhitelist() {
    isWhitelisted = !isWhitelisted;
    await chrome.storage.sync.set({ [`site_${currentHostname}`]: { disabled: isWhitelisted } });
    UI.whitelist?.classList.toggle('active', isWhitelisted);
    UI.whitelist.textContent = isWhitelisted ? 'Whitelisted' : 'Whitelist';
    requestUpdate();
}

function resetSettings() {
    applyPreset('bluelight');
    if (UI.bluelight) { UI.bluelight.value = 0; UI.bluelightVal.textContent = '0%'; updateSliderFill(UI.bluelight, '#fb923c'); }
    chrome.storage.sync.set({ blue_filter: 0 });
    requestUpdate();
}

async function loadStats() {
    const s = await chrome.storage.sync.get(['stats_time', 'stats_sites']);
    UI.statTime.textContent = (s.stats_time || 0) >= 60 ? `${Math.floor(s.stats_time / 60)}h` : `${s.stats_time || 0}m`;
    UI.statSites.textContent = s.stats_sites || 0;
}

async function loadState() {
    const s = await chrome.storage.sync.get(['global_mode', `site_${currentHostname}`, 'enabled', 'manual_settings', 'auto_preset', 'blue_filter']);
    isEnabled = s.enabled !== false;
    currentMode = s.global_mode || 'auto';
    isWhitelisted = s[`site_${currentHostname}`]?.disabled === true;
    const preset = s.auto_preset || 'bluelight';
    const blueFilter = s.blue_filter || 0;

    updatePowerUI();
    updateModeUI(currentMode);
    UI.whitelist?.classList.toggle('active', isWhitelisted);
    UI.whitelist.textContent = isWhitelisted ? 'Whitelisted' : 'Whitelist';

    if (UI.bluelight) { UI.bluelight.value = blueFilter; UI.bluelightVal.textContent = `${blueFilter}%`; updateSliderFill(UI.bluelight, '#fb923c'); }

    if (currentMode === 'auto') {
        currentPreset = preset;
        Object.values(UI.presets).forEach(btn => btn?.classList.remove('active'));
        UI.presets[preset]?.classList.add('active');
        updateInputs(PRESETS[preset] || PRESETS.bluelight);
    } else {
        updateInputs(s.manual_settings || PRESETS.bluelight);
    }
    updateLabels();

    // Track site
    if (!s[`site_${currentHostname}`]?.tracked) {
        const stats = await chrome.storage.sync.get(['stats_sites']);
        const sites = (stats.stats_sites || 0) + 1;
        await chrome.storage.sync.set({ [`site_${currentHostname}`]: { ...s[`site_${currentHostname}`], tracked: true }, stats_sites: sites });
        UI.statSites.textContent = sites;
    }
}

function togglePower() {
    isEnabled = !isEnabled;
    chrome.storage.sync.set({ enabled: isEnabled });
    updatePowerUI();
    requestUpdate();
}

function updatePowerUI() {
    UI.powerToggle?.classList.toggle('active', isEnabled);
    UI.statusLabel.textContent = isEnabled ? '●' : '○';
    UI.statusLabel.style.color = isEnabled ? '#22c55e' : '#6b7280';
}

function setMode(mode) {
    currentMode = mode;
    chrome.storage.sync.set({ global_mode: mode });
    updateModeUI(mode);
    requestUpdate();
}

function updateModeUI(mode) {
    Object.values(UI.btns).forEach(btn => btn?.classList.remove('active'));
    UI.btns[mode]?.classList.add('active');
    UI.presetsSection?.classList.toggle('hidden', mode !== 'auto');
    UI.controls?.classList.toggle('hidden', mode !== 'manual');
}

function handleInput() {
    updateLabels();
    if (currentMode === 'manual') {
        chrome.storage.sync.set({ manual_settings: getValues() });
        requestUpdate();
    }
}

function updateInputs(v) {
    if (v.brightness != null && UI.inputs.brightness) { UI.inputs.brightness.value = v.brightness; updateSliderFill(UI.inputs.brightness); }
    if (v.contrast != null && UI.inputs.contrast) { UI.inputs.contrast.value = v.contrast; updateSliderFill(UI.inputs.contrast); }
    if (v.sepia != null && UI.inputs.sepia) { UI.inputs.sepia.value = v.sepia; updateSliderFill(UI.inputs.sepia); }
    if (v.grayscale != null && UI.inputs.grayscale) { UI.inputs.grayscale.value = v.grayscale; updateSliderFill(UI.inputs.grayscale); }
}

function updateLabels() {
    if (UI.vals.brightness) UI.vals.brightness.textContent = `${UI.inputs.brightness?.value || 100}%`;
    if (UI.vals.contrast) UI.vals.contrast.textContent = `${UI.inputs.contrast?.value || 100}%`;
    if (UI.vals.sepia) UI.vals.sepia.textContent = `${UI.inputs.sepia?.value || 0}%`;
    if (UI.vals.grayscale) UI.vals.grayscale.textContent = `${UI.inputs.grayscale?.value || 0}%`;
}

function getValues() {
    return {
        brightness: parseInt(UI.inputs.brightness?.value || 100),
        contrast: parseInt(UI.inputs.contrast?.value || 100),
        sepia: parseInt(UI.inputs.sepia?.value || 0),
        grayscale: parseInt(UI.inputs.grayscale?.value || 0)
    };
}

function requestUpdate() {
    chrome.runtime.sendMessage({
        type: 'req_update',
        data: { mode: isWhitelisted ? 'disable' : currentMode, values: getValues(), scope: currentHostname, enabled: isEnabled }
    }).catch(() => { });
}
