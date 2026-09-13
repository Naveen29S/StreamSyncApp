import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_STORAGE_KEY = 'streamsync_theme_preference';

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
});

export function ThemeProvider({ children }) {
  const systemScheme = useColorScheme();
  const [theme, setThemeState] = useState('light');
  const [isLoaded, setIsLoaded] = useState(false);

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

  const setTheme = async (newTheme) => {
    const valid = newTheme === 'dark' ? 'dark' : 'light';
    setThemeState(valid);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, valid);
    } catch (e) {
      console.warn('Could not save theme preference:', e);
    }
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
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
    <ThemeContext.Provider value={{ theme, isDark, colors, toggleTheme, setTheme, isLoaded }}>
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
      isLoaded: true
    };
  }
  return context;
}
