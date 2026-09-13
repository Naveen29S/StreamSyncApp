import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const RefreshContext = createContext({
  isRefreshing: false,
  lastRefreshed: new Date(),
  secondsAgo: 0,
  autoRefreshEnabled: true,
  refreshInterval: 30000,
  triggerRefresh: async () => {},
  setAutoRefreshEnabled: () => {},
  setRefreshInterval: () => {},
  registerRefreshListener: () => () => {},
});

const STORAGE_AUTO_REFRESH_KEY = 'streamsync_auto_refresh_enabled';
const STORAGE_REFRESH_INTERVAL_KEY = 'streamsync_refresh_interval_ms';

export const REFRESH_INTERVAL_OPTIONS = [
  { label: 'Every 15s (Fast)', value: 15000 },
  { label: 'Every 30s (Default)', value: 30000 },
  { label: 'Every 60s (Slow)', value: 60000 },
];

export function RefreshProvider({ children }) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());
  const [secondsAgo, setSecondsAgo] = useState(0);
  const [autoRefreshEnabled, setAutoRefreshEnabledState] = useState(true);
  const [refreshInterval, setRefreshIntervalState] = useState(30000); // 30 seconds default
  
  const listenersRef = useRef(new Set());
  const timerRef = useRef(null);
  const secondsTimerRef = useRef(null);
  const lastRefreshTimeRef = useRef(Date.now());

  // Load saved preferences
  useEffect(() => {
    async function loadPreferences() {
      try {
        const savedEnabled = await AsyncStorage.getItem(STORAGE_AUTO_REFRESH_KEY);
        if (savedEnabled !== null) {
          setAutoRefreshEnabledState(savedEnabled === 'true');
        }
        const savedInterval = await AsyncStorage.getItem(STORAGE_REFRESH_INTERVAL_KEY);
        if (savedInterval !== null) {
          const parsed = parseInt(savedInterval, 10);
          if (!isNaN(parsed) && parsed >= 10000) {
            setRefreshIntervalState(parsed);
          }
        }
      } catch (e) {
        console.warn('Could not load refresh preferences:', e);
      }
    }
    loadPreferences();
  }, []);

  const setAutoRefreshEnabled = async (enabled) => {
    setAutoRefreshEnabledState(enabled);
    try {
      await AsyncStorage.setItem(STORAGE_AUTO_REFRESH_KEY, String(enabled));
    } catch (e) {
      console.warn('Could not save auto refresh preference:', e);
    }
  };

  const setRefreshInterval = async (intervalMs) => {
    setRefreshIntervalState(intervalMs);
    try {
      await AsyncStorage.setItem(STORAGE_REFRESH_INTERVAL_KEY, String(intervalMs));
    } catch (e) {
      console.warn('Could not save refresh interval preference:', e);
    }
  };

  // Register listener for screens to subscribe to refresh events
  const registerRefreshListener = useCallback((fn) => {
    if (typeof fn === 'function') {
      listenersRef.current.add(fn);
    }
    return () => {
      listenersRef.current.delete(fn);
    };
  }, []);

  // Main refresh executor
  const triggerRefresh = useCallback(async (manual = true) => {
    if (isRefreshing) return;
    setIsRefreshing(true);

    const startTime = Date.now();

    try {
      // 1. Dispatch custom DOM event for web
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('streamsync:refresh', { 
          detail: { manual, timestamp: startTime } 
        }));
      }

      // 2. Execute all subscribed screen listeners concurrently
      const promises = [];
      listenersRef.current.forEach((listener) => {
        try {
          const res = listener();
          if (res && typeof res.then === 'function') {
            promises.push(res);
          }
        } catch (err) {
          console.warn('Error in refresh listener:', err);
        }
      });

      if (promises.length > 0) {
        await Promise.allSettled(promises);
      }

      // Ensure at least 450ms animation feedback for manual clicks
      const elapsed = Date.now() - startTime;
      if (manual && elapsed < 450) {
        await new Promise(r => setTimeout(r, 450 - elapsed));
      }

      const now = new Date();
      setLastRefreshed(now);
      lastRefreshTimeRef.current = now.getTime();
      setSecondsAgo(0);
    } catch (error) {
      console.warn('StreamSync real-time refresh notice:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing]);

  // Relative time counter ("Updated X seconds ago")
  useEffect(() => {
    secondsTimerRef.current = setInterval(() => {
      const diff = Math.floor((Date.now() - lastRefreshTimeRef.current) / 1000);
      setSecondsAgo(Math.max(0, diff));
    }, 1000);

    return () => {
      if (secondsTimerRef.current) clearInterval(secondsTimerRef.current);
    };
  }, []);

  // Frequent automatic refresh loop
  useEffect(() => {
    if (!autoRefreshEnabled) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      // Don't refresh if web tab is hidden
      if (Platform.OS === 'web' && typeof document !== 'undefined' && document.hidden) {
        return;
      }
      triggerRefresh(false);
    }, refreshInterval);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [autoRefreshEnabled, refreshInterval, triggerRefresh]);

  // Tab visibility change / focus handler: refresh if returning to tab after >15 seconds
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const handleFocusOrVisibility = () => {
      if (document.hidden) return;
      const elapsed = Date.now() - lastRefreshTimeRef.current;
      if (elapsed > 15000) {
        triggerRefresh(false);
      }
    };

    window.addEventListener('focus', handleFocusOrVisibility);
    document.addEventListener('visibilitychange', handleFocusOrVisibility);

    return () => {
      window.removeEventListener('focus', handleFocusOrVisibility);
      document.removeEventListener('visibilitychange', handleFocusOrVisibility);
    };
  }, [triggerRefresh]);

  return (
    <RefreshContext.Provider
      value={{
        isRefreshing,
        lastRefreshed,
        secondsAgo,
        autoRefreshEnabled,
        refreshInterval,
        triggerRefresh,
        setAutoRefreshEnabled,
        setRefreshInterval,
        registerRefreshListener,
      }}
    >
      {children}
    </RefreshContext.Provider>
  );
}

export function useRefresh() {
  return useContext(RefreshContext);
}
