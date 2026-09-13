import React from 'react';
import { StyleSheet, TouchableOpacity, View, Text, Platform } from 'react-native';
import { useTheme } from '../context/ThemeContext';

export default function ThemeToggle({ style, showLabel = false, size = 'default' }) {
  const { theme, isDark, toggleTheme } = useTheme();

  const isSmall = size === 'small';

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={toggleTheme}
      style={[
        styles.container,
        isDark ? styles.containerDark : styles.containerLight,
        isSmall && styles.containerSmall,
        style
      ]}
      accessibilityRole="button"
      accessibilityLabel={isDark ? "Switch to Day Mode" : "Switch to Night Mode"}
      title={isDark ? "Switch to Day Mode" : "Switch to Night Mode"}
    >
      {/* Sun side (Day) */}
      <View style={[
        styles.iconSlot,
        isSmall && styles.iconSlotSmall,
        !isDark && styles.activeSlotLight
      ]}>
        <Text style={[styles.iconText, isSmall && styles.iconTextSmall]}>
          ☀️
        </Text>
      </View>

      {/* Moon side (Night) */}
      <View style={[
        styles.iconSlot,
        isSmall && styles.iconSlotSmall,
        isDark && styles.activeSlotDark
      ]}>
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
    flexDirection: 'row',
    alignItems: 'center',
    padding: 3,
    borderRadius: 999,
    borderWidth: 1,
    cursor: Platform.OS === 'web' ? 'pointer' : undefined,
    userSelect: 'none',
    ...(Platform.OS === 'web' ? {
      transition: 'background-color 0.25s ease, border-color 0.25s ease',
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
  iconSlot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? {
      transition: 'background-color 0.2s ease, transform 0.2s ease',
    } : {}),
  },
  iconSlotSmall: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  activeSlotLight: {
    backgroundColor: '#ffffff',
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 2px 6px rgba(0, 0, 0, 0.1)',
    } : {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    }),
  },
  activeSlotDark: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.4)',
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 2px 8px rgba(168, 85, 247, 0.25)',
    } : {
      shadowColor: '#a855f7',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 3,
    }),
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
  },
  labelTextLight: {
    color: '#475569',
  },
  labelTextDark: {
    color: '#cbd5e1',
  },
});
