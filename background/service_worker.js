/**
 * Smart Dark Mode - Service Worker (The Brain)
 * DEBUG MODE ENABLED
 */

const DEBUG = true;
function log(...args) { if (DEBUG) console.log('[SW]', ...args); }
function logError(...args) { console.error('[SW ERROR]', ...args); }

// ==================== CONFIGURATION ====================
// Default: Blue Light preset
const DEFAULT_PROFILE = {
  invert: true,
  brightness: 95,
  contrast: 100,
  sepia: 30,
  grayscale: 0
};

// ==================== MESSAGE HANDLING ====================
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  log('Message received:', request.type, 'from:', sender.tab?.url || 'popup');

  if (request.type === 'req_update') {
    handleUpdateRequest(request.data).then(() => {
      log('handleUpdateRequest complete');
      sendResponse({ success: true });
    }).catch(e => {
      logError('handleUpdateRequest failed:', e);
      sendResponse({ success: false, error: e.message });
    });
  } else if (request.type === 'req_state') {
    // Content script pulling state
    const tabId = sender.tab?.id;
    const url = sender.tab?.url;
    log('req_state from tab:', tabId, 'url:', url);
    if (tabId && url) {
      respondWithState(tabId, url);
    }
  }
  return true; // Keep channel open for async
});

// ==================== TAB EVENTS ====================
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && !tab.url.startsWith('chrome://')) {
    log('Tab updated:', tabId, tab.url);
    respondWithState(tabId, tab.url);
  }
});

// ==================== ALARM (Periodic Sync) ====================
chrome.alarms.create('timeTick', { periodInMinutes: 5 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'timeTick') {
    log('Alarm tick - broadcasting');
    broadcastToRelevantTabs();
  }
});

// ==================== CORE FUNCTIONS ====================

/**
 * Handle update request from Popup
 */
async function handleUpdateRequest(data) {
  log('handleUpdateRequest() data:', data);
  const { mode, values, scope, enabled } = data;

  // Save global enabled state if provided
  if (typeof enabled === 'boolean') {
    log('Saving enabled:', enabled);
    await chrome.storage.sync.set({ enabled });
  }

  if (!scope || scope === 'system_page') {
    log('No scope or system page, broadcasting');
    await broadcastToRelevantTabs();
    return;
  }

  const siteKey = `site_${normalizeHostname(scope)}`;
  const updates = {};

  if (mode === 'disable') {
    log('Disable mode - setting site disabled');
    updates[siteKey] = { disabled: true };
  } else {
    updates.global_mode = mode;
    if (values) {
      updates.manual_settings = values;
    }
    updates[siteKey] = { disabled: false };
  }

  log('Saving updates:', updates);
  await chrome.storage.sync.set(updates);

  // Immediately update current active tab first
  try {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeTab?.id && activeTab.url && !activeTab.url.startsWith('chrome://')) {
      const hostname = normalizeHostname(new URL(activeTab.url).hostname);
      const state = await buildCanonicalState(hostname);
      log('Sending immediate update to active tab:', activeTab.id, state);
      await chrome.tabs.sendMessage(activeTab.id, { type: 'state_update', data: state });
    }
  } catch (e) {
    log('Active tab update failed (normal if tab not ready):', e.message);
  }

  // Then broadcast to all other tabs
  broadcastToRelevantTabs();
}

/**
 * Send canonical state to a specific tab
 */
async function respondWithState(tabId, url) {
  try {
    const hostname = normalizeHostname(new URL(url).hostname);
    const state = await buildCanonicalState(hostname);
    chrome.tabs.sendMessage(tabId, { type: 'state_update', data: state }).catch(() => { });
  } catch (e) { }
}

/**
 * Broadcast to tabs that need updates (relevant only)
 */
async function broadcastToRelevantTabs() {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (tab.url && !tab.url.startsWith('chrome://')) {
      respondWithState(tab.id, tab.url);
    }
  }
}

// ==================== PURE STATE DERIVATION ====================

/**
 * buildCanonicalState - The Heart of the Brain
 * 
 * AUTO: Let content script detect native dark. If native = do nothing, else apply inversion.
 * MANUAL: Use universal settings (stored in 'manual_settings').
 * DISABLE: Hard off.
 */
async function buildCanonicalState(hostname) {
  const storage = await getStorage(['global_mode', `site_${hostname}`, 'enabled', 'manual_settings', 'blue_filter']);

  // Global power toggle
  const globalEnabled = storage.enabled !== false;

  const globalMode = storage.global_mode || 'auto';
  const siteData = storage[`site_${hostname}`] || {};
  const manualSettings = storage.manual_settings || DEFAULT_PROFILE;
  const blueFilter = storage.blue_filter || 0;

  // Derive mode
  let mode = globalMode;
  if (!globalEnabled) {
    mode = 'disable'; // Global off
  } else if (siteData.disabled === true) {
    mode = 'disable'; // Site-level disable
  }

  // Derive sitePolicy
  let sitePolicy = 'inherit';
  if (!globalEnabled || siteData.disabled === true) sitePolicy = 'force-off';
  else if (mode === 'manual') sitePolicy = 'force-on';

  // Derive renderProfile
  let renderProfile = { ...DEFAULT_PROFILE, ...manualSettings, blueFilter };

  return {
    mode,
    sitePolicy,
    nativeDark: 'unknown',
    renderProfile
  };
}

// ==================== HELPERS ====================

function normalizeHostname(host) {
  return host.replace(/^www\./, '').replace(/^m\./, '');
}

function getStorage(keys) {
  return new Promise((resolve) => {
    chrome.storage.sync.get(keys, (items) => {
      resolve(items || {});
    });
  });
}

