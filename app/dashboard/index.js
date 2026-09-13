import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, ScrollView, Platform, Image, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { fetchPlatformData, syncPlatformData, isPlatformMatch, normalizePlatformKey, normalizePlatformName, processSessionOAuthTokens } from '../../lib/api';
import ConnectModal from '../../components/ConnectModal';
import { useTheme } from '../../context/ThemeContext';

const PLATFORMS = {
  YouTube:    { color: '#FF0000', bg: 'rgba(255,0,0,0.08)',    logo: 'https://img.icons8.com/color/512/youtube-play.png' },
  Twitch:     { color: '#9146FF', bg: 'rgba(145,70,255,0.08)', logo: 'https://img.icons8.com/color/512/twitch--v1.png' },
  Instagram:  { color: '#E1306C', bg: 'rgba(225,48,108,0.08)', logo: 'https://img.icons8.com/fluent/512/instagram-new.png' },
  'X (Twitter)': { color: '#000000', bg: 'rgba(0,0,0,0.04)',      logo: 'https://img.icons8.com/ios-filled/512/twitterx--v1.png' },
  Facebook:   { color: '#1877F2', bg: 'rgba(24,119,242,0.08)', logo: 'https://img.icons8.com/color/512/facebook-new.png' },
  LinkedIn:   { color: '#0A66C2', bg: 'rgba(10,102,194,0.08)', logo: 'https://img.icons8.com/color/512/linkedin.png' },
};

