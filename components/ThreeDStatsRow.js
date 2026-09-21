import React, { useState, useMemo } from 'react';
import { StyleSheet, View, Text, Platform, TouchableOpacity } from 'react-native';
import ThreeDStatCard from './ThreeDStatCard';
import { normalizePlatformKey, normalizePlatformName } from '../lib/api';

const PLATFORM_META = {
  all: {
    name: 'All Platforms',
    color: '#6366f1',
    bg: 'rgba(99, 102, 241, 0.15)',
    captionReach: 'Rolling 30-day reach & impressions',
    captionAudience: 'Active community & subscribers',
    captionEngage: 'Weighted cross-platform interactions',
    captionRevenue: 'Estimated monthly creator value',
  },
  yt: {
    name: 'YouTube',
    color: '#FF0000',
    bg: 'rgba(255, 0, 0, 0.15)',
    captionReach: 'Watch hours & impressions',
    captionAudience: 'Channel subscribers',
    captionEngage: 'Likes, comments & CTR',
    captionRevenue: 'Estimated AdSense revenue',
  },
  ig: {
    name: 'Instagram',
    color: '#E1306C',
    bg: 'rgba(225, 48, 108, 0.15)',
    captionReach: 'Accounts reached & impressions',
    captionAudience: 'Profile followers',
    captionEngage: 'Saves, shares & comments',
    captionRevenue: 'Brand partnership valuation',
  },
  x: {
    name: 'X (Twitter)',
    color: '#38bdf8',
    bg: 'rgba(56, 189, 248, 0.15)',
    captionReach: 'Post impressions & expands',
    captionAudience: 'Followers on X',
    captionEngage: 'Reposts, quotes & replies',
    captionRevenue: 'Creator ad revenue share',
  },
  twitch: {
    name: 'Twitch',
    color: '#9146FF',
    bg: 'rgba(145, 70, 255, 0.15)',
    captionReach: 'Stream hours & VOD views',
    captionAudience: 'Channel followers',
    captionEngage: 'Chat velocity & clips',
    captionRevenue: 'Subscriptions & bits',
  },
  fb: {
    name: 'Facebook',
    color: '#1877F2',
    bg: 'rgba(24, 119, 242, 0.15)',
    captionReach: 'Page & video impressions',
    captionAudience: 'Page followers & likes',
    captionEngage: 'Reactions, comments & shares',
    captionRevenue: 'In-stream stars & bonuses',
  },
  in: {
    name: 'LinkedIn',
    color: '#0A66C2',
    bg: 'rgba(10, 102, 194, 0.15)',
    captionReach: 'Post & member impressions',
    captionAudience: 'Connections & followers',
    captionEngage: 'Reactions, comments & reposts',
    captionRevenue: 'Consulting & advisory value',
  },
};

/**
 * ThreeDStatsRow
 * Houses the 4 upward-flipping 3D prism cards in the first row of the dashboard.
 * Dynamically builds surfaces corresponding to all live connected platforms plus unified overview.
 */
