import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

let flushSync = null;
if (Platform.OS === 'web') {
  try {
    const rd = require('react-dom');
    flushSync = rd.flushSync || null;
  } catch (e) {}
}

const THEME_STORAGE_KEY = 'streamsync_theme_preference';
const THEME_SPEED_STORAGE_KEY = 'streamsync_transition_speed_preference';

export const TRANSITION_SPEED_OPTIONS = {
  gentle: {
    id: 'gentle',
    label: 'Gentle (0.65s)',
    shortLabel: 'Gentle',
    durationText: '0.65s',
    durationMs: 650,
    cssDuration: '0.65s',
    desc: 'Soft & comfortable pace — gentle on the eyes',
    badge: 'Soft',
  },
  cinematic: {
    id: 'cinematic',
    label: 'Cinematic (0.85s)',
    shortLabel: 'Cinematic',
    durationText: '0.85s',
    durationMs: 850,
    cssDuration: '0.85s',
    desc: 'Golden-ratio slow dissolve — luxurious twilight melt',
    badge: 'Best Slow (Recommended)',
    isRecommended: true,
  },
  twilight: {
    id: 'twilight',
    label: 'Twilight (1.2s)',
    shortLabel: 'Twilight',
    durationText: '1.2s',
    durationMs: 1200,
    cssDuration: '1.2s',
    desc: 'Theatrical slow pace — watch day softly dissolve into night',
    badge: 'Dramatic',
  },
  dream: {
    id: 'dream',
    label: 'Dream (1.6s)',
    shortLabel: 'Dream',
    durationText: '1.6s',
    durationMs: 1600,
    cssDuration: '1.6s',
    desc: 'Ultra-slow ambient dissolve for maximum visual calm and immersion',
    badge: 'Deep Ambient',
  },
};

// Web CSS injection for silky-smooth, cinema-grade theme transition
function injectThemeTransitionStyles(cssDuration = '0.85s') {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  const STYLE_ID = 'streamsync-theme-transition-styles';
  let styleEl = document.getElementById(STYLE_ID);
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = STYLE_ID;
    styleEl.type = 'text/css';
    document.head.appendChild(styleEl);
  }

  styleEl.textContent = `
    /* Keep the toggle button completely independent from root fade so its pill glides cleanly */
    [data-theme-toggle="true"] {
      view-transition-name: theme-toggle;
    }
    ::view-transition-old(theme-toggle),
    ::view-transition-new(theme-toggle) {
      animation: none;
      mix-blend-mode: normal;
    }

    /* Native GPU-accelerated View Transition fade with customizable slow timing */
    ::view-transition-image-pair(root) {
      isolation: isolate;
    }
    ::view-transition-old(root),
    ::view-transition-new(root) {
      animation-duration: ${cssDuration};
      animation-timing-function: cubic-bezier(0.16, 1, 0.3, 1);
      mix-blend-mode: normal;
    }
    ::view-transition-old(root) {
      animation-name: streamsync-fade-out;
    }
    ::view-transition-new(root) {
      animation-name: streamsync-fade-in;
    }
    @keyframes streamsync-fade-out {
      from {
        opacity: 1;
      }
      to {
        opacity: 0;
      }
    }
    @keyframes streamsync-fade-in {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }

    /* Targeted CSS transitions for browsers without View Transitions */
    html.theme-transitioning,
    html.theme-transitioning body,
    html.theme-transitioning #root {
      transition: background-color ${cssDuration} cubic-bezier(0.16, 1, 0.3, 1),
                  color 0.35s cubic-bezier(0.16, 1, 0.3, 1) !important;
    }
    html.theme-transitioning div,
    html.theme-transitioning header,
    html.theme-transitioning nav,
    html.theme-transitioning aside,
    html.theme-transitioning main,
    html.theme-transitioning section,
    html.theme-transitioning button,
    html.theme-transitioning input,
    html.theme-transitioning textarea {
      transition: background-color ${cssDuration} cubic-bezier(0.16, 1, 0.3, 1),
                  border-color ${cssDuration} cubic-bezier(0.16, 1, 0.3, 1),
                  color 0.35s cubic-bezier(0.16, 1, 0.3, 1),
                  box-shadow ${cssDuration} cubic-bezier(0.16, 1, 0.3, 1) !important;
    }

    /* ─── Box Grid Borders, Outer Shadows & Glow Hover Visual Effects ─── */
    [data-grid-box="true"],
    .streamsync-grid-box {
      transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1),
                  box-shadow 0.28s cubic-bezier(0.16, 1, 0.3, 1),
                  border-color 0.28s ease !important;
      will-change: transform, box-shadow;
    }

    /* Day Mode (Light): Professional border + layered outer elevation shadows */
    html:not([data-theme="dark"]) [data-grid-box="true"],
    html:not([data-theme="dark"]) .streamsync-grid-box {
      border: 1px solid rgba(0, 0, 0, 0.08) !important;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06), 0 1px 3px rgba(0, 0, 0, 0.03) !important;
    }

    /* Day Mode Hover: Lifts up (-5px), glowing white outline shadow + outer elevation */
    html:not([data-theme="dark"]) [data-grid-box="true"]:hover,
    html:not([data-theme="dark"]) .streamsync-grid-box:hover {
      transform: translateY(-5px) !important;
      border-color: #ffffff !important;
      box-shadow: 0 16px 36px rgba(0, 0, 0, 0.12),
                  0 0 24px rgba(255, 255, 255, 0.95),
                  0 0 0 2px rgba(255, 255, 255, 1) !important;
      cursor: pointer;
    }

    /* Dark Mode: Deep border + rich obsidian outer shadow */
    html[data-theme="dark"] [data-grid-box="true"],
    html[data-theme="dark"] .streamsync-grid-box {
      border: 1px solid rgba(255, 255, 255, 0.09) !important;
      box-shadow: 0 6px 24px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.04) !important;
    }

    /* Dark Mode Hover: Lifts up (-5px), glowing dark shade halo + deep outer shadow */
    html[data-theme="dark"] [data-grid-box="true"]:hover,
    html[data-theme="dark"] .streamsync-grid-box:hover {
      transform: translateY(-5px) !important;
      border-color: rgba(255, 255, 255, 0.22) !important;
      box-shadow: 0 22px 48px rgba(0, 0, 0, 0.95),
                  0 0 30px rgba(0, 0, 0, 0.85),
                  0 0 0 1.5px rgba(255, 255, 255, 0.18) !important;
      cursor: pointer;
    }
  `;
}