export default function DashboardIndex() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [connectedPlatforms, setConnectedPlatforms] = useState([]);
  const params = useLocalSearchParams();

  // In-place Platform Connect & Management Modal
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState('YouTube');

  // Handle OAuth redirect errors if they return directly to the dashboard
  useEffect(() => {
    if (params?.error) {
      const description = params.error_description?.replace(/\+/g, ' ') || 'An unknown error occurred';
      if (params.error_code === 'identity_already_exists') {
        alert('This platform account is already connected to your StreamSync profile!');
      } else {
        alert('Connection Failed: ' + description);
      }
      
      if (Platform.OS === 'web') {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
      router.setParams({ error: '', error_code: '', error_description: '' });
    }
  }, [params?.error]);

  useEffect(() => {
    if (params?.connect) {
      const pMap = { yt: 'YouTube', youtube: 'YouTube', twitch: 'Twitch', ig: 'Instagram', instagram: 'Instagram', x: 'X (Twitter)', twitter: 'X (Twitter)', fb: 'Facebook', facebook: 'Facebook', in: 'LinkedIn', linkedin: 'LinkedIn' };
      const plat = pMap[String(params.connect).toLowerCase()] || 'YouTube';
      openConnectModal(plat);
      if (Platform.OS === 'web') {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
      router.setParams({ connect: '' });
    }
  }, [params?.connect]);

  function openConnectModal(platformName = 'YouTube') {
    setSelectedPlatform(platformName);
    setModalVisible(true);
  }

  const reloadDashboardData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return [];

    if (session.provider_token) {
      await processSessionOAuthTokens(session);
    }
    
    const [profileRes, anRes] = await Promise.all([
      supabase.from('profiles').select('connected_platforms, api_keys').eq('id', session.user.id).maybeSingle(),
      supabase.from('analytics').select('platform').eq('user_id', session.user.id)
    ]);
    const profile = profileRes.data;
    const anRows = anRes.data || [];

    const apiKeys = profile?.api_keys || {};
    const keyPlatforms = [];
    if (apiKeys.youtube || apiKeys.yt || apiKeys.youtube_channel_id || apiKeys.youtube_token) {
      keyPlatforms.push('yt');
    }
    if (apiKeys.twitch || apiKeys.twitch_username || apiKeys.twitch_login || apiKeys.twitch_channel_id) {
      keyPlatforms.push('twitch');
    }
    if (apiKeys.x || apiKeys.x_username || apiKeys.twitter_username || apiKeys.twitter || apiKeys.x_bearer_token) {
      keyPlatforms.push('x');
    }

    const anPlatforms = anRows.map(r => normalizePlatformKey(r.platform)).filter(Boolean);

    const rawList = [
      ...(profile?.connected_platforms || []),
      ...keyPlatforms,
      ...anPlatforms
    ];
    const platforms = Array.from(new Set(rawList.map(p => normalizePlatformKey(p)).filter(Boolean)));
    
    setConnectedPlatforms(platforms);
    
    // Fetch current DB data immediately so UI isn't blocked
    const apiData = await fetchPlatformData(platforms);
    setData(apiData);
    setLoading(false);
    return platforms;
  };

  useEffect(() => {
    let isMounted = true;
    let subscription = null;

    const { data: { subscription: authListener } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!isMounted) return;
      if (session) {
        await reloadDashboardData();
      } else {
        setLoading(false);
      }
    });

    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        if (isMounted) setLoading(false);
        return;
      }
      if (!isMounted) return;

      const platforms = await reloadDashboardData();
      if (!isMounted) return;

      // 2. Trigger background sync via direct API & Edge function
      if (platforms && platforms.length > 0) {
        syncPlatformData(platforms).then(synced => {
          if (synced && isMounted) {
            reloadDashboardData();
          }
        });
      }

      if (!isMounted) return;

      // 3. Realtime updates listener with unique channel name
      const channelName = `dashboard-realtime-${session.user.id}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const channel = supabase.channel(channelName)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${session.user.id}` }, () => {
          if (isMounted) reloadDashboardData();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'analytics', filter: `user_id=eq.${session.user.id}` }, () => {
          if (isMounted) reloadDashboardData();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'content', filter: `user_id=eq.${session.user.id}` }, () => {
          if (isMounted) reloadDashboardData();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'comments', filter: `user_id=eq.${session.user.id}` }, () => {
          if (isMounted) reloadDashboardData();
        });

      if (!isMounted) {
        supabase.removeChannel(channel);
        return;
      }

      subscription = channel;
      channel.subscribe();
    };
    
    init();

    return () => {
      isMounted = false;
      authListener?.unsubscribe?.();
      if (subscription) {
        supabase.removeChannel(subscription);
        subscription = null;
      }
    };
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <View style={styles.loadingPulse}>
          <Image
            source={require('../../assets/logo-mark.png')}
            style={styles.loadingIcon}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.loadingText}>Syncing your platforms...</Text>
        <Text style={styles.loadingSub}>Pulling data from connected accounts</Text>
      </View>
    );
  }

  const { colors, isDark } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bodyBg }}>
      <ScrollView style={[styles.scroller, { backgroundColor: colors.bodyBg }]} contentContainerStyle={styles.scrollContent}>
      
      {/* ─── Page Header ─── */}
      <View style={styles.pageHeader}>
        <View>
          <Text style={[styles.greeting, { color: colors.textSecondary }]}>Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'} 👋</Text>
          <Text style={[styles.pageTitle, { color: colors.textPrimary }]}>Your Creator Dashboard</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={[styles.headerBtn, { backgroundColor: colors.btnPrimaryBg }]} onPress={() => openConnectModal('YouTube')}>
            <Text style={[styles.headerBtnText, { color: colors.btnPrimaryText }]}>+ Connect Channel</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ─── Connected Platforms Quick Status ─── */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24, paddingHorizontal: 30 }}>
        <Text style={{ fontSize: 13, color: colors.textSecondary, marginRight: 12, fontWeight: '600' }}>Active Connections:</Text>
        {connectedPlatforms.length === 0 ? (
          <TouchableOpacity onPress={() => openConnectModal('YouTube')}>
            <Text style={{ fontSize: 13, color: '#ff6b6b', fontWeight: '500' }}>None. Click to connect YouTube.</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {Array.from(new Set(connectedPlatforms.map(p => normalizePlatformName(p) || p))).map(name => {
              const config = PLATFORMS[name];
              if (!config) return null;
              return (
                <View 
                  key={name} 
                  style={{ 
                    width: 32, 
                    height: 32, 
                    borderRadius: 16, 
                    backgroundColor: isDark ? '#ffffff' : config.bg, 
                    justifyContent: 'center', 
                    alignItems: 'center', 
                    borderWidth: 1.5, 
                    borderColor: isDark ? '#ffffff' : config.color + '40',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: isDark ? 0.25 : 0.08,
                    shadowRadius: 4,
                    elevation: 3,
                  }}
                >
                  <Image source={{ uri: config.logo }} style={{ width: 18, height: 18 }} resizeMode="contain" />
                </View>
              );
            })}
          </View>
        )}
      </View>

      {/* ─── Aggregated Stats Row ─── */}
      <View style={styles.statsRow}>
        <View dataSet={{ gridBox: 'true' }} style={[styles.statCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <View style={styles.statHeader}>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total Reach</Text>
            <Text style={styles.statTrendUp}>{data.overview.totalViews > 0 ? '↑ Live' : '—'}</Text>
          </View>
          <Text style={[styles.statValue, { color: colors.textPrimary }]}>{data.overview.totalViews.toLocaleString()}</Text>
          <Text style={[styles.statCaption, { color: colors.textMuted }]}>Combined views across all platforms</Text>
        </View>

        <View dataSet={{ gridBox: 'true' }} style={[styles.statCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <View style={styles.statHeader}>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Audience</Text>
            <Text style={styles.statTrendUp}>{data.overview.totalFollowers > 0 ? '↑ Active' : '—'}</Text>
          </View>
          <Text style={[styles.statValue, { color: colors.textPrimary }]}>{data.overview.totalFollowers.toLocaleString()}</Text>
          <Text style={[styles.statCaption, { color: colors.textMuted }]}>Followers & subscribers unified</Text>
        </View>

        <View dataSet={{ gridBox: 'true' }} style={[styles.statCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <View style={styles.statHeader}>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Engagement</Text>
            <Text style={styles.statTrendUp}>
              {parseFloat(data.overview.engagementRate || 0) > 0 ? '↑ Real-time' : '—'}
            </Text>
          </View>
          <Text style={[styles.statValue, { color: colors.textPrimary }]}>{data.overview.engagementRate || '0.0%'}</Text>
          <Text style={[styles.statCaption, { color: colors.textMuted }]}>Average across connected platforms</Text>
        </View>

        <View dataSet={{ gridBox: 'true' }} style={[styles.statCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <View style={styles.statHeader}>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Revenue</Text>
            {data.overview.estimatedRevenue >= 0 && (
              <Text style={styles.statTrendUp}>↑ Est.</Text>
            )}
          </View>
          <Text style={[styles.statValue, { color: colors.textPrimary }]}>
            {data.overview.estimatedRevenue < 0 
              ? "Unmonetized" 
              : `$${data.overview.estimatedRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
          </Text>
          <Text style={[styles.statCaption, { color: colors.textMuted }]}>
            {data.overview.estimatedRevenue < 0 ? "Grow audience to unlock" : "Monthly creator revenue run-rate"}
          </Text>
        </View>
      </View>

      {/* ─── Platform Breakdown Cards ─── */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Platform Performance</Text>
        <Text style={[styles.sectionSub, { color: colors.textSecondary }]}>Real-time sync status for each connected platform</Text>
      </View>

      <View style={styles.platformGrid}>
        {Object.entries(PLATFORMS).map(([name, config]) => {
          const dbKeyMap = { 'YouTube': 'yt', 'Twitch': 'twitch', 'Instagram': 'ig', 'X (Twitter)': 'x', 'Facebook': 'fb', 'LinkedIn': 'in' };
          const pKey = dbKeyMap[name] || normalizePlatformKey(name);
          const stats = data?.platformStats?.[name] || data?.platformStats?.[pKey];
          const hasApiData = Boolean(stats && (stats.rawFollowers !== undefined || stats.rawViews !== undefined));
          const isConnected = connectedPlatforms.some(p => isPlatformMatch(p, pKey)) || hasApiData;
          
          let statusText = 'Not connected';
          let dotStyle = styles.statusDotOff;
          
          if (isConnected) {
            if (hasApiData) {
              statusText = 'Receiving Data (Live)';
              dotStyle = styles.statusDotLive;
            } else {
              statusText = 'Connected (Sync Ready)';
              dotStyle = { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent };
            }
          }

          return (
            <View 
              key={name} 
              dataSet={{ gridBox: 'true' }}
              style={[
                styles.platformCard, 
                { 
                  backgroundColor: colors.cardBg,
                  borderColor: isDark ? 'transparent' : colors.border,
                  borderTopWidth: isDark ? 0 : 3, 
                  borderTopColor: isDark ? 'transparent' : config.color,
                  borderWidth: isDark ? 0 : 1,
                  ...(Platform.OS === 'web' ? { boxShadow: isDark ? '0 8px 30px rgba(0, 0, 0, 0.55)' : `0px 8px 24px ${config.color}15` } : {})
                }
              ]}
            >
              {/* Platform Header */}
              <View style={styles.platformCardHeader}>
                <View style={[styles.platformIconCircle, { backgroundColor: isDark ? '#ffffff' : config.bg, padding: 0, borderWidth: isDark ? 1 : 0, borderColor: '#ffffff' }]}>
                  <Image source={{ uri: config.logo }} style={{ width: 22, height: 22 }} resizeMode="contain" />
                </View>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={[styles.platformCardName, { color: colors.textPrimary }]} numberOfLines={1}>{name}</Text>
                  <Text style={[styles.platformCardSyncTime, { color: colors.textSecondary }]} numberOfLines={2}>{statusText}</Text>
                </View>
                
                {isConnected && (
                  <TouchableOpacity 
                    onPress={() => openConnectModal(name)} 
                    style={{ marginRight: 12, paddingHorizontal: 12, paddingVertical: 4, backgroundColor: colors.badgeBg, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}
                  >
                    <Text style={{ fontSize: 12, color: colors.textSecondary, fontWeight: '600' }}>Manage</Text>
                  </TouchableOpacity>
                )}
                <View style={[styles.statusDot, dotStyle]} />
              </View>
              
              {isConnected ? (
                <View style={styles.platformMetrics}>
                  <View style={styles.platformMetricItem}>
                    <Text style={[styles.platformMetricVal, { color: colors.textPrimary }]}>
                      {stats?.followers || '0'}
                    </Text>
                    <Text style={[styles.platformMetricLabel, { color: colors.textMuted }]}>Followers</Text>
                  </View>
                  <View style={[styles.platformMetricDivider, { backgroundColor: colors.border }]} />
                  <View style={styles.platformMetricItem}>
                    <Text style={[styles.platformMetricVal, { color: colors.textPrimary }]}>
                      {stats?.views || '0'}
                    </Text>
                    <Text style={[styles.platformMetricLabel, { color: colors.textMuted }]}>Views</Text>
                  </View>
                  <View style={[styles.platformMetricDivider, { backgroundColor: colors.border }]} />
                  <View style={styles.platformMetricItem}>
                    <Text style={[styles.platformMetricVal, { color: colors.textPrimary }]}>
                      {stats?.engage || '0.0%'}
                    </Text>
                    <Text style={[styles.platformMetricLabel, { color: colors.textMuted }]}>Engage</Text>
                  </View>
                </View>
              ) : (
                <TouchableOpacity style={[styles.connectPlatformBtn, { borderColor: colors.border, backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }]} onPress={() => openConnectModal(name)}>
                  <Text style={[styles.connectPlatformText, { color: colors.textSecondary }]}>Connect {name} →</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </View>

      {/* ─── Content Feed ─── */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Cross-Platform Content</Text>
        <View style={styles.tabRow}>
          {['all', 'YouTube', 'Twitch', 'Instagram', 'X'].map((tab) => (
            <TouchableOpacity 
              key={tab} 
              style={[
                styles.tabBtn, 
                { backgroundColor: colors.badgeBg, borderColor: colors.border },
                activeTab === tab && [styles.tabBtnActive, { backgroundColor: colors.btnPrimaryBg, borderColor: colors.btnPrimaryBg }]
              ]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[
                styles.tabBtnText, 
                { color: colors.textSecondary },
                activeTab === tab && [styles.tabBtnTextActive, { color: colors.btnPrimaryText }]
              ]}>
                {tab === 'all' ? 'All Platforms' : tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.contentFeed}>
        {(() => {
          const filteredContent = (data.topContent || []).filter((item) => {
            if (activeTab === 'all') return true;
            if (activeTab === 'X') return item.platform.includes('X') || item.platform.includes('Twitter');
            return item.platform.toLowerCase() === activeTab.toLowerCase();
          });

          if (filteredContent.length === 0) {
            const isAnyConnected = connectedPlatforms.length > 0;
            const isTabConnected = activeTab === 'all' 
              ? isAnyConnected 
              : connectedPlatforms.some(p => isPlatformMatch(p, activeTab));

            return (
              <View style={[styles.emptyState, { backgroundColor: colors.cardBg, borderRadius: 16, borderWidth: 1, borderColor: colors.border, marginVertical: 8 }]}>
                <Text style={styles.emptyIcon}>◫</Text>
                <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
                  {activeTab === 'all'
                    ? (isAnyConnected ? 'No content published yet' : 'No content synced yet')
                    : (isTabConnected ? `No ${activeTab} content published yet` : `No ${activeTab} content synced yet`)}
                </Text>
                <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
                  {activeTab === 'all'
                    ? (isAnyConnected ? 'Your connected accounts are active. Videos or posts will appear here once published.' : 'Connect your platforms above to start seeing your content here.')
                    : (isTabConnected ? `Your ${activeTab} account is connected. New uploads will sync and appear here automatically.` : `Connect your ${activeTab} account in Platforms to start seeing your posts here.`)}
                </Text>
                {!isTabConnected && (
                  <TouchableOpacity 
                    style={{ marginTop: 12, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: colors.badgeBg, borderRadius: 8, borderWidth: 1, borderColor: colors.border }}
                    onPress={() => openConnectModal(activeTab === 'all' ? 'YouTube' : activeTab)}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textPrimary }}>
                      + Connect {activeTab === 'all' ? 'Channel' : activeTab}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          }

          return filteredContent.map((item) => {
            const platformConf = PLATFORMS[item.platform] || { color: '#5a6270', bg: 'rgba(255,255,255,0.04)', icon: '?' };
            return (
              <View key={item.id} style={[styles.contentRow, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
                {/* Thumbnail */}
                <View style={[styles.contentThumb, { backgroundColor: colors.inputBg }]}>
                  {item.thumbnail ? (
                    <Image source={{ uri: item.thumbnail }} style={styles.thumbImg} />
                  ) : (
                    <View style={styles.thumbPlaceholder}>
                      <Text style={styles.thumbPlaceholderText}>◫</Text>
                    </View>
                  )}
                </View>
                {/* Info */}
                <View style={styles.contentInfo}>
                  <Text style={[styles.contentTitle, { color: colors.textPrimary }]} numberOfLines={1}>{item.title}</Text>
                  <View style={styles.contentMeta}>
                    <View style={[styles.contentPlatformChip, { backgroundColor: platformConf.bg }]}>
                      <Text style={[styles.contentPlatformChipText, { color: platformConf.color }]}>{item.platform}</Text>
                    </View>
                    <Text style={[styles.contentMetaText, { color: colors.textSecondary }]}>{item.views} views</Text>
                    <Text style={[styles.contentMetaText, { color: '#10b981' }]}>• {item.engage} engage</Text>
                  </View>
                </View>
                {/* Actions */}
                <TouchableOpacity style={[styles.contentActionBtn, { backgroundColor: colors.badgeBg }]}>
                  <Text style={[styles.contentActionText, { color: colors.textSecondary }]}>↗</Text>
                </TouchableOpacity>
              </View>
            );
          });
        })()}
      </View>

      {/* ─── Activity Stream ─── */}
      <View style={styles.twoCol}>
        {/* Recent Comments */}
        <View dataSet={{ gridBox: 'true' }} style={[styles.sectionCard, { flex: 1, backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <View style={styles.sectionCardHeader}>
            <Text style={[styles.sectionCardTitle, { color: colors.textPrimary }]}>Activity Feed</Text>
            <Text style={styles.sectionCardAction}>View all →</Text>
          </View>
          {data.recentComments.length === 0 ? (
            <Text style={[styles.emptySmall, { color: colors.textMuted }]}>No recent activity</Text>
          ) : (
            data.recentComments.map((c) => {
              const pConf = PLATFORMS[c.platform] || { color: '#5a6270', bg: 'rgba(255,255,255,0.04)' };
              return (
                <View key={c.id} style={[styles.activityRow, { borderBottomColor: colors.border }]}>
                  <View style={[styles.activityDot, { backgroundColor: pConf.color }]} />
                  <View style={styles.activityBody}>
                    <Text style={[styles.activityUser, { color: colors.textPrimary }]}>{c.user} <Text style={[styles.activityAction, { color: colors.textSecondary }]}>commented</Text></Text>
                    <Text style={[styles.activityText, { color: colors.textSecondary }]} numberOfLines={1}>{c.text}</Text>
                  </View>
                  <Text style={[styles.activityTime, { color: colors.textMuted }]}>{c.time}</Text>
                </View>
              );
            })
          )}
        </View>

        {/* Quick Actions */}
        <View dataSet={{ gridBox: 'true' }} style={[styles.sectionCard, { flex: 1, backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <Text style={[styles.sectionCardTitle, { color: colors.textPrimary }]}>Quick Actions</Text>
          
          <TouchableOpacity style={[styles.quickAction, { borderBottomColor: colors.border }]}>
            <View style={[styles.qaIcon, { backgroundColor: 'rgba(0,229,255,0.12)' }]}>
              <Text style={styles.qaIconText}>📤</Text>
            </View>
            <View style={styles.qaBody}>
              <Text style={[styles.qaTitle, { color: colors.textPrimary }]}>Cross-Post Content</Text>
              <Text style={[styles.qaDesc, { color: colors.textSecondary }]}>Publish to multiple platforms at once</Text>
            </View>
            <Text style={[styles.qaArrow, { color: colors.textMuted }]}>→</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.quickAction, { borderBottomColor: colors.border }]}>
            <View style={[styles.qaIcon, { backgroundColor: 'rgba(225,48,108,0.12)' }]}>
              <Text style={styles.qaIconText}>📊</Text>
            </View>
            <View style={styles.qaBody}>
              <Text style={[styles.qaTitle, { color: colors.textPrimary }]}>Generate Report</Text>
              <Text style={[styles.qaDesc, { color: colors.textSecondary }]}>Unified analytics across platforms</Text>
            </View>
            <Text style={[styles.qaArrow, { color: colors.textMuted }]}>→</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.quickAction, { borderBottomColor: colors.border }]} onPress={() => openConnectModal('YouTube')}>
            <View style={[styles.qaIcon, { backgroundColor: 'rgba(10,102,194,0.12)' }]}>
              <Text style={styles.qaIconText}>🔗</Text>
            </View>
            <View style={styles.qaBody}>
              <Text style={[styles.qaTitle, { color: colors.textPrimary }]}>Connect Platform</Text>
              <Text style={[styles.qaDesc, { color: colors.textSecondary }]}>Add a new social account to sync</Text>
            </View>
            <Text style={[styles.qaArrow, { color: colors.textMuted }]}>→</Text>
          </TouchableOpacity>
        </View>
      </View>

    </ScrollView>

    {/* ─── In-Place Platform Connect & Management Modal ─── */}
    <ConnectModal
      visible={modalVisible}
      onClose={() => setModalVisible(false)}
      initialPlatform={selectedPlatform}
      onSuccess={reloadDashboardData}
    />

  </View>
  );
}

const mono = Platform.OS === 'web' ? 'monospace' : undefined;

const styles = StyleSheet.create({
  scroller: { flex: 1 },
  scrollContent: { padding: 28, paddingBottom: 80 },

  // ─── Loading ───
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingPulse: {
    width: 64, height: 64, borderRadius: 18,
    backgroundColor: '#fff',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1, borderColor: '#eee',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10,
  },
  loadingIcon: {
    width: 38,
    height: 38,
  },
  loadingText: { fontSize: 16, color: '#000', fontWeight: '600' },
  loadingSub: { fontSize: 13, color: '#666' },

  // ─── Page Header ───
  pageHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 28,
  },
  greeting: { fontSize: 14, color: '#666', marginBottom: 4 },
  pageTitle: { fontSize: 26, fontWeight: '700', color: '#000', letterSpacing: -0.5 },
  headerActions: { flexDirection: 'row', gap: 10 },
  headerBtn: {
    backgroundColor: '#000', paddingHorizontal: 18, paddingVertical: 10,
    borderRadius: 999,
  },
  headerBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  // ─── Stats Row ───
  statsRow: { flexDirection: 'row', gap: 14, marginBottom: 28, flexWrap: 'wrap' },
  statCard: {
    flex: 1, minWidth: 190, backgroundColor: '#fff',
    padding: 20, borderRadius: 20,
    borderWidth: 1, borderColor: '#f0f0f0',
    ...(Platform.OS === 'web' ? { boxShadow: '0px 4px 20px rgba(0, 0, 0, 0.04)' } : {
      shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.04, shadowRadius: 20, elevation: 3
    })
  },
  statHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  statLabel: { fontSize: 12, color: '#666', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6, fontFamily: mono },
  statTrendUp: { fontSize: 12, color: '#9d50ff', fontWeight: '600', fontFamily: mono },
  statTrendDown: { fontSize: 12, color: '#666', fontWeight: '600', fontFamily: mono },
  statValue: { fontSize: 28, fontWeight: '700', color: '#000', fontFamily: mono, marginBottom: 4 },
  statCaption: { fontSize: 11, color: '#999' },

  // ─── Section Headers ───
  sectionHeader: { marginBottom: 16, marginTop: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#000', marginBottom: 4 },
  sectionSub: { fontSize: 13, color: '#666' },

  // ─── Platform Grid ───
  platformGrid: { flexDirection: 'row', gap: 14, marginBottom: 32, flexWrap: 'wrap' },
  platformCard: {
    flex: 1, minWidth: 280, backgroundColor: '#fff',
    borderRadius: 20, padding: 20,
    borderWidth: 1, borderColor: '#f0f0f0',
    ...(Platform.OS === 'web' ? { boxShadow: '0px 8px 24px rgba(0, 0, 0, 0.04)' } : {
      shadowColor: '#000', shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.06, shadowRadius: 40, elevation: 6
    })
  },
  platformCardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 10 },
  platformIconCircle: {
    width: 36, height: 36, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center',
  },
  platformIconText: { fontSize: 16, fontWeight: '700' },
  platformCardName: { fontSize: 14, fontWeight: '700', color: '#000' },
  platformCardSyncTime: { fontSize: 11, color: '#666', fontFamily: mono },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusDotLive: { backgroundColor: '#9d50ff' },
  statusDotOff: { backgroundColor: '#eee' },
  platformMetrics: { flexDirection: 'row', alignItems: 'center' },
  platformMetricItem: { flex: 1, alignItems: 'center' },
  platformMetricVal: { fontSize: 16, fontWeight: '700', color: '#000', fontFamily: mono },
  platformMetricLabel: { fontSize: 10, color: '#666', marginTop: 2, fontFamily: mono },
  platformMetricDivider: { width: 1, height: 28, backgroundColor: '#eee' },
  connectPlatformBtn: {
    backgroundColor: 'rgba(0,0,0,0.02)',
    paddingVertical: 10, borderRadius: 6, alignItems: 'center',
    borderWidth: 1, borderColor: '#eee', borderStyle: 'dashed',
  },
  connectPlatformText: { color: '#666', fontSize: 13, fontWeight: '500' },

  // ─── Tabs ───
  tabRow: { flexDirection: 'row', gap: 6, marginTop: 10 },
  tabBtn: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.02)', borderWidth: 1, borderColor: '#eee',
  },
  tabBtnActive: { backgroundColor: 'rgba(0,0,0,0.06)', borderColor: 'rgba(0,0,0,0.1)' },
  tabBtnText: { fontSize: 12, color: '#666', fontWeight: '500' },
  tabBtnTextActive: { color: '#000', fontWeight: '600' },

  // ─── Content Feed ───
  contentFeed: { marginBottom: 28 },
  contentRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 12,
    padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: '#eee',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.02, shadowRadius: 4,
  },
  contentThumb: {
    width: 64, height: 40, borderRadius: 6, overflow: 'hidden',
    backgroundColor: '#f8f8f8', marginRight: 14,
  },
  thumbImg: { width: '100%', height: '100%' },
  thumbPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  thumbPlaceholderText: { color: '#ddd', fontSize: 18 },
  contentInfo: { flex: 1 },
  contentTitle: { fontSize: 14, fontWeight: '600', color: '#000', marginBottom: 4 },
  contentMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  contentPlatformChip: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  contentPlatformChipText: { fontSize: 10, fontWeight: '600', fontFamily: mono },
  contentMetaText: { fontSize: 11, color: '#666', fontFamily: mono },
  contentActionBtn: {
    width: 32, height: 32, borderRadius: 6,
    backgroundColor: '#f8f8f8', justifyContent: 'center', alignItems: 'center',
  },
  contentActionText: { color: '#666', fontSize: 14 },

  // ─── Empty State ───
  emptyState: { alignItems: 'center', paddingVertical: 48 },
  emptyIcon: { fontSize: 32, color: '#ccc', marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#000', marginBottom: 4 },
  emptySub: { fontSize: 13, color: '#666', textAlign: 'center', maxWidth: 300 },
  emptySmall: { color: '#666', fontSize: 13, fontStyle: 'italic', paddingVertical: 16 },

  // ─── Two Column ───
  twoCol: { flexDirection: 'row', gap: 14, flexWrap: 'wrap' },

  // ─── Section Cards ───
  sectionCard: {
    backgroundColor: '#fff', borderRadius: 12,
    padding: 18, borderWidth: 1, borderColor: '#eee',
    minWidth: 300,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.02, shadowRadius: 10,
  },
  sectionCardHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 16,
  },
  sectionCardTitle: { fontSize: 16, fontWeight: '700', color: '#000', marginBottom: 4 },
  sectionCardAction: { color: '#9d50ff', fontSize: 13, fontWeight: '600' },

  // ─── Activity Feed ───
  activityRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eee',
  },
  activityDot: { width: 6, height: 6, borderRadius: 3, marginTop: 6, marginRight: 10 },
  activityBody: { flex: 1 },
  activityUser: { fontSize: 13, fontWeight: '700', color: '#000' },
  activityAction: { fontWeight: '400', color: '#666' },
  activityText: { fontSize: 12, color: '#666', marginTop: 2 },
  activityTime: { fontSize: 11, color: '#999', fontFamily: mono },

  // ─── Quick Actions ───
  quickAction: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eee',
    gap: 12,
  },
  qaIcon: {
    width: 38, height: 38, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  qaIconText: { fontSize: 18 },
  qaBody: { flex: 1 },
  qaTitle: { fontSize: 14, fontWeight: '700', color: '#000' },
  qaDesc: { fontSize: 12, color: '#666' },
  qaArrow: { color: '#ccc', fontSize: 16 },
});