export default function ThreeDStatsRow({
  data = {},
  connectedPlatforms = [],
  colors = {},
  isDark = true,
  intervalMs = 4500,
}) {
  const [isAutoRotate, setIsAutoRotate] = useState(false);
  const [activePlatformIndex, setActivePlatformIndex] = useState(0);

  // Determine active platforms
  const activeKeys = useMemo(() => {
    const list = Array.isArray(connectedPlatforms) ? connectedPlatforms.map(p => normalizePlatformKey(p)).filter(Boolean) : [];
    
    // Also include any platforms present in data.platformStats
    if (data?.platformStats) {
      Object.keys(data.platformStats).forEach(k => {
        const norm = normalizePlatformKey(k);
        if (norm && !list.includes(norm) && ['yt', 'ig', 'x', 'twitch', 'fb', 'in'].includes(norm)) {
          list.push(norm);
        }
      });
    }

    // If no platforms connected yet, provide default major platforms for a full 3D prism experience
    if (list.length === 0) {
      return ['yt', 'ig', 'x'];
    }

    return Array.from(new Set(list));
  }, [connectedPlatforms, data?.platformStats]);

  // Build the 4 surface decks for each of the 4 cards
  const { reachSurfaces, audienceSurfaces, engagementSurfaces, revenueSurfaces } = useMemo(() => {
    const reach = [];
    const audience = [];
    const engagement = [];
    const revenue = [];

    // Surface 0: Unified / All Platforms
    const unifiedMeta = PLATFORM_META.all;
    const totalViews = data?.overview?.totalViews || 0;
    const totalFollowers = data?.overview?.totalFollowers || 0;
    const engagementRate = data?.overview?.engagementRate || '0.0%';
    const estimatedRev = data?.overview?.estimatedRevenue ?? 0;

    reach.push({
      platformName: unifiedMeta.name,
      platformKey: 'all',
      brandColor: unifiedMeta.color,
      brandBg: unifiedMeta.bg,
      label: '30-Day Reach',
      value: totalViews.toLocaleString(),
      caption: unifiedMeta.captionReach,
      trend: totalViews > 0 ? 'Live 30d' : '—',
    });

    audience.push({
      platformName: unifiedMeta.name,
      platformKey: 'all',
      brandColor: unifiedMeta.color,
      brandBg: unifiedMeta.bg,
      label: 'Total Community',
      value: totalFollowers.toLocaleString(),
      caption: unifiedMeta.captionAudience,
      trend: totalFollowers > 0 ? 'Active' : '—',
    });

    engagement.push({
      platformName: unifiedMeta.name,
      platformKey: 'all',
      brandColor: unifiedMeta.color,
      brandBg: unifiedMeta.bg,
      label: 'True Engagement',
      value: engagementRate,
      caption: unifiedMeta.captionEngage,
      trend: parseFloat(engagementRate || 0) > 0 ? 'Live Rate' : '—',
    });

    revenue.push({
      platformName: unifiedMeta.name,
      platformKey: 'all',
      brandColor: unifiedMeta.color,
      brandBg: unifiedMeta.bg,
      label: 'Creator Value',
      value: estimatedRev < 0 ? 'Unmonetized' : `$${Number(estimatedRev).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
      caption: estimatedRev < 0 ? 'Grow audience to unlock' : unifiedMeta.captionRevenue,
      trend: 'Est. Run-Rate',
    });

    // Subsequent Surfaces: Each active platform
    activeKeys.forEach((key) => {
      const meta = PLATFORM_META[key] || {
        name: normalizePlatformName(key),
        color: '#6366f1',
        bg: 'rgba(99, 102, 241, 0.15)',
        captionReach: '30-day reach & impressions',
        captionAudience: 'Platform audience',
        captionEngage: 'Active interactions',
        captionRevenue: 'Platform valuation',
      };

      const pStats = data?.platformStats?.[meta.name] || 
                     data?.platformStats?.[key] || 
                     data?.platformStats?.[normalizePlatformName(key)] || {};

      const pViews = pStats.views || (pStats.rawViews ? Number(pStats.rawViews).toLocaleString() : '0');
      const pFollowers = pStats.followers || (pStats.rawFollowers ? Number(pStats.rawFollowers).toLocaleString() : '0');
      const pEngage = pStats.engage || (pStats.rawEngage ? Number(pStats.rawEngage).toFixed(1) + '%' : '0.0%');
      const pRevVal = pStats.revenue;
      let pRevStr = '$0.00';
      if (pRevVal > 0) {
        pRevStr = `$${Number(pRevVal).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
      } else if (pRevVal === -1) {
        pRevStr = 'Unmonetized';
      }

      reach.push({
        platformName: meta.name,
        platformKey: key,
        brandColor: meta.color,
        brandBg: meta.bg,
        label: `${meta.name} Reach`,
        value: pViews,
        caption: meta.captionReach,
        trend: pViews !== '0' ? 'Live 30d' : 'Connected',
      });

      audience.push({
        platformName: meta.name,
        platformKey: key,
        brandColor: meta.color,
        brandBg: meta.bg,
        label: `${meta.name} Audience`,
        value: pFollowers,
        caption: meta.captionAudience,
        trend: pFollowers !== '0' ? 'Active' : 'Connected',
      });

      engagement.push({
        platformName: meta.name,
        platformKey: key,
        brandColor: meta.color,
        brandBg: meta.bg,
        label: `${meta.name} Engage`,
        value: pEngage,
        caption: meta.captionEngage,
        trend: parseFloat(pEngage || 0) > 0 ? 'Live Rate' : 'Tracked',
      });

      revenue.push({
        platformName: meta.name,
        platformKey: key,
        brandColor: meta.color,
        brandBg: meta.bg,
        label: `${meta.name} Value`,
        value: pRevStr,
        caption: meta.captionRevenue,
        trend: 'Est. Run-Rate',
      });
    });

    return {
      reachSurfaces: reach,
      audienceSurfaces: audience,
      engagementSurfaces: engagement,
      revenueSurfaces: revenue,
    };
  }, [data, activeKeys]);

  const mono = Platform.OS === 'web' ? 'monospace' : undefined;

  return (
    <View style={styles.container}>
      {/* First Row Stat Cards (Unified Dashboard Design) */}
      <View style={styles.cardsRow}>
        {/* Card 1: Total Reach */}
        <ThreeDStatCard
          title="30-Day Reach"
          metricType="reach"
          surfaces={reachSurfaces}
          staggerDelay={0}
          intervalMs={intervalMs}
          isDark={isDark}
          colors={colors}
          isAutoRotate={isAutoRotate}
          onSurfaceChange={setActivePlatformIndex}
        />

        {/* Card 2: Audience */}
        <ThreeDStatCard
          title="Audience"
          metricType="audience"
          surfaces={audienceSurfaces}
          staggerDelay={140}
          intervalMs={intervalMs}
          isDark={isDark}
          colors={colors}
          isAutoRotate={isAutoRotate}
        />

        {/* Card 3: Engagement */}
        <ThreeDStatCard
          title="Engagement"
          metricType="engagement"
          surfaces={engagementSurfaces}
          staggerDelay={280}
          intervalMs={intervalMs}
          isDark={isDark}
          colors={colors}
          isAutoRotate={isAutoRotate}
        />

        {/* Card 4: Revenue */}
        <ThreeDStatCard
          title="Revenue"
          metricType="revenue"
          surfaces={revenueSurfaces}
          staggerDelay={420}
          intervalMs={intervalMs}
          isDark={isDark}
          colors={colors}
          isAutoRotate={isAutoRotate}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 28,
  },
  hudBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  hudLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  pulseBeacon: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  hudTitle: {
    fontSize: 11,
    fontWeight: '800',
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
    letterSpacing: 1,
  },
  modeTag: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  modeTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#818cf8',
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
    letterSpacing: 0.5,
  },
  hudRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ctrlBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  ctrlBtnText: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
    letterSpacing: 0.5,
  },
  cardsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    justifyContent: 'space-between',
  },
});