// Initial injection with the recommended 0.85s slow cinematic duration
injectThemeTransitionStyles('0.85s');

export const THEME_COLORS = {
  light: {
    name: 'light',
    isDark: false,
    background: '#ffffff',
    bodyBg: '#fbfbfb',
    cardBg: '#ffffff',
    sidebarBg: '#ffffff',
    topbarBg: '#ffffff',
    modalBg: '#ffffff',
    border: '#e5e5e5',
    borderSubtle: '#f0f0f0',
    borderStrong: '#d1d5db',
    textPrimary: '#000000',
    textSecondary: '#666666',
    textMuted: '#999999',
    inputBg: '#f8f8f8',
    inputBorder: '#e5e5e5',
    accent: '#9d50ff',
    accentLight: 'rgba(157, 80, 255, 0.08)',
    accentGradient: ['#9d50ff', '#6e00ff'],
    btnPrimaryBg: '#000000',
    btnPrimaryText: '#ffffff',
    btnSecondaryBg: '#ffffff',
    btnSecondaryBorder: '#e5e5e5',
    btnSecondaryText: '#111827',
    badgeBg: '#f3f4f6',
    badgeText: '#4b5563',
    cardShadow: Platform.OS === 'web' 
      ? { boxShadow: '0 4px 20px rgba(0,0,0,0.04)' } 
      : { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 2 },
    glowA: 'rgba(255, 75, 145, 0.35)',
    glowB: 'rgba(251, 146, 60, 0.3)',
  },
  dark: {
    name: 'dark',
    isDark: true,
    background: '#090d16',
    bodyBg: '#0b0f19',
    cardBg: '#111827',
    sidebarBg: '#0d1321',
    topbarBg: '#0d1321',
    modalBg: '#131c2e',
    border: 'rgba(255, 255, 255, 0.08)',
    borderSubtle: 'rgba(255, 255, 255, 0.05)',
    borderStrong: 'rgba(255, 255, 255, 0.16)',
    textPrimary: '#f8fafc',
    textSecondary: '#94a3b8',
    textMuted: '#64748b',
    inputBg: '#1e293b',
    inputBorder: '#334155',
    accent: '#a855f7',
    accentLight: 'rgba(168, 85, 247, 0.15)',
    accentGradient: ['#a855f7', '#7c3aed'],
    btnPrimaryBg: '#f8fafc',
    btnPrimaryText: '#090d16',
    btnSecondaryBg: '#1e293b',
    btnSecondaryBorder: 'rgba(255, 255, 255, 0.12)',
    btnSecondaryText: '#f8fafc',
    badgeBg: '#1e293b',
    badgeText: '#cbd5e1',
    cardShadow: Platform.OS === 'web' 
      ? { boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)' } 
      : { shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 6 },
    glowA: 'rgba(168, 85, 247, 0.22)',
    glowB: 'rgba(56, 189, 248, 0.18)',
  }
};

