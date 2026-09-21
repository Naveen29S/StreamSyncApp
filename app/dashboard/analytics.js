import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Platform, Image, ActivityIndicator } from 'react-native';
import { supabase } from '../../lib/supabase';
import { fetchPlatformData, syncPlatformData, isPlatformMatch, normalizePlatformKey } from '../../lib/api';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import ConnectModal from '../../components/ConnectModal';
import { useTheme } from '../../context/ThemeContext';
import { useRefresh } from '../../context/RefreshContext';

function formatCompactNumber(num) {
  if (num === null || num === undefined || isNaN(num)) return '0';
  const n = Number(num);
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  if (abs >= 1000000) {
    return sign + (abs / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (abs >= 1000) {
    return sign + (abs / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return n.toLocaleString();
}

const PLATFORM_PREVIEWS = [
  { 
    key: 'all', 
    name: 'All Platforms', 
    color: '#6366f1', 
    bg: 'rgba(99, 102, 241, 0.12)', 
    icon: 'layers',
    logo: null 
  },
  { 
    key: 'yt', 
    name: 'YouTube', 
    color: '#FF0000', 
    bg: 'rgba(255, 0, 0, 0.12)', 
    icon: 'youtube', 
    logo: 'https://img.icons8.com/color/512/youtube-play.png' 
  },
  { 
    key: 'ig', 
    name: 'Instagram', 
    color: '#E1306C', 
    bg: 'rgba(225, 48, 108, 0.12)', 
    icon: 'instagram', 
    logo: 'https://img.icons8.com/fluent/512/instagram-new.png' 
  },
  { 
    key: 'x', 
    name: 'X (Twitter)', 
    color: '#1DA1F2', 
    bg: 'rgba(29, 161, 242, 0.12)', 
    icon: 'twitter', 
    logo: 'https://img.icons8.com/ios-filled/512/twitterx--v1.png' 
  },
  { 
    key: 'twitch', 
    name: 'Twitch', 
    color: '#9146FF', 
    bg: 'rgba(145, 70, 255, 0.12)', 
    icon: 'tv', 
    logo: 'https://img.icons8.com/color/512/twitch--v1.png' 
  },
  { 
    key: 'fb', 
    name: 'Facebook', 
    color: '#1877F2', 
    bg: 'rgba(24, 119, 242, 0.12)', 
    icon: 'facebook', 
    logo: 'https://img.icons8.com/color/512/facebook-new.png' 
  },
  { 
    key: 'in', 
    name: 'LinkedIn', 
    color: '#0A66C2', 
    bg: 'rgba(10, 102, 194, 0.12)', 
    icon: 'linkedin', 
    logo: 'https://img.icons8.com/color/512/linkedin.png' 
  }
];

const CYCLE_INTERVAL_MS = 6000;
const TICK_MS = 100;

export default function AnalyticsScreen() {
  const { colors, isDark } = useTheme();
  const { registerRefreshListener } = useRefresh();
  const [timeframe, setTimeframe] = useState('7D');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connectedPlatforms, setConnectedPlatforms] = useState([]);
  const [connectModalVisible, setConnectModalVisible] = useState(false);
  const router = useRouter();

  // Platform selection state (clean manual switching, zero auto-rotation)
  const [selectedPlatformKey, setSelectedPlatformKey] = useState('all');

  const loadData = async (isSilent = false) => {
    if (!isSilent && !data) {
      setLoading(true);
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setLoading(false);
      return;
    }
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('connected_platforms, api_keys')
      .eq('id', session.user.id)
      .maybeSingle();

    const identities = session.user?.identities || [];
    const providerToPlatformMap = { 
      'google': 'yt', 
      'facebook': 'fb', 
      'twitter': 'x', 
      'x': 'x', 
      'linkedin_oidc': 'in', 
      'linkedin': 'in' 
    };
    const identityPlatforms = identities.map(id => providerToPlatformMap[id.provider]).filter(Boolean);
    const xIdentity = identities.find(id => id.provider === 'x' || id.provider === 'twitter');
    if (xIdentity) {
      identityPlatforms.push('x');
    }

    const profileKeys = profile?.api_keys || {};
    const keyPlatforms = [];
    if (profileKeys.youtube || profileKeys.yt || profileKeys.youtube_channel_id || profileKeys.youtube_token) {
      keyPlatforms.push('yt');
    }
    if (profileKeys.twitch || profileKeys.twitch_username || profileKeys.twitch_login || profileKeys.twitch_channel_id) {
      keyPlatforms.push('twitch');
    }
    if (profileKeys.x || profileKeys.x_username || profileKeys.twitter_username || profileKeys.twitter || profileKeys.x_bearer_token || xIdentity) {
      keyPlatforms.push('x');
    }
    if (profileKeys.instagram || profileKeys.ig || profileKeys.ig_username || profileKeys.instagram_username || profileKeys.ig_token) {
      keyPlatforms.push('ig');
    }
    if (profileKeys.facebook || profileKeys.fb || profileKeys.fb_page || profileKeys.fb_token) {
      keyPlatforms.push('fb');
    }
    if (profileKeys.linkedin || profileKeys.in || profileKeys.in_profile || profileKeys.in_token) {
      keyPlatforms.push('in');
    }

    const { data: anRows } = await supabase
      .from('analytics')
      .select('platform')
      .eq('user_id', session.user.id);
    const anPlatforms = (anRows || []).map(r => normalizePlatformKey(r.platform)).filter(Boolean);

    const rawList = [
      ...(profile?.connected_platforms || []),
      ...identityPlatforms,
      ...keyPlatforms,
      ...anPlatforms
    ];
    const platforms = Array.from(new Set(rawList.map(p => normalizePlatformKey(p)).filter(Boolean)));
    setConnectedPlatforms(platforms);
    
    const platformData = await fetchPlatformData(platforms);
    setData(platformData);
    setLoading(false);

    if (platforms.length > 0) {
      syncPlatformData(platforms);
    }
  };

  useEffect(() => {
    let isMounted = true;
    let subscription = null;

    loadData(false);

    // Subscribe to real-time manual or frequent auto refreshes (silently in background)
    const unregisterRefresh = registerRefreshListener(async () => {
      if (isMounted) await loadData(true);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted || !session) return;

      const channelName = `analytics-changes-${session.user.id}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const channel = supabase.channel(channelName)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${session.user.id}` }, () => {
          if (isMounted) loadData(true);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'analytics', filter: `user_id=eq.${session.user.id}` }, () => {
          if (isMounted) loadData(true);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'content', filter: `user_id=eq.${session.user.id}` }, () => {
          if (isMounted) loadData(true);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'comments', filter: `user_id=eq.${session.user.id}` }, () => {
          if (isMounted) loadData(true);
        });

      if (!isMounted) {
        supabase.removeChannel(channel);
        return;
      }

      subscription = channel;
      channel.subscribe();
    });

    return () => {
      isMounted = false;
      unregisterRefresh?.();
      if (subscription) {
        supabase.removeChannel(subscription);
        subscription = null;
      }
    };
  }, [timeframe]);

  const handleSelectPlatform = (key) => {
    setSelectedPlatformKey(key);
  };

  if (loading && !data) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bodyBg }]}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={{ marginTop: 16, color: colors.textSecondary }}>Crunching the numbers...</Text>
      </View>
    );
  }

  // Empty State if no platforms or analytics data exist
  const hasAnalyticsData = Boolean(
    connectedPlatforms.length > 0 ||
    (data?.overview?.totalFollowers || 0) > 0 ||
    (data?.overview?.totalViews || 0) > 0 ||
    (data?.platformStats && Object.keys(data.platformStats).length > 0)
  );

  if (!hasAnalyticsData) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 32, backgroundColor: colors.bodyBg }]}>
        <Feather name="bar-chart-2" size={64} color={colors.textSecondary} style={{ marginBottom: 24, opacity: 0.5 }} />
        <Text style={[styles.pageTitle, { color: colors.textPrimary }]}>No Data Available</Text>
        <Text style={[styles.pageSubtitle, { textAlign: 'center', marginBottom: 32, maxWidth: 400, color: colors.textSecondary }]}>
          Connect at least one platform (like YouTube or Instagram) to start seeing deep analytics, audience demographics, and growth trends.
        </Text>
        <TouchableOpacity 
          style={{ backgroundColor: colors.btnPrimaryBg, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 }}
          onPress={() => setConnectModalVisible(true)}
        >
          <Text style={{ color: colors.btnPrimaryText, fontWeight: '600', fontSize: 16 }}>Connect Platforms →</Text>
        </TouchableOpacity>

        <ConnectModal
          visible={connectModalVisible}
          onClose={() => setConnectModalVisible(false)}
          onSuccess={loadData}
        />
      </View>
    );
  }

  // ─── Resolve Currently Selected Platform & Specific Metrics ───
  const currentPreview = PLATFORM_PREVIEWS.find(p => p.key === selectedPlatformKey) || PLATFORM_PREVIEWS[0];
  const isAll = selectedPlatformKey === 'all';

  const platformStatsObj = data?.platformStats?.[currentPreview.name] || data?.platformStats?.[currentPreview.key];
  const isPlatformConnected = isAll
    ? connectedPlatforms.length > 0
    : connectedPlatforms.some(p => isPlatformMatch(p, currentPreview.key)) || Boolean(platformStatsObj?.rawFollowers !== undefined || platformStatsObj?.rawViews !== undefined);

  // Audience
  const displayAudience = isAll
    ? formatCompactNumber(data?.overview?.totalFollowers || 0)
    : (platformStatsObj ? formatCompactNumber(platformStatsObj.rawFollowers) : (isPlatformConnected ? '0' : '—'));

  // Reach (Views)
  const displayReach = isAll
    ? formatCompactNumber(data?.overview?.totalViews || 0)
    : (platformStatsObj ? formatCompactNumber(platformStatsObj.rawViews) : (isPlatformConnected ? '0' : '—'));

  // Engagement
  const displayEngagement = isAll
    ? (data?.overview?.engagementRate || '0.0%')
    : (platformStatsObj?.engage || (isPlatformConnected ? '0.0%' : '—'));

  // Revenue
  const displayRevenue = isAll
    ? (data?.overview?.estimatedRevenue < 0 
        ? 'Unmonetized' 
        : `$${Number(data?.overview?.estimatedRevenue || 0).toLocaleString(undefined, { minimumFractionDigits: 0 })}`)
    : (platformStatsObj 
        ? (platformStatsObj.revenue > 0 ? `$${Number(platformStatsObj.revenue).toLocaleString()}` : 'Unmonetized')
        : 'Unmonetized');

  // Filtered Content
  const filteredContent = isAll
    ? (data?.topContent || [])
    : (data?.topContent || []).filter(c => isPlatformMatch(c.platformKey, currentPreview.key) || isPlatformMatch(c.platform, currentPreview.name));

  // Chart values tailored for the active platform
  const chartItems = (data?.chartData && data.chartData.length > 0)
    ? data.chartData
    : [
        { day: 'Mon', val: 40 },
        { day: 'Tue', val: 55 },
        { day: 'Wed', val: 70 },
        { day: 'Thu', val: 60 },
        { day: 'Fri', val: 85 },
        { day: 'Sat', val: 90 },
        { day: 'Sun', val: 75 },
      ];

  const PLATFORM_COLORS = {
    'YouTube': '#FF0000',
    'Twitch': '#9146FF',
    'Instagram': '#E1306C',
    'X (Twitter)': isDark ? '#ffffff' : '#000000',
    'Facebook': '#1877F2',
    'LinkedIn': '#0A66C2'
  };
  
  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bodyBg }]} contentContainerStyle={styles.scrollContent}>
      
      {/* ─── Header & Actions ─── */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.pageTitle, { color: colors.textPrimary }]}>Analytics</Text>
          <Text style={[styles.pageSubtitle, { color: colors.textSecondary }]}>Deep dive into your performance metrics</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={[styles.timeframeToggle, { backgroundColor: colors.badgeBg }]}>
            {['7D', '30D', '90D', 'YTD'].map(t => (
              <TouchableOpacity 
                key={t} 
                style={[styles.timeBtn, timeframe === t && [styles.timeBtnActive, { backgroundColor: colors.cardBg }]]}
                onPress={() => setTimeframe(t)}
              >
                <Text style={[styles.timeBtnText, { color: colors.textSecondary }, timeframe === t && [styles.timeBtnTextActive, { color: colors.textPrimary }]]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity 
            style={{ backgroundColor: colors.btnPrimaryBg, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 }}
            onPress={() => setConnectModalVisible(true)}
          >
            <Text style={{ color: colors.btnPrimaryText, fontWeight: '600', fontSize: 13 }}>+ Connect</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ─── Platform Selector Bar ─── */}
      <View style={[styles.previewBarSection, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
        <View style={styles.previewBarHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Feather name="layers" size={16} color={currentPreview.color} />
            <Text style={[styles.previewSectionTitle, { color: colors.textPrimary }]}>Platform Analytics Filter</Text>
            <View style={[styles.activePill, { backgroundColor: currentPreview.bg, borderColor: currentPreview.color, borderWidth: 1 }]}>
              <Text style={[styles.activePillText, { color: currentPreview.color }]}>
                {currentPreview.name}
              </Text>
            </View>
          </View>
        </View>

        {/* Horizontal Platform Filter Buttons */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          contentContainerStyle={styles.platformButtonRow}
        >
          {PLATFORM_PREVIEWS.map((plat) => {
            const isSelected = plat.key === selectedPlatformKey;
            const pStats = plat.key === 'all' 
              ? data.overview 
              : (data?.platformStats?.[plat.name] || data?.platformStats?.[plat.key]);
            const isConn = plat.key === 'all' 
              ? connectedPlatforms.length > 0 
              : connectedPlatforms.some(p => isPlatformMatch(p, plat.key)) || Boolean(pStats?.rawFollowers !== undefined || pStats?.rawViews !== undefined);

            let miniBadgeText = 'Sync';
            if (plat.key === 'all') {
              miniBadgeText = `${connectedPlatforms.length} connected`;
            } else if (isConn) {
              if (pStats && pStats.rawFollowers !== undefined) {
                miniBadgeText = `${formatCompactNumber(pStats.rawFollowers)} aud`;
              } else {
                miniBadgeText = 'Connected';
              }
            }

            return (
              <TouchableOpacity
                key={plat.key}
                onPress={() => handleSelectPlatform(plat.key)}
                activeOpacity={0.8}
                style={[
                  styles.previewBtn,
                  {
                    backgroundColor: isSelected 
                      ? (isDark ? 'rgba(255, 255, 255, 0.08)' : '#ffffff') 
                      : (isDark ? 'rgba(255, 255, 255, 0.03)' : '#f8fafc'),
                    borderColor: isSelected 
                      ? plat.color 
                      : colors.border,
                    borderWidth: isSelected ? 2 : 1,
                    ...(Platform.OS === 'web' && isSelected ? {
                      boxShadow: `0 4px 18px ${plat.color}30`
                    } : {})
                  }
                ]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={[
                    styles.previewIconWrap, 
                    { 
                      backgroundColor: plat.logo ? '#ffffff' : plat.bg,
                      borderColor: isSelected ? plat.color : colors.border,
                      borderWidth: isSelected ? 1.5 : 1
                    }
                  ]}>
                    {plat.logo ? (
                      <Image source={{ uri: plat.logo }} style={{ width: 20, height: 20 }} resizeMode="contain" />
                    ) : (
                      <Feather name={plat.icon || 'layers'} size={18} color={plat.color} />
                    )}
                  </View>
                  <View>
                    <Text style={[
                      styles.previewBtnName, 
                      { color: isSelected ? colors.textPrimary : colors.textSecondary },
                      isSelected && { fontWeight: '800' }
                    ]}>
                      {plat.name}
                    </Text>
                    <Text style={[styles.previewBtnBadge, { color: isConn ? '#10b981' : colors.textMuted }]}>
                      {isConn ? '● ' : '○ '}{miniBadgeText}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ─── Top Dynamic Metrics Row for Selected Platform ─── */}
      <View style={styles.topMetricsRow}>
        {/* Metric 1: Audience / Community */}
        <View dataSet={{ gridBox: 'true' }} style={[styles.metricCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <View style={styles.metricHeader}>
            <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>
              {isAll ? 'TOTAL COMMUNITY' : `${currentPreview.name.toUpperCase()} AUDIENCE`}
            </Text>
            <View style={[styles.metricIconPill, { backgroundColor: currentPreview.bg }]}>
              <Text style={{ fontSize: 10, color: currentPreview.color, fontWeight: '700' }}>
                {isAll ? 'UNIFIED' : currentPreview.name}
              </Text>
            </View>
          </View>
          <Text style={[styles.metricValue, { color: colors.textPrimary }]}>{displayAudience}</Text>
          <Text style={styles.metricTrendUp}>
            {isPlatformConnected ? (isAll ? '↑ Active unified audience' : '↑ Platform community') : '— Not connected'}
          </Text>
        </View>

        {/* Metric 2: 30-Day Reach & Impressions */}
        <View dataSet={{ gridBox: 'true' }} style={[styles.metricCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <View style={styles.metricHeader}>
            <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>
              {isAll ? '30-DAY REACH' : `${currentPreview.name.toUpperCase()} 30D REACH`}
            </Text>
            <View style={[styles.metricIconPill, { backgroundColor: currentPreview.bg }]}>
              <Text style={{ fontSize: 10, color: currentPreview.color, fontWeight: '700' }}>
                IMPRESSIONS
              </Text>
            </View>
          </View>
          <Text style={[styles.metricValue, { color: colors.textPrimary }]}>{displayReach}</Text>
          <Text style={styles.metricTrendUp}>
            {isPlatformConnected ? '↑ Rolling 30d impressions' : '— No telemetry yet'}
          </Text>
        </View>

        {/* Metric 3: True Engagement Rate */}
        <View dataSet={{ gridBox: 'true' }} style={[styles.metricCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <View style={styles.metricHeader}>
            <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>
              {isAll ? 'TRUE ENGAGEMENT' : `${currentPreview.name.toUpperCase()} ENGAGE`}
            </Text>
            <View style={[styles.metricIconPill, { backgroundColor: currentPreview.bg }]}>
              <Text style={{ fontSize: 10, color: currentPreview.color, fontWeight: '700' }}>
                ACTIVE
              </Text>
            </View>
          </View>
          <Text style={[styles.metricValue, { color: colors.textPrimary }]}>{displayEngagement}</Text>
          <Text style={styles.metricTrendUp}>
            {parseFloat(displayEngagement) > 0 ? '↑ Weighted interactions / reach' : '—'}
          </Text>
        </View>

        {/* Metric 4: Creator Value */}
        <View dataSet={{ gridBox: 'true' }} style={[styles.metricCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <View style={styles.metricHeader}>
            <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>
              {isAll ? 'CREATOR VALUE' : `${currentPreview.name.toUpperCase()} VALUE`}
            </Text>
            <View style={[styles.metricIconPill, { backgroundColor: currentPreview.bg }]}>
              <Text style={{ fontSize: 10, color: currentPreview.color, fontWeight: '700' }}>
                EST
              </Text>
            </View>
          </View>
          <Text style={[styles.metricValue, { color: colors.textPrimary }, displayRevenue === 'Unmonetized' && { fontSize: 24, marginTop: 4 }]}>
            {displayRevenue}
          </Text>
          <Text style={displayRevenue !== 'Unmonetized' ? styles.metricTrendUp : [styles.metricTrendDown, { color: colors.textSecondary }]}>
            {displayRevenue !== 'Unmonetized' ? '↑ Monthly creator run-rate' : 'Grow audience to unlock'}
          </Text>
        </View>
      </View>

      {/* ─── Middle Section: Dynamic Chart & Demographics / Platform Telemetry ─── */}
      <View style={{ flexDirection: Platform.OS === 'web' && window.innerWidth > 900 ? 'row' : 'column', gap: 32, marginBottom: 32 }}>
        
        {/* Main Chart Area */}
        <View dataSet={{ gridBox: 'true' }} style={[styles.card, { flex: 2, backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <View>
                <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
                  {isAll ? 'Audience Growth' : `${currentPreview.name} Performance Trend`}
                </Text>
                <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
                  {isAll ? 'Unified activity across all connected platforms' : `Daily 30d reach & engagement for ${currentPreview.name}`}
                </Text>
              </View>
              <View style={[styles.chartBadge, { backgroundColor: currentPreview.bg, borderColor: currentPreview.color, borderWidth: 1 }]}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: currentPreview.color }}>
                  {currentPreview.name}
                </Text>
              </View>
            </View>
          </View>
          
          <View style={styles.chartWrap}>
            {chartItems.length > 0 ? (
              chartItems.map((d, i) => (
                <View key={i} style={styles.barCol}>
                  <View style={[styles.bar, { height: `${d.val}%`, backgroundColor: currentPreview.color }]} />
                  <Text style={[styles.barLabel, { color: colors.textSecondary }]}>{d.day}</Text>
                </View>
              ))
            ) : (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 20 }}>Gathering historical data...</Text>
              </View>
            )}
          </View>
        </View>

        {/* Demographics Area / Platform Specific Telemetry */}
        <View dataSet={{ gridBox: 'true' }} style={[styles.card, { flex: 1, backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
              {isAll ? 'Demographics' : `${currentPreview.name} Deep Telemetry`}
            </Text>
            <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
              {isAll ? 'Combined audience distribution' : `Platform-specific ranking & engagement signals`}
            </Text>
          </View>
          
          {!isAll ? (
            <View style={styles.platformTelemetryDetails}>
              <View style={[styles.telemetryRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.telemetryLabel, { color: colors.textSecondary }]}>Sync Status</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={[styles.statusDot, { backgroundColor: isPlatformConnected ? '#10b981' : '#f59e0b' }]} />
                  <Text style={[styles.telemetryVal, { color: isPlatformConnected ? '#10b981' : '#f59e0b', fontWeight: '700' }]}>
                    {isPlatformConnected ? 'Connected (Live)' : 'Not Connected'}
                  </Text>
                </View>
              </View>

              {/* Platform Specific Telemetry Signals */}
              {currentPreview.key === 'yt' && (
                <>
                  <View style={[styles.telemetryRow, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.telemetryLabel, { color: colors.textSecondary }]}>Subscribers</Text>
                    <Text style={[styles.telemetryVal, { color: colors.textPrimary, fontFamily: mono }]}>{displayAudience}</Text>
                  </View>
                  <View style={[styles.telemetryRow, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.telemetryLabel, { color: colors.textSecondary }]}>Watch Time</Text>
                    <Text style={[styles.telemetryVal, { color: colors.textPrimary, fontFamily: mono }]}>
                      {isPlatformConnected ? `${(Number(platformStatsObj?.rawViews || 0) * 0.045).toFixed(1)} hrs` : '—'}
                    </Text>
                  </View>
                  <View style={[styles.telemetryRow, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.telemetryLabel, { color: colors.textSecondary }]}>Impression CTR</Text>
                    <Text style={[styles.telemetryVal, { color: '#10b981', fontFamily: mono }]}>
                      {isPlatformConnected ? `${(parseFloat(displayEngagement || 0) * 1.2 + 2.1).toFixed(1)}%` : '—'}
                    </Text>
                  </View>
                  <View style={[styles.telemetryRow, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.telemetryLabel, { color: colors.textSecondary }]}>Audience Retention</Text>
                    <Text style={[styles.telemetryVal, { color: colors.textPrimary, fontFamily: mono }]}>
                      {isPlatformConnected ? '54.2% Avg' : '—'}
                    </Text>
                  </View>
                </>
              )}

              {currentPreview.key === 'ig' && (
                <>
                  <View style={[styles.telemetryRow, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.telemetryLabel, { color: colors.textSecondary }]}>Followers</Text>
                    <Text style={[styles.telemetryVal, { color: colors.textPrimary, fontFamily: mono }]}>{displayAudience}</Text>
                  </View>
                  <View style={[styles.telemetryRow, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.telemetryLabel, { color: colors.textSecondary }]}>Accounts Reached</Text>
                    <Text style={[styles.telemetryVal, { color: colors.textPrimary, fontFamily: mono }]}>{displayReach}</Text>
                  </View>
                  <View style={[styles.telemetryRow, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.telemetryLabel, { color: colors.textSecondary }]}>Saves & Shares</Text>
                    <Text style={[styles.telemetryVal, { color: '#10b981', fontFamily: mono }]}>
                      {isPlatformConnected ? 'Top 10% Reel Score' : '—'}
                    </Text>
                  </View>
                  <View style={[styles.telemetryRow, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.telemetryLabel, { color: colors.textSecondary }]}>Profile Visits</Text>
                    <Text style={[styles.telemetryVal, { color: colors.textPrimary, fontFamily: mono }]}>
                      {isPlatformConnected ? `${Math.round(Number(platformStatsObj?.rawViews || 0) * 0.08)} taps` : '—'}
                    </Text>
                  </View>
                </>
              )}

              {currentPreview.key === 'in' && (
                <>
                  <View style={[styles.telemetryRow, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.telemetryLabel, { color: colors.textSecondary }]}>Network Size</Text>
                    <Text style={[styles.telemetryVal, { color: colors.textPrimary, fontFamily: mono }]}>{displayAudience}</Text>
                  </View>
                  <View style={[styles.telemetryRow, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.telemetryLabel, { color: colors.textSecondary }]}>Post Impressions</Text>
                    <Text style={[styles.telemetryVal, { color: colors.textPrimary, fontFamily: mono }]}>{displayReach}</Text>
                  </View>
                  <View style={[styles.telemetryRow, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.telemetryLabel, { color: colors.textSecondary }]}>Top Industry Reach</Text>
                    <Text style={[styles.telemetryVal, { color: '#0A66C2', fontWeight: '700' }]}>
                      {isPlatformConnected ? 'Tech & Software' : '—'}
                    </Text>
                  </View>
                  <View style={[styles.telemetryRow, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.telemetryLabel, { color: colors.textSecondary }]}>Search Appearances</Text>
                    <Text style={[styles.telemetryVal, { color: colors.textPrimary, fontFamily: mono }]}>
                      {isPlatformConnected ? 'Weekly Top 5%' : '—'}
                    </Text>
                  </View>
                </>
              )}

              {currentPreview.key === 'x' && (
                <>
                  <View style={[styles.telemetryRow, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.telemetryLabel, { color: colors.textSecondary }]}>X Followers</Text>
                    <Text style={[styles.telemetryVal, { color: colors.textPrimary, fontFamily: mono }]}>{displayAudience}</Text>
                  </View>
                  <View style={[styles.telemetryRow, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.telemetryLabel, { color: colors.textSecondary }]}>Post Impressions</Text>
                    <Text style={[styles.telemetryVal, { color: colors.textPrimary, fontFamily: mono }]}>{displayReach}</Text>
                  </View>
                  <View style={[styles.telemetryRow, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.telemetryLabel, { color: colors.textSecondary }]}>Reposts & Quotes</Text>
                    <Text style={[styles.telemetryVal, { color: '#1DA1F2', fontFamily: mono }]}>
                      {isPlatformConnected ? 'High Viral Potential' : '—'}
                    </Text>
                  </View>
                </>
              )}

              {currentPreview.key === 'twitch' && (
                <>
                  <View style={[styles.telemetryRow, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.telemetryLabel, { color: colors.textSecondary }]}>Channel Followers</Text>
                    <Text style={[styles.telemetryVal, { color: colors.textPrimary, fontFamily: mono }]}>{displayAudience}</Text>
                  </View>
                  <View style={[styles.telemetryRow, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.telemetryLabel, { color: colors.textSecondary }]}>Broadcast Views</Text>
                    <Text style={[styles.telemetryVal, { color: colors.textPrimary, fontFamily: mono }]}>{displayReach}</Text>
                  </View>
                  <View style={[styles.telemetryRow, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.telemetryLabel, { color: colors.textSecondary }]}>Chat Velocity</Text>
                    <Text style={[styles.telemetryVal, { color: '#9146FF', fontFamily: mono }]}>
                      {isPlatformConnected ? 'Active' : '—'}
                    </Text>
                  </View>
                </>
              )}

              {currentPreview.key === 'fb' && (
                <>
                  <View style={[styles.telemetryRow, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.telemetryLabel, { color: colors.textSecondary }]}>Page Followers</Text>
                    <Text style={[styles.telemetryVal, { color: colors.textPrimary, fontFamily: mono }]}>{displayAudience}</Text>
                  </View>
                  <View style={[styles.telemetryRow, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.telemetryLabel, { color: colors.textSecondary }]}>Page Impressions</Text>
                    <Text style={[styles.telemetryVal, { color: colors.textPrimary, fontFamily: mono }]}>{displayReach}</Text>
                  </View>
                  <View style={[styles.telemetryRow, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.telemetryLabel, { color: colors.textSecondary }]}>Video Engagement</Text>
                    <Text style={[styles.telemetryVal, { color: '#1877F2', fontFamily: mono }]}>
                      {isPlatformConnected ? '1-Min Views Optimized' : '—'}
                    </Text>
                  </View>
                </>
              )}

              <View style={[styles.telemetryRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.telemetryLabel, { color: colors.textSecondary }]}>Monetization Status</Text>
                <Text style={[styles.telemetryVal, { color: colors.textPrimary }]}>{displayRevenue}</Text>
              </View>

              {!isPlatformConnected && (
                <TouchableOpacity 
                  style={[styles.quickConnectBtn, { backgroundColor: currentPreview.color }]}
                  onPress={() => setConnectModalVisible(true)}
                >
                  <Text style={styles.quickConnectText}>Connect {currentPreview.name} →</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : data.demographics ? (
            <View>
              {/* Gender */}
              <Text style={[styles.demoLabel, { color: colors.textSecondary }]}>Gender</Text>
              <View style={styles.demoBarContainer}>
                {data.demographics.gender.map(g => (
                  <View key={g.type} style={[styles.demoSegment, { width: `${g.pct}%`, backgroundColor: g.type === 'Male' ? '#3b82f6' : '#ec4899' }]} />
                ))}
              </View>
              <View style={styles.demoLegend}>
                {data.demographics.gender.map(g => (
                  <Text key={g.type} style={[styles.demoLegendText, { color: colors.textPrimary }]}>
                    <Text style={{color: g.type === 'Male' ? '#3b82f6' : '#ec4899'}}>● </Text>{g.type} {g.pct}%
                  </Text>
                ))}
              </View>

              {/* Age */}
              <Text style={[styles.demoLabel, { marginTop: 24, color: colors.textSecondary }]}>Age Range</Text>
              {data.demographics.age.map(a => (
                <View key={a.range} style={{ marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={{ fontSize: 13, color: colors.textPrimary }}>{a.range}</Text>
                    <Text style={{ fontSize: 13, color: colors.textSecondary, fontFamily: mono }}>{a.pct}%</Text>
                  </View>
                  <View style={{ height: 6, backgroundColor: colors.badgeBg, borderRadius: 3, overflow: 'hidden' }}>
                    <View style={{ height: '100%', width: `${a.pct}%`, backgroundColor: colors.accent }} />
                  </View>
                </View>
              ))}
            </View>
          ) : (
             <Text style={{ color: colors.textSecondary, fontSize: 14 }}>Demographics will unlock as platform data grows.</Text>
          )}
        </View>
      </View>

      {/* ─── Bottom Section: Top Content & Platform Breakdown ─── */}
      <View style={{ flexDirection: Platform.OS === 'web' && window.innerWidth > 900 ? 'row' : 'column', gap: 32 }}>
        
        {/* Top Content */}
        <View dataSet={{ gridBox: 'true' }} style={[styles.card, { flex: 1.5, backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <View>
                <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
                  {isAll ? 'Top Performing Content' : `${currentPreview.name} Content`}
                </Text>
                <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
                  {isAll ? 'Based on highest engagement' : `Recent synced posts from ${currentPreview.name}`}
                </Text>
              </View>
              {!isAll && (
                <View style={[styles.chartBadge, { backgroundColor: currentPreview.bg, borderColor: currentPreview.color, borderWidth: 1 }]}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: currentPreview.color }}>
                    {filteredContent.length} items
                  </Text>
                </View>
              )}
            </View>
          </View>
          
          <View style={styles.contentList}>
            {filteredContent.length === 0 ? (
              <View style={{ padding: 32, alignItems: 'center', justifyContent: 'center' }}>
                <Feather name="film" size={32} color={colors.textSecondary} style={{ marginBottom: 12, opacity: 0.5 }} />
                <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '600', marginBottom: 4 }}>
                  {isAll ? 'No content synced yet' : `No ${currentPreview.name} content synced yet`}
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12, textAlign: 'center', maxWidth: 280 }}>
                  {isAll 
                    ? 'Connect accounts in Platforms tab to aggregate your posts.' 
                    : `Connect your ${currentPreview.name} account to sync video and post performance.`}
                </Text>
              </View>
            ) : (
              filteredContent.map(item => (
                <View key={item.id} style={[styles.contentItem, { borderBottomColor: colors.border }]}>
                  {item.thumbnail ? (
                    <Image source={{ uri: item.thumbnail }} style={styles.contentThumb} />
                  ) : (
                    <View style={[styles.contentThumb, { justifyContent: 'center', alignItems: 'center', backgroundColor: colors.badgeBg }]}>
                      <Text style={{ fontSize: 18, color: colors.textPrimary }}>▶</Text>
                    </View>
                  )}
                  <View style={styles.contentInfo}>
                    <Text style={[styles.contentTitle, { color: colors.textPrimary }]} numberOfLines={1}>{item.title}</Text>
                    <Text style={[styles.contentPlatform, { color: colors.textSecondary }]}>{item.platform}</Text>
                  </View>
                  <View style={styles.contentStats}>
                    <Text style={[styles.contentStatMain, { color: colors.textPrimary }]}>{item.views}</Text>
                    <Text style={[styles.contentStatSub, { color: colors.textSecondary }]}>Views</Text>
                  </View>
                  <View style={styles.contentStats}>
                    <Text style={[styles.contentStatMain, { color: '#10b981' }]}>{item.engage}</Text>
                    <Text style={[styles.contentStatSub, { color: colors.textSecondary }]}>Engage</Text>
                  </View>
                </View>
              ))
            )}
          </View>
        </View>

        {/* Platform Breakdown */}
        <View dataSet={{ gridBox: 'true' }} style={[styles.card, { flex: 1, backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Platform Breakdown</Text>
          <Text style={[styles.cardSubtitle, { color: colors.textSecondary, marginBottom: 12 }]}>All connected accounts overview</Text>
          
          <View style={styles.table}>
            <View style={[styles.tableHeaderRow, { borderBottomColor: colors.border }]}>
              <Text style={[styles.tableCell, { flex: 1.5, color: colors.textSecondary }]}>Platform</Text>
              <Text style={[styles.tableCell, { color: colors.textSecondary }]}>Views</Text>
              <Text style={[styles.tableCell, { color: colors.textSecondary }]}>Followers</Text>
              <Text style={[styles.tableCell, { color: colors.textSecondary }]}>Engage</Text>
            </View>
            
            {Object.entries(data.platformStats).map(([platform, stats]) => {
              const isItemActive = isPlatformMatch(platform, currentPreview.key) || platform === currentPreview.name;
              return (
                <TouchableOpacity 
                  key={platform} 
                  onPress={() => {
                    const matchPreview = PLATFORM_PREVIEWS.find(p => isPlatformMatch(p.key, platform) || p.name === platform);
                    if (matchPreview) handleSelectPlatform(matchPreview.key);
                  }}
                  activeOpacity={0.7}
                  style={[
                    styles.tableRow, 
                    { borderBottomColor: colors.border },
                    isItemActive && { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(99, 102, 241, 0.05)', borderRadius: 6 }
                  ]}
                >
                  <View style={[styles.tableCell, { flex: 1.5, flexDirection: 'row', alignItems: 'center' }]}>
                    <View style={[styles.platformDot, { backgroundColor: PLATFORM_COLORS[platform] || colors.textPrimary }]} />
                    <Text style={[styles.platformName, { color: colors.textPrimary }, isItemActive && { fontWeight: '800', color: currentPreview.color }]}>
                      {platform}
                    </Text>
                  </View>
                  <Text style={[styles.tableCell, styles.cellValue, { color: colors.textPrimary }]}>{stats.views}</Text>
                  <Text style={[styles.tableCell, styles.cellValue, { color: colors.textPrimary }]}>{stats.followers}</Text>
                  <Text style={[styles.tableCell, styles.cellValue, { color: '#10b981' }]}>{stats.engage}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

      </View>

      <ConnectModal
        visible={connectModalVisible}
        onClose={() => setConnectModalVisible(false)}
        onSuccess={loadData}
      />
    </ScrollView>
  );
}

const mono = Platform.OS === 'web' ? 'monospace' : undefined;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  scrollContent: {
    padding: 32,
    paddingBottom: 60,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    flexWrap: 'wrap',
    gap: 16,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#000',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  pageSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  timeframeToggle: {
    flexDirection: 'row',
    backgroundColor: '#eee',
    padding: 4,
    borderRadius: 8,
  },
  timeBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 6,
  },
  timeBtnActive: {
    backgroundColor: '#fff',
    ...(Platform.OS === 'web' ? { boxShadow: '0px 1px 2px rgba(0,0,0,0.1)' } : { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 }),
  },
  timeBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  timeBtnTextActive: {
    color: '#000',
  },

  // ─── Platform Preview Buttons Section ───
  previewBarSection: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    marginBottom: 28,
  },
  previewBarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 12,
  },
  previewSectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  activePill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  activePillText: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  autoCycleControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  autoCycleToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  autoCycleText: {
    fontSize: 12,
    fontWeight: '700',
  },
  pulsingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  platformButtonRow: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  previewBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    minWidth: 145,
    position: 'relative',
    overflow: 'hidden',
  },
  previewIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewBtnName: {
    fontSize: 13,
    fontWeight: '600',
  },
  previewBtnBadge: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  previewProgressTrack: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
  },
  previewProgressFill: {
    height: '100%',
  },

  // ─── Top Metrics ───
  topMetricsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 32,
    flexWrap: 'wrap',
  },
  metricCard: {
    flex: 1,
    minWidth: 200,
    backgroundColor: '#fff',
    padding: 22,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#eee',
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#999',
    letterSpacing: 0.8,
    fontFamily: mono,
  },
  metricIconPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  metricValue: {
    fontSize: 30,
    fontWeight: '800',
    color: '#000',
    marginBottom: 6,
    fontFamily: mono,
  },
  metricTrendUp: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10b981',
    fontFamily: mono,
  },
  metricTrendDown: {
    fontSize: 12,
    fontWeight: '600',
    color: '#f43f5e',
    fontFamily: mono,
  },

  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#eee',
  },
  cardHeader: {
    marginBottom: 24,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#666',
  },
  chartBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  
  // Charts
  chartWrap: {
    height: 200,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  barCol: {
    alignItems: 'center',
    width: 32,
    height: '100%',
    justifyContent: 'flex-end',
  },
  bar: {
    width: 24,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    opacity: 0.85,
  },
  barLabel: {
    marginTop: 12,
    fontSize: 12,
    color: '#999',
    fontFamily: mono,
    marginBottom: -24,
  },

  // Telemetry details for single platform
  platformTelemetryDetails: {
    gap: 4,
  },
  telemetryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  telemetryLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  telemetryVal: {
    fontSize: 13,
    fontWeight: '600',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  quickConnectBtn: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  quickConnectText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },

  // Demographics
  demoLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  demoBarContainer: {
    flexDirection: 'row',
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 12,
  },
  demoSegment: {
    height: '100%',
  },
  demoLegend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  demoLegendText: {
    fontSize: 13,
    color: '#444',
    fontWeight: '500',
  },

  // Top Content
  contentList: {
    flex: 1,
  },
  contentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f8f8f8',
  },
  contentThumb: {
    width: 80,
    height: 45,
    borderRadius: 6,
    marginRight: 16,
    backgroundColor: '#eee',
  },
  contentInfo: {
    flex: 1,
  },
  contentTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  contentPlatform: {
    fontSize: 12,
    color: '#888',
  },
  contentStats: {
    marginLeft: 24,
    alignItems: 'flex-end',
    minWidth: 60,
  },
  contentStatMain: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000',
    fontFamily: mono,
    marginBottom: 2,
  },
  contentStatSub: {
    fontSize: 11,
    color: '#999',
  },

  // Table
  table: {
    width: '100%',
    marginTop: 12,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 12,
    marginBottom: 6,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f8f8f8',
  },
  tableCell: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: '#999',
    textTransform: 'uppercase',
  },
  platformDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 12,
  },
  platformName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000',
  },
  cellValue: {
    fontSize: 14,
    color: '#000',
    fontFamily: mono,
    fontWeight: '600',
    textTransform: 'none',
  },
});
