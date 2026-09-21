import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, Platform, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';

/**
 * ThreeDStatCard (Option A - Native CSS 3D Transforms)
 * Renders an ultra-crisp, hardware-accelerated 3D geometric prism using native CSS3 3D transforms.
 * Delivers 100% native font sharpness, high contrast, and smooth upward rolling on click.
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

  const N = Math.max(3, safeSurfaces.length);
  const facetHeight = 170;
  // Incircle radius for regular polygon: R = (facetHeight / 2) / tan(PI / N)
  const R = Math.round((facetHeight / 2) / Math.tan(Math.PI / N));
  const angleStep = 360 / N;

  const flipUpward = () => {
    setCurrentIndex(prev => {
      const next = (prev + 1) % safeSurfaces.length;
      if (onSurfaceChange) onSurfaceChange(next);
      return next;
    });
  };

  const activeSurface = safeSurfaces[currentIndex % safeSurfaces.length] || safeSurfaces[0];
  const currentRotationDeg = -currentIndex * angleStep;

  if (Platform.OS === 'web') {
    return (
      <div
        onClick={flipUpward}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          flex: '1 1 240px',
          minWidth: 240,
          height: facetHeight,
          perspective: 1100,
          cursor: 'pointer',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          position: 'relative',
        }}
      >
        {/* 3D Prism Rotator */}
        <div
          style={{
            width: '100%',
            height: '100%',
            position: 'relative',
            transformStyle: 'preserve-3d',
            WebkitTransformStyle: 'preserve-3d',
            transform: `translateZ(-${R}px) rotateX(${currentRotationDeg}deg)`,
            transition: 'transform 0.65s cubic-bezier(0.2, 0.9, 0.3, 1.15)',
            boxSizing: 'border-box',
          }}
        >
          {safeSurfaces.map((surf, idx) => {
            const angleDeg = idx * angleStep;
            const isFront = idx === (currentIndex % safeSurfaces.length);

            return (
              <div
                key={idx}
                style={{
                  position: 'absolute',
                  width: '100%',
                  height: facetHeight,
                  top: 0,
                  left: 0,
                  transform: `rotateX(${angleDeg}deg) translateZ(${R}px)`,
                  WebkitTransform: `rotateX(${angleDeg}deg) translateZ(${R}px)`,
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                  borderRadius: 16,
                  backgroundColor: isDark ? '#0f172a' : '#ffffff',
                  border: isDark 
                    ? `1.5px solid ${isHovered && isFront ? surf.brandColor : 'rgba(255, 255, 255, 0.1)'}` 
                    : `1.5px solid ${isHovered && isFront ? surf.brandColor : 'rgba(0, 0, 0, 0.08)'}`,
                  boxShadow: isDark 
                    ? (isFront ? `0 8px 30px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.08)` : 'none')
                    : (isFront ? `0 8px 24px rgba(0, 0, 0, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.9)` : 'none'),
                  padding: '20px 22px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxSizing: 'border-box',
                  overflow: 'hidden',
                }}
              >
                {/* Top Brand Accent Line */}
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 20,
                    right: 20,
                    height: 3,
                    background: surf.brandColor,
                    borderRadius: '0 0 4px 4px',
                    opacity: 0.85,
                  }}
                />

                {/* Top Row: Label & Platform Badge */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
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
                    {surf.label || title}
                  </span>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '3px 10px',
                      borderRadius: 12,
                      backgroundColor: surf.brandBg || 'rgba(99, 102, 241, 0.15)',
                      border: `1px solid ${surf.brandColor}40`,
                    }}
                  >
                    <div
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: surf.brandColor,
                      }}
                    />
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: surf.brandColor,
                        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                      }}
                    >
                      {surf.platformName}
                    </span>
                  </div>
                </div>

                {/* Middle: Big Value */}
                <div style={{ margin: '6px 0 2px 0' }}>
                  <div
                    style={{
                      fontSize: String(surf.value ?? '0').length > 10 ? 30 : 36,
                      fontWeight: 800,
                      color: isDark ? '#ffffff' : '#0f172a',
                      letterSpacing: '-0.02em',
                      lineHeight: 1.1,
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    }}
                  >
                    {surf.value ?? '0'}
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
                    {surf.caption}
                  </div>
                </div>

                {/* Bottom Row: Trend & Platform Indicator Dots */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
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
                    ↑ {surf.trend || 'Live'}
                  </span>

                  {/* Surface Pagination Dots */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    {safeSurfaces.map((_, dotIdx) => (
                      <div
                        key={dotIdx}
                        style={{
                          width: dotIdx === (idx % safeSurfaces.length) ? 14 : 5,
                          height: 5,
                          borderRadius: 3,
                          backgroundColor: dotIdx === (idx % safeSurfaces.length)
                            ? surf.brandColor
                            : (isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.15)'),
                          transition: 'all 0.3s ease',
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Mobile Native Fallback
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={flipUpward}
      style={[
        styles.cardContainer,
        {
          backgroundColor: isDark ? '#0f172a' : '#ffffff',
          borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
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
    height: 170,
    borderRadius: 16,
    borderWidth: 1.5,
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
    fontSize: 34,
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
