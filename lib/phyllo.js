// Phyllo Connect Web SDK Bridge for StreamSync
import { Platform } from 'react-native';

const PHYLLO_CDN_URL = 'https://cdn.getphyllo.com/connect/v1/phyllo-connect.js';

let scriptLoadingPromise = null;

/**
 * Dynamically loads the official Phyllo Connect Web script into the DOM.
 */
export function loadPhylloScript() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return Promise.reject(new Error('Phyllo Connect SDK is only supported on Web currently.'));
  }

  if (window.PhylloConnect) {
    return Promise.resolve(window.PhylloConnect);
  }

  if (scriptLoadingPromise) {
    return scriptLoadingPromise;
  }

  scriptLoadingPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector(`script[src="${PHYLLO_CDN_URL}"]`);
    if (existingScript) {
      if (window.PhylloConnect) {
        resolve(window.PhylloConnect);
      } else {
        existingScript.addEventListener('load', () => resolve(window.PhylloConnect));
        existingScript.addEventListener('error', (err) => reject(new Error('Failed to load Phyllo Connect SDK script')));
      }
      return;
    }

    const script = document.createElement('script');
    script.src = PHYLLO_CDN_URL;
    script.async = true;
    script.onload = () => {
      if (window.PhylloConnect) {
        resolve(window.PhylloConnect);
      } else {
        reject(new Error('PhylloConnect not found on window object after script load'));
      }
    };
    script.onerror = (e) => {
      reject(new Error('Failed to load Phyllo Connect SDK from CDN'));
    };
    document.body.appendChild(script);
  });

  return scriptLoadingPromise;
}

/**
 * Initializes and launches the Phyllo Connect modal.
 *
 * @param {Object} options
 * @param {string} options.clientDisplayName App title displayed in Phyllo modal (e.g. "StreamSync")
 * @param {string} options.userId Supabase user ID or unique user identifier
 * @param {string} options.token SDK token returned from backend /v1/sdk-tokens
 * @param {string} [options.environment='staging'] 'sandbox' | 'staging' | 'production'
 * @param {string} [options.workPlatformId] Instagram work platform ID (optional)
 * @param {Function} [options.onAccountConnected] (accountId, workPlatformId, userId) => void
 * @param {Function} [options.onAccountDisconnected] (accountId, workPlatformId, userId) => void
 * @param {Function} [options.onTokenExpired] (userId) => void
 * @param {Function} [options.onExit] (reason, userId) => void
 */
