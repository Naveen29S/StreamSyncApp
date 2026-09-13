import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useColorScheme, Platform, StyleSheet, Animated, Easing } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_STORAGE_KEY = 'streamsync_theme_preference';

// Web CSS injection for silky smooth theme transition between day and dark modes
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const STYLE_ID = 'streamsync-theme-transition-styles';
  if (!document.getElementById(STYLE_ID)) {
    const styleEl = document.createElement('style');
    styleEl.id = STYLE_ID;
    styleEl.type = 'text/css';
    styleEl.appendChild(document.createTextNode(`
      /* Global fade transition applied smoothly during theme switching */
      html.theme-transitioning,
      html.theme-transitioning *,
      html.theme-transitioning *::before,
      html.theme-transitioning *::after {
        transition: background-color 0.38s cubic-bezier(0.4, 0, 0.2, 1),
                    color 0.35s cubic-bezier(0.4, 0, 0.2, 1),
                    border-color 0.38s cubic-bezier(0.4, 0, 0.2, 1),
                    box-shadow 0.38s cubic-bezier(0.4, 0, 0.2, 1) !important;
        transition-delay: 0s !important;
      }

      /* Native browser view transition support for cross-dissolving screens */
      ::view-transition-old(root),
      ::view-transition-new(root) {
        animation-duration: 0.38s;
        animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
      }
    `));
    document.head.appendChild(styleEl);
  }
}

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
  isTransitioning: false,
});

export function ThemeProvider({ children }) {
  const systemScheme = useColorScheme();
  const [theme, setThemeState] = useState('light');
  const [isLoaded, setIsLoaded] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [outgoingColor, setOutgoingColor] = useState('#ffffff');
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    async function loadStoredTheme() {
      try {
        const stored = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (stored === 'dark' || stored === 'light') {
          setThemeState(stored);
        } else if (systemScheme === 'dark') {
          setThemeState('dark');
        }
      } catch (e) {
        console.warn('Could not load theme preference:', e);
      } finally {
        setIsLoaded(true);
      }
    }
    loadStoredTheme();
  }, [systemScheme]);

  const performThemeSwitch = (newTheme) => {
    const valid = newTheme === 'dark' ? 'dark' : 'light';
    if (valid === theme) return;

    // Capture outgoing background color for cross-fade dissolve
    const prevBg = theme === 'dark' ? THEME_COLORS.dark.background : THEME_COLORS.light.background;
    setOutgoingColor(prevBg);

    // Apply Web transitions
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      try {
        document.documentElement.classList.add('theme-transitioning');

        const updateState = () => {
          setThemeState(valid);
        };

        if (document.startViewTransition) {
          document.startViewTransition(updateState);
        } else {
          updateState();
        }

        setTimeout(() => {
          document.documentElement.classList.remove('theme-transitioning');
        }, 420);
      } catch (e) {
        setThemeState(valid);
      }
    } else {
      setThemeState(valid);
    }

    // Trigger cross-fade overlay animation
    setIsTransitioning(true);
    fadeAnim.setValue(0.5);
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 380,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    }).start(() => {
      setIsTransitioning(false);
    });

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

  // Keep web DOM document background in sync so no white flashes occur on bounce or margins
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
    <ThemeContext.Provider value={{ theme, isDark, colors, toggleTheme, setTheme, isLoaded, isTransitioning }}>
      {children}
      {isTransitioning && (
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            {
              backgroundColor: outgoingColor,
              opacity: fadeAnim,
              zIndex: 999999,
            },
          ]}
        />
      )}
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
      isTransitioning: false,
    };
  }
  return context;
}
