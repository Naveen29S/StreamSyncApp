import React, { useRef, useEffect } from 'react';
import { StyleSheet, TouchableOpacity, View, Text, Platform, Animated } from 'react-native';
import { useTheme } from '../context/ThemeContext';

export default function ThemeToggle({ style, showLabel = false, size = 'default' }) {
  const { isDark, toggleTheme, currentSpeedConfig } = useTheme();

  const isSmall = size === 'small';
  const slotSize = isSmall ? 24 : 28;
  const durationStr = currentSpeedConfig?.cssDuration || '0.85s';

  // Native animated fallback for iOS/Android
  const animValue = useRef(new Animated.Value(isDark ? 1 : 0)).current;

  useEffect(() => {
    if (Platform.OS !== 'web') {
      Animated.spring(animValue, {
        toValue: isDark ? 1 : 0,
        tension: 70,
        friction: 8.5,
        useNativeDriver: true,
      }).start();
    }
  }, [isDark]);

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={toggleTheme}
      dataSet={{ themeToggle: "true" }}
      style={[
        styles.container,
        isDark ? styles.containerDark : styles.containerLight,
        isSmall && styles.containerSmall,
        Platform.OS === 'web' ? {
          transition: `background-color ${durationStr} ease, border-color ${durationStr} ease`,
        } : {},
        style
      ]}
      accessibilityRole="button"
      accessibilityLabel={isDark ? "Switch to Day Mode" : "Switch to Night Mode"}
      title={isDark ? "Switch to Day Mode" : "Switch to Night Mode"}
    >
      {/* Sliding Active Indicator Pill */}
      {Platform.OS === 'web' ? (
        <View
          style={[
            styles.slidingPill,
            isSmall ? styles.slidingPillSmall : styles.slidingPillDefault,
            isDark ? styles.pillDark : styles.pillLight,
            {
              transform: [{ translateX: isDark ? slotSize : 0 }],
              transition: `transform ${durationStr} cubic-bezier(0.16, 1, 0.3, 1), background-color ${durationStr} ease, border-color ${durationStr} ease, box-shadow ${durationStr} ease`,
            }
          ]}
        />
      ) : (
        <Animated.View
          style={[
            styles.slidingPill,
            isSmall ? styles.slidingPillSmall : styles.slidingPillDefault,
            isDark ? styles.pillDark : styles.pillLight,
            {
              transform: [
                {
                  translateX: animValue.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, slotSize],
                  }),
                },
              ],
            },
          ]}
        />
      )}

      {/* Sun side (Day) */}
      <View
        style={[
          styles.iconSlot,
          isSmall && styles.iconSlotSmall,
          Platform.OS === 'web' ? {
            opacity: isDark ? 0.35 : 1,
            transform: [{ scale: isDark ? 0.86 : 1.06 }, { rotate: isDark ? '-24deg' : '0deg' }],
            transition: `opacity 0.35s ease, transform ${durationStr} cubic-bezier(0.16, 1, 0.3, 1)`,
          } : {
            opacity: !isDark ? 1 : 0.4,
          }
        ]}
      >
        <Text style={[styles.iconText, isSmall && styles.iconTextSmall]}>
          ☀️
        </Text>
      </View>

      {/* Moon side (Night) */}
      <View
        style={[
          styles.iconSlot,
          isSmall && styles.iconSlotSmall,
          Platform.OS === 'web' ? {
            opacity: isDark ? 1 : 0.35,
            transform: [{ scale: isDark ? 1.06 : 0.86 }, { rotate: isDark ? '0deg' : '24deg' }],
            transition: `opacity 0.35s ease, transform ${durationStr} cubic-bezier(0.16, 1, 0.3, 1)`,
          } : {
            opacity: isDark ? 1 : 0.4,
          }
        ]}
      >
        <Text style={[styles.iconText, isSmall && styles.iconTextSmall]}>
          🌙
        </Text>
      </View>

      {showLabel && (
        <Text style={[
          styles.labelText,
          isDark ? styles.labelTextDark : styles.labelTextLight
        ]}>
          {isDark ? 'Dark' : 'Day'}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 3,
    borderRadius: 999,
    borderWidth: 1,
    cursor: Platform.OS === 'web' ? 'pointer' : undefined,
    userSelect: 'none',
    ...(Platform.OS === 'web' ? {
      transition: 'background-color 0.35s ease, border-color 0.35s ease',
    } : {}),
  },
  containerLight: {
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
  },
  containerDark: {
    backgroundColor: '#1e293b',
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  containerSmall: {
    padding: 2,
  },
  slidingPill: {
    position: 'absolute',
    borderRadius: 999,
    zIndex: 1,
  },
  slidingPillDefault: {
    top: 3,
    left: 3,
    width: 28,
    height: 28,
  },
  slidingPillSmall: {
    top: 2,
    left: 2,
    width: 24,
    height: 24,
  },
  pillLight: {
    backgroundColor: '#ffffff',
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 2px 6px rgba(0, 0, 0, 0.12)',
    } : {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.12,
      shadowRadius: 4,
      elevation: 2,
    }),
  },
  pillDark: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.45)',
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 2px 8px rgba(168, 85, 247, 0.3)',
    } : {
      shadowColor: '#a855f7',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 3,
    }),
  },
  iconSlot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  iconSlotSmall: {
    width: 24,
    height: 24,
    borderRadius: 12,
    zIndex: 2,
  },
  iconText: {
    fontSize: 14,
  },
  iconTextSmall: {
    fontSize: 12,
  },
  labelText: {
    fontSize: 12,
    fontWeight: '600',
    marginHorizontal: 8,
    zIndex: 2,
  },
  labelTextLight: {
    color: '#475569',
  },
  labelTextDark: {
    color: '#cbd5e1',
  },
});