const ThemeContext = createContext({
  theme: 'light',
  isDark: false,
  colors: THEME_COLORS.light,
  toggleTheme: () => {},
  setTheme: () => {},
  isLoaded: false,
  transitionSpeed: 'cinematic',
  setTransitionSpeed: () => {},
  speedOptions: TRANSITION_SPEED_OPTIONS,
  currentSpeedConfig: TRANSITION_SPEED_OPTIONS.cinematic,
});

export function ThemeProvider({ children }) {
  const systemScheme = useColorScheme();
  const [theme, setThemeState] = useState('light');
  const [transitionSpeed, setTransitionSpeedState] = useState('cinematic');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    async function loadStoredPreferences() {
      try {
        const storedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (storedTheme === 'dark' || storedTheme === 'light') {
          setThemeState(storedTheme);
        } else if (systemScheme === 'dark') {
          setThemeState('dark');
        }

        const storedSpeed = await AsyncStorage.getItem(THEME_SPEED_STORAGE_KEY);
        if (storedSpeed && TRANSITION_SPEED_OPTIONS[storedSpeed]) {
          setTransitionSpeedState(storedSpeed);
          injectThemeTransitionStyles(TRANSITION_SPEED_OPTIONS[storedSpeed].cssDuration);
        } else {
          // Default to the recommended best slow option (cinematic 0.85s)
          setTransitionSpeedState('cinematic');
          injectThemeTransitionStyles(TRANSITION_SPEED_OPTIONS.cinematic.cssDuration);
        }
      } catch (e) {
        console.warn('Could not load theme preferences:', e);
      } finally {
        setIsLoaded(true);
      }
    }
    loadStoredPreferences();
  }, [systemScheme]);

  const currentSpeedConfig = TRANSITION_SPEED_OPTIONS[transitionSpeed] || TRANSITION_SPEED_OPTIONS.cinematic;

  const setTransitionSpeed = async (speedId) => {
    if (!TRANSITION_SPEED_OPTIONS[speedId]) return;
    setTransitionSpeedState(speedId);
    injectThemeTransitionStyles(TRANSITION_SPEED_OPTIONS[speedId].cssDuration);
    try {
      await AsyncStorage.setItem(THEME_SPEED_STORAGE_KEY, speedId);
    } catch (e) {
      console.warn('Could not save speed preference:', e);
    }
  };

  const performThemeSwitch = (newTheme) => {
    const valid = newTheme === 'dark' ? 'dark' : 'light';
    if (valid === theme) return;

    const commitTheme = () => {
      setThemeState(valid);
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        try {
          const nextColors = valid === 'dark' ? THEME_COLORS.dark : THEME_COLORS.light;
          document.documentElement.setAttribute('data-theme', valid);
          document.documentElement.style.backgroundColor = nextColors.background;
          document.body.style.backgroundColor = nextColors.background;
          document.body.style.color = nextColors.textPrimary;
        } catch (e) {}
      }
    };

    if (Platform.OS === 'web' && typeof document !== 'undefined' && document.startViewTransition) {
      try {
        document.startViewTransition(() => {
          if (flushSync) {
            flushSync(commitTheme);
          } else {
            commitTheme();
          }
        });
      } catch (e) {
        commitTheme();
      }
    } else if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.documentElement.classList.add('theme-transitioning');
      commitTheme();
      setTimeout(() => {
        document.documentElement.classList.remove('theme-transitioning');
      }, currentSpeedConfig.durationMs + 60);
    } else {
      commitTheme();
    }

    AsyncStorage.setItem(THEME_STORAGE_KEY, valid).catch(err => console.warn('Theme save error:', err));
  };

  const setTheme = (newTheme) => {
    performThemeSwitch(newTheme);
  };

  const toggleTheme = () => {
    performThemeSwitch(theme === 'dark' ? 'light' : 'dark');
  };

  const isDark = theme === 'dark';
  const colors = isDark ? THEME_COLORS.dark : THEME_COLORS.light;

  // Sync initial DOM document state
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      try {
        document.documentElement.setAttribute('data-theme', theme);
        document.documentElement.style.backgroundColor = colors.background;
        document.body.style.backgroundColor = colors.background;
        document.body.style.color = colors.textPrimary;
      } catch (e) {}
    }
  }, [theme, colors]);

  return (
    <ThemeContext.Provider value={{
      theme,
      isDark,
      colors,
      toggleTheme,
      setTheme,
      isLoaded,
      transitionSpeed,
      setTransitionSpeed,
      speedOptions: TRANSITION_SPEED_OPTIONS,
      currentSpeedConfig
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    return {
      theme: 'light',
      isDark: false,
      colors: THEME_COLORS.light,
      toggleTheme: () => {},
      setTheme: () => {},
      isLoaded: true,
      transitionSpeed: 'cinematic',
      setTransitionSpeed: () => {},
      speedOptions: TRANSITION_SPEED_OPTIONS,
      currentSpeedConfig: TRANSITION_SPEED_OPTIONS.cinematic,
    };
  }
  return context;
}
