import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, Platform, TouchableOpacity, Image } from 'react-native';
import { Feather } from '@expo/vector-icons';

/**
 * ThreeDStatCard (Dashboard Unified Design)
 * Matches the exact visual styling, dark-mode materials, hover lift animation,
 * and sleek typography of the Platform Performance cards in the StreamSync dashboard.
 */
export default function ThreeDStatCard({
  title = '',
  metricType = 'reach',
  surfaces = [],
  staggerDelay = 0,
  intervalMs = 4500,
  isDark = true,
  colors = {},
  isAutoRotate = false,
  onSurfaceChange = null,
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [isFlipping, setIsFlipping] = useState(false);

  // Safe fallback if surfaces is empty
  const safeSurfaces = useMemo(() => {
    return surfaces.length > 0 ? surfaces : [
      {
        platformName: 'All Platforms',
        platformKey: 'all',
        brandColor: '#6366f1',
        brandBg: 'rgba(99, 102, 241, 0.15)',
        value: '0',
        label: title.toUpperCase(),
        caption: 'Rolling 30-day reach & impressions',
        trend: 'Live'
      }
    ];
  }, [surfaces, title]);

  const flipUpward = () => {
    if (isFlipping) return;
    setIsFlipping(true);
    setTimeout(() => {
      setCurrentIndex(prev => {
        const next = (prev + 1) % safeSurfaces.length;
        if (onSurfaceChange) onSurfaceChange(next);
        return next;
      });
      setIsFlipping(false);
    }, 160);
  };

  const activeSurface = safeSurfaces[currentIndex % safeSurfaces.length] || safeSurfaces[0];

  const PLATFORM_LOGOS = {
    'all': null,
    'yt': 'https://img.icons8.com/color/512/youtube-play.png',
    'ig': 'https://img.icons8.com/fluent/512/instagram-new.png',
    'x': 'https://img.icons8.com/ios-filled/512/twitterx--v1.png',
    'twitch': 'https://img.icons8.com/color/512/twitch--v1.png',
    'fb': 'https://img.icons8.com/color/512/facebook-new.png',
    'in': 'https://img.icons8.com/color/512/linkedin.png'
  };

  const logoUrl = PLATFORM_LOGOS[activeSurface.platformKey] || null;

  if (Platform.OS === 'web') {
    return (
      <div
        onClick={flipUpward}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          flex: '1 1 240px',
          minWidth: 240,
          borderRadius: 20,
          backgroundColor: colors.cardBg || (isDark ? '#0c1424' : '#ffffff'),
          border: isDark 
            ? `1px solid ${isHovered ? activeSurface.brandColor : 'rgba(255, 255, 255, 0.08)'}` 
            : `1px solid ${isHovered ? activeSurface.brandColor : colors.border || '#f0f0f0'}`,
          borderTop: `3px solid ${activeSurface.brandColor}`,
          boxShadow: isDark
            ? (isHovered 
                ? `0 16px 40px rgba(0, 0, 0, 0.65), 0 0 20px ${activeSurface.brandColor}35` 
                : '0 8px 30px rgba(0, 0, 0, 0.55)')
            : (isHovered 
                ? `0 16px 36px ${activeSurface.brandColor}20` 
                : '0px 8px 24px rgba(0, 0, 0, 0.04)'),
          transform: isHovered ? 'translateY(-4px)' : 'translateY(0)',
          transition: 'transform 0.22s cubic-bezier(0.2, 0.9, 0.3, 1), box-shadow 0.22s ease, border-color 0.22s ease',
          cursor: 'pointer',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          boxSizing: 'border-box',
          position: 'relative',
          overflow: 'hidden',
          minHeight: 175,
        }}
      >
        {/* Animated Card Content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            height: '100%',
            opacity: isFlipping ? 0.2 : 1,
            transform: isFlipping ? 'translateY(-8px)' : 'translateY(0)',
            transition: 'opacity 0.16s ease, transform 0.16s ease',
          }}
        >
          {/* Top Row: Metric Label & Platform Brand Pill */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 12 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: isDark ? '#94a3b8' : '#64748b',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              }}
            >
              {activeSurface.label || title}
            </span>

            {/* Platform Badge matching Dashboard performance pills */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '3px 10px',
                borderRadius: 12,
                backgroundColor: activeSurface.brandBg || 'rgba(99, 102, 241, 0.15)',
                border: `1px solid ${activeSurface.brandColor}40`,
              }}
            >
              {logoUrl ? (
                <img src={logoUrl} alt="" style={{ width: 14, height: 14, objectFit: 'contain' }} />
              ) : (
                <div style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: activeSurface.brandColor }} />
              )}
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: activeSurface.brandColor,
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                }}
              >
                {activeSurface.platformName}
              </span>
            </div>
          </div>

          {/* Center: Large Numerical Value */}
          <div style={{ margin: '4px 0' }}>
            <div
              style={{
                fontSize: String(activeSurface.value ?? '0').length > 10 ? 28 : 34,
                fontWeight: 800,
                color: isDark ? '#ffffff' : '#0f172a',
                letterSpacing: '-0.02em',
                lineHeight: 1.1,
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              }}
            >
              {activeSurface.value ?? '0'}
            </div>
            <div
              style={{
                fontSize: 12,
                color: isDark ? '#64748b' : '#94a3b8',
                marginTop: 4,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              }}
            >
              {activeSurface.caption}
            </div>
          </div>

          {/* Bottom Row: Trend & Platform Pagination Indicator */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginTop: 8 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: '#10b981',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              }}
            >
              ↑ {activeSurface.trend || 'Live'}
            </span>

            {/* Pagination Indicators matching Dashboard aesthetic */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              {safeSurfaces.map((_, dotIdx) => (
                <div
                  key={dotIdx}
                  style={{
                    width: dotIdx === (currentIndex % safeSurfaces.length) ? 14 : 5,
                    height: 5,
                    borderRadius: 3,
                    backgroundColor: dotIdx === (currentIndex % safeSurfaces.length)
                      ? activeSurface.brandColor
                      : (isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.15)'),
                    transition: 'all 0.25s ease',
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Mobile Native
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={flipUpward}
      style={[
        styles.cardContainer,
        {
          backgroundColor: colors.cardBg || (isDark ? '#0c1424' : '#ffffff'),
          borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : colors.border || '#f0f0f0',
          borderTopColor: activeSurface.brandColor,
        }
      ]}
    >
      <View style={styles.topRow}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>{activeSurface.label}</Text>
        <View style={[styles.badge, { backgroundColor: activeSurface.brandBg, borderColor: `${activeSurface.brandColor}40` }]}>
          <Text style={[styles.badgeText, { color: activeSurface.brandColor }]}>{activeSurface.platformName}</Text>
        </View>
      </View>

      <View style={styles.valueSection}>
        <Text style={[styles.value, { color: colors.textPrimary }]}>{activeSurface.value}</Text>
        <Text style={[styles.caption, { color: colors.textMuted }]}>{activeSurface.caption}</Text>
      </View>

      <View style={styles.bottomRow}>
        <Text style={styles.trend}>↑ {activeSurface.trend || 'Live'}</Text>
        <View style={styles.dotsRow}>
          {safeSurfaces.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor: i === (currentIndex % safeSurfaces.length)
                    ? activeSurface.brandColor
                    : (isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.15)'),
                  width: i === (currentIndex % safeSurfaces.length) ? 14 : 5,
                }
              ]}
            />
          ))}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    flex: 1,
    minWidth: 240,
    height: 175,
    borderRadius: 20,
    borderWidth: 1,
    borderTopWidth: 3,
    padding: 20,
    justifyContent: 'space-between',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  valueSection: {
    marginVertical: 4,
  },
  value: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  caption: {
    fontSize: 12,
    marginTop: 2,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  trend: {
    fontSize: 11,
    fontWeight: '700',
    color: '#10b981',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dot: {
    height: 5,
    borderRadius: 3,
  },
});