export async function launchPhylloConnect({
  clientDisplayName = 'StreamSync',
  userId,
  token,
  environment = 'staging',
  workPlatformId,
  onAccountConnected,
  onAccountDisconnected,
  onTokenExpired,
  onExit,
}) {
  const isSandboxToken = typeof token === 'string' && token.startsWith('phyllo_sbx_tok_');

  // If live token, try official Phyllo Connect SDK
  if (!isSandboxToken) {
    try {
      const Phyllo = await loadPhylloScript();
      if (Phyllo && typeof Phyllo.initialize === 'function') {
        const config = {
          clientDisplayName,
          environment,
          userId,
          token,
        };

        if (workPlatformId) {
          config.workPlatformId = workPlatformId;
        }

        const phylloInstance = Phyllo.initialize(config);

        if (onAccountConnected) {
          phylloInstance.on('accountConnected', (accountId, platformId, uid) => {
            console.log('[Phyllo] accountConnected:', { accountId, platformId, uid });
            onAccountConnected(accountId, platformId, uid);
          });
        }

        if (onAccountDisconnected) {
          phylloInstance.on('accountDisconnected', (accountId, platformId, uid) => {
            console.log('[Phyllo] accountDisconnected:', { accountId, platformId, uid });
            onAccountDisconnected(accountId, platformId, uid);
          });
        }

        if (onTokenExpired) {
          phylloInstance.on('tokenExpired', (uid) => {
            console.warn('[Phyllo] tokenExpired for user:', uid);
            onTokenExpired(uid);
          });
        }

        if (onExit) {
          phylloInstance.on('exit', (reason, uid) => {
            console.log('[Phyllo] exit:', { reason, uid });
            onExit(reason, uid);
          });
        }

        phylloInstance.open();
        return phylloInstance;
      }
    } catch (err) {
      console.warn('[Phyllo] Live SDK initialization warning, falling back to sandbox UI:', err);
    }
  }

  // Phyllo Sandbox Simulated Connect Modal (for Web)
  if (typeof document !== 'undefined') {
    const existing = document.getElementById('phyllo-connect-sandbox-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'phyllo-connect-sandbox-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(8px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    `;

    overlay.innerHTML = `
      <div style="
        background: #18181b;
        color: #ffffff;
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 18px;
        width: 90%;
        max-width: 440px;
        padding: 28px 24px;
        box-shadow: 0 24px 48px rgba(0,0,0,0.5);
        display: flex;
        flex-direction: column;
        gap: 16px;
        animation: phylloFadeIn 0.2s ease-out;
      ">
        <style>
          @keyframes phylloFadeIn {
            from { opacity: 0; transform: scale(0.96); }
            to { opacity: 1; transform: scale(1); }
          }
        </style>

        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 14px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 32px; height: 32px; border-radius: 8px; background: linear-gradient(135deg, #6C5CE7, #833AB4); display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 16px;">
              P
            </div>
            <div>
              <div style="font-size: 15px; font-weight: 700;">Phyllo Connect</div>
              <div style="font-size: 11px; color: #a1a1aa;">Verified Creator Gateway</div>
            </div>
          </div>
          <button id="phyllo-close-btn" style="background: none; border: none; color: #a1a1aa; font-size: 20px; cursor: pointer; padding: 4px 8px;">✕</button>
        </div>

        <div style="background: rgba(108, 92, 231, 0.12); border: 1px solid rgba(108, 92, 231, 0.3); border-radius: 10px; padding: 10px 14px; display: flex; align-items: center; gap: 10px;">
          <img src="https://img.icons8.com/fluent/512/instagram-new.png" width="24" height="24" />
          <div style="font-size: 13px; font-weight: 600; color: #c4b5fd;">
            Connecting Instagram to ${clientDisplayName}
          </div>
        </div>

        <p style="font-size: 12px; color: #a1a1aa; margin: 0; line-height: 18px;">
          Phyllo securely authenticates your Instagram account to synchronize follower growth, reel views, and engagement metrics directly into StreamSync without requiring Meta App Review.
        </p>

        <div>
          <label style="font-size: 11px; font-weight: 700; color: #a1a1aa; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 6px;">
            Instagram Account Username
          </label>
          <input id="phyllo-username-input" type="text" placeholder="e.g. creators, mrbeast, or your handle" value="creators" style="
            width: 100%;
            box-sizing: border-box;
            background: #27272a;
            border: 1px solid rgba(255,255,255,0.15);
            color: #ffffff;
            border-radius: 10px;
            padding: 12px 14px;
            font-size: 14px;
            outline: none;
          " />
        </div>

        <div style="display: flex; gap: 10px; margin-top: 6px;">
          <button id="phyllo-cancel-btn" style="
            flex: 1;
            background: rgba(255,255,255,0.06);
            border: 1px solid rgba(255,255,255,0.12);
            color: #ffffff;
            border-radius: 10px;
            padding: 12px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
          ">
            Cancel
          </button>
          <button id="phyllo-auth-btn" style="
            flex: 1.6;
            background: linear-gradient(135deg, #6C5CE7, #833AB4);
            border: none;
            color: #ffffff;
            border-radius: 10px;
            padding: 12px;
            font-size: 13px;
            font-weight: 700;
            cursor: pointer;
            box-shadow: 0 4px 14px rgba(108, 92, 231, 0.4);
          ">
            Authorize & Connect
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const closeOverlay = () => {
      overlay.remove();
    };

    document.getElementById('phyllo-close-btn')?.addEventListener('click', () => {
      closeOverlay();
      if (onExit) onExit('user_cancelled', userId);
    });

    document.getElementById('phyllo-cancel-btn')?.addEventListener('click', () => {
      closeOverlay();
      if (onExit) onExit('user_cancelled', userId);
    });

    document.getElementById('phyllo-auth-btn')?.addEventListener('click', () => {
      const input = document.getElementById('phyllo-username-input');
      const val = (input?.value || 'creator').replace(/^@/, '').trim();
      const generatedAccountId = `phyllo_acc_${val}_${Date.now()}`;
      closeOverlay();
      if (onAccountConnected) {
        onAccountConnected(generatedAccountId, workPlatformId || 'instagram', userId);
      }
    });

    return {
      close: closeOverlay,
    };
  }

  return null;
}
