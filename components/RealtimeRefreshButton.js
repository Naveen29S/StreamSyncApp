import React, { useRef, useEffect, useState } from 'react';
import { StyleSheet, TouchableOpacity, View, Text, Platform, Animated, Easing } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useRefresh, REFRESH_INTERVAL_OPTIONS } from '../context/RefreshContext';

export default function RealtimeRefreshButton({ style, compact = false }) {
  const { colors, isDark } = useTheme();
  const {
    isRefreshing,
    secondsAgo,
    autoRefreshEnabled,
    refreshInterval,
    triggerRefresh,
    setAutoRefreshEnabled,
    setRefreshInterval,
  } = useRefresh();

  const [menuOpen, setMenuOpen] = useState(false);
  const spinValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let anim = null;
    if (isRefreshing) {
      spinValue.setValue(0);
      anim = Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 750,
          easing: Easing.linear,
          useNativeDriver: Platform.OS !== 'web',
        })
      );
      anim.start();
    } else {
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 250,
        easing: Easing.out(Easing.ease),
        useNativeDriver: Platform.OS !== 'web',
      }).start(() => {
        spinValue.setValue(0);
      });
    }
    return () => {
      if (anim) anim.stop();
    };
  }, [isRefreshing]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const getRelativeTimeText = () => {
    if (isRefreshing) return 'Syncing...';
    if (secondsAgo <= 2) return 'Just now';
    if (secondsAgo < 60) return `${secondsAgo}s ago`;
    const mins = Math.floor(secondsAgo / 60);
    return `${mins}m ago`;
  };

  return (
    <View style={[styles.wrapper, style]}>
      <View
        style={[
          styles.pill,
          {
            backgroundColor: isDark ? 'rgba(30, 41, 59, 0.85)' : 'rgba(0, 0, 0, 0.04)',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
          },
          isRefreshing && (isDark ? styles.pillRefreshingDark : styles.pillRefreshingLight),
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.75}
          onPress={() => triggerRefresh(true)}
          disabled={isRefreshing}
          style={styles.pillAction}
          accessibilityRole="button"
          accessibilityLabel="Refresh website in real time"
          title="Click to refresh real-time data"
        >
          <View style={styles.dotContainer}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: autoRefreshEnabled ? '#10b981' : (isDark ? '#64748b' : '#94a3b8') },
              ]}
            />
            {autoRefreshEnabled && (
              <View style={[styles.statusPulseRing, { borderColor: '#10b981' }]} />
            )}
          </View>

          <Animated.View style={{ transform: [{ rotate: spin }] }}>
            <Text style={[styles.refreshIcon, { color: isRefreshing ? '#a855f7' : colors.textPrimary }]}>
              ↻
            </Text>
          </Animated.View>

          {!compact && (
            <View style={styles.textCol}>
              <View style={styles.topRow}>
                <Text style={[styles.mainLabel, { color: isRefreshing ? '#a855f7' : colors.textPrimary }]}>
                  {isRefreshing ? 'Syncing...' : 'Live'}
                </Text>
                <Text style={[styles.timeLabel, { color: colors.textSecondary }]}>
                  • {getRelativeTimeText()}
                </Text>
              </View>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setMenuOpen(!menuOpen)}
          hitSlop={{ top: 8, bottom: 8, left: 6, right: 8 }}
          style={[styles.menuChevronBtn, { borderLeftColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }]}
          title="Auto-refresh settings"
        >
          <Text style={[styles.chevronText, { color: colors.textSecondary }]}>▾</Text>
        </TouchableOpacity>
      </View>

      {menuOpen && (
        <View
          style={[
            styles.menuPopover,
            {
              backgroundColor: isDark ? '#131c2e' : '#ffffff',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 12 },
              shadowOpacity: isDark ? 0.4 : 0.12,
              shadowRadius: 24,
              elevation: 10,
            },
          ]}
        >
          <View style={[styles.menuHeader, { borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}>
            <Text style={[styles.menuTitle, { color: colors.textPrimary }]}>Real-Time Auto Refresh</Text>
            <TouchableOpacity onPress={() => setMenuOpen(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={[styles.menuClose, { color: colors.textSecondary }]}>✕</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[
              styles.menuItemToggle,
              { backgroundColor: autoRefreshEnabled ? (isDark ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.08)') : 'transparent' },
            ]}
            onPress={() => setAutoRefreshEnabled(!autoRefreshEnabled)}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.menuItemTitle, { color: colors.textPrimary }]}>
                {autoRefreshEnabled ? 'Frequent Sync: ON' : 'Frequent Sync: Paused'}
              </Text>
              <Text style={[styles.menuItemSub, { color: colors.textSecondary }]}>
                {autoRefreshEnabled ? `Refreshes every ${refreshInterval / 1000}s automatically` : 'Manual refresh only'}
              </Text>
            </View>
            <View style={[styles.switchTrack, autoRefreshEnabled && styles.switchTrackActive]}>
              <View style={[styles.switchThumb, autoRefreshEnabled && styles.switchThumbActive]} />
            </View>
          </TouchableOpacity>

          <Text style={[styles.menuSectionLabel, { color: colors.textMuted }]}>REFRESH FREQUENCY</Text>
          {REFRESH_INTERVAL_OPTIONS.map((opt) => {
            const isSelected = autoRefreshEnabled && refreshInterval === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.menuItemOption,
                  isSelected && (isDark ? styles.optionSelectedDark : styles.optionSelectedLight),
                ]}
                onPress={() => {
                  setRefreshInterval(opt.value);
                  if (!autoRefreshEnabled) setAutoRefreshEnabled(true);
                  setMenuOpen(false);
                }}
              >
                <Text style={[styles.optionText, { color: isSelected ? (isDark ? '#34d399' : '#059669') : colors.textPrimary }]}>
                  {opt.label}
                </Text>
                {isSelected && <Text style={{ color: '#10b981', fontWeight: '700' }}>✓</Text>}
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity
            style={[styles.menuRefreshNowBtn, { backgroundColor: colors.btnPrimaryBg }]}
            onPress={() => {
              setMenuOpen(false);
              triggerRefresh(true);
            }}
          >
            <Text style={[styles.menuRefreshNowText, { color: colors.btnPrimaryText }]}>↻ Refresh Now</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    zIndex: 50,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    gap: 7,
  },
  pillAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    ...(Platform.OS === 'web' ? {
      cursor: 'pointer',
      userSelect: 'none',
    } : {}),
  },
  pillRefreshingDark: {
    borderColor: 'rgba(168, 85, 247, 0.4)',
    backgroundColor: 'rgba(168, 85, 247, 0.12)',
  },
  pillRefreshingLight: {
    borderColor: 'rgba(157, 80, 255, 0.3)',
    backgroundColor: 'rgba(157, 80, 255, 0.08)',
  },
  dotContainer: {
    width: 10,
    height: 10,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  statusPulseRing: {
    position: 'absolute',
    width: 13,
    height: 13,
    borderRadius: 6.5,
    borderWidth: 1.5,
    opacity: 0.5,
  },
  refreshIcon: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 16,
  },
  textCol: {
    justifyContent: 'center',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  mainLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  timeLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  menuChevronBtn: {
    paddingLeft: 6,
    borderLeftWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'web' ? {
      cursor: 'pointer',
      userSelect: 'none',
    } : {}),
  },
  chevronText: {
    fontSize: 11,
    fontWeight: '600',
  },
  menuPopover: {
    position: 'absolute',
    top: 42,
    right: 0,
    width: 250,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    zIndex: 100,
  },
  menuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: 1,
    marginBottom: 10,
  },
  menuTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  menuClose: {
    fontSize: 12,
    paddingHorizontal: 4,
  },
  menuItemToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
  menuItemTitle: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  menuItemSub: {
    fontSize: 10,
  },
  switchTrack: {
    width: 36,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#cbd5e1',
    padding: 2,
    justifyContent: 'center',
  },
  switchTrackActive: {
    backgroundColor: '#10b981',
  },
  switchThumb: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#ffffff',
  },
  switchThumbActive: {
    transform: [{ translateX: 16 }],
  },
  menuSectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  menuItemOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 2,
  },
  optionSelectedDark: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  optionSelectedLight: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
  },
  optionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  menuRefreshNowBtn: {
    marginTop: 10,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuRefreshNowText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
