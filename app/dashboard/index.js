import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, ScrollView, Platform, Image, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { fetchPlatformData, syncPlatformData, isPlatformMatch, processSessionOAuthTokens } from '../../lib/api';
import ConnectModal from '../../components/ConnectModal';

const PLATFORMS = {
  YouTube:    { color: '#FF0000', bg: 'rgba(255,0,0,0.08)',    logo: 'https://img.icons8.com/color/512/youtube-play.png' },
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
      const pMap = { yt: 'YouTube', youtube: 'YouTube', ig: 'Instagram', instagram: 'Instagram', x: 'X (Twitter)', twitter: 'X (Twitter)', fb: 'Facebook', facebook: 'Facebook', in: 'LinkedIn', linkedin: 'LinkedIn' };
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
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('connected_platforms')
      .eq('id', session.user.id)
      .maybeSingle();
      
    const { data: { user } } = await supabase.auth.getUser();
    const identities = user?.identities || session.user?.identities || [];
    const providerToPlatformMap = { 'google': 'yt', 'facebook': 'fb', 'twitter': 'x', 'linkedin_oidc': 'in' };
    const identityPlatforms = identities.map(id => providerToPlatformMap[id.provider]).filter(Boolean);

    // Also check if analytics has any connected platforms recorded
    const { data: anRows } = await supabase
      .from('analytics')
      .select('platform')
      .eq('user_id', session.user.id);
    const anPlatforms = (anRows || []).map(r => r.platform).filter(Boolean);

    // Combine profile platforms, identity platforms, and analytics records
    const platforms = Array.from(new Set([
      ...(profile?.connected_platforms || []),
      ...identityPlatforms,
      ...anPlatforms
    ]));
    
    setConnectedPlatforms(platforms);
    
    // 1. Fetch current cached DB data immediately so UI isn't blocked
    const apiData = await fetchPlatformData(platforms);
    setData(apiData);
    setLoading(false);
    return platforms;
  };

  useEffect(() => {
    let subscription = null;

    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const platforms = await reloadDashboardData();

      // 2. Trigger background sync via Edge Function & direct API
      if (platforms && platforms.length > 0) {
        syncPlatformData(platforms);
      }

      // 3. Realtime updates listener
      subscription = supabase.channel('dashboard-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'analytics', filter: `user_id=eq.${session.user.id}` }, () => {
          reloadDashboardData();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'content', filter: `user_id=eq.${session.user.id}` }, () => {
          reloadDashboardData();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'comments', filter: `user_id=eq.${session.user.id}` }, () => {
          reloadDashboardData();
        })
        .subscribe();
    };
    
    init();

    return () => {
      if (subscription) {
        supabase.removeChannel(subscription);
      }
    };
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <View style={styles.loadingPulse}>
          <Text style={styles.loadingIcon}>⟁</Text>
        </View>
        <Text style={styles.loadingText}>Syncing your platforms...</Text>
        <Text style={styles.loadingSub}>Pulling data from connected accounts</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <ScrollView style={styles.scroller} contentContainerStyle={styles.scrollContent}>
      
      {/* ─── Page Header ─── */}
      <View style={styles.pageHeader}>
        <View>
          <Text style={styles.greeting}>Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'} 👋</Text>
          <Text style={styles.pageTitle}>Your Creator Dashboard</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerBtn} onPress={() => openConnectModal('YouTube')}>
            <Text style={styles.headerBtnText}>+ Connect Channel</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ─── Connected Platforms Quick Status ─── */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24, paddingHorizontal: 30 }}>
        <Text style={{ fontSize: 13, color: '#666', marginRight: 12, fontWeight: '600' }}>Active Connections:</Text>
        {connectedPlatforms.length === 0 ? (
          <TouchableOpacity onPress={() => openConnectModal('YouTube')}>
            <Text style={{ fontSize: 13, color: '#ff6b6b', fontWeight: '500' }}>None. Click to connect YouTube.</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {connectedPlatforms.map(platformId => {
              const platformMap = { 'yt': 'YouTube', 'ig': 'Instagram', 'x': 'X (Twitter)', 'fb': 'Facebook', 'in': 'LinkedIn' };
              const name = platformMap[platformId] || platformId;
              const config = PLATFORMS[name];
              if (!config) return null;
              return (
                <View key={platformId} style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: config.bg, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: config.color + '30' }}>
                  <Image source={{ uri: config.logo }} style={{ width: 14, height: 14 }} resizeMode="contain" />
                </View>
              );
            })}
          </View>
        )}
      </View>

      {/* ─── Aggregated Stats Row ─── */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <View style={styles.statHeader}>
            <Text style={styles.statLabel}>Total Reach</Text>
            <Text style={styles.statTrendUp}>{data.overview.totalViews > 0 ? '↑ Live' : '—'}</Text>
          </View>
          <Text style={styles.statValue}>{data.overview.totalViews.toLocaleString()}</Text>
          <Text style={styles.statCaption}>Combined views across all platforms</Text>
        </View>

        <View style={styles.statCard}>
          <View style={styles.statHeader}>
            <Text style={styles.statLabel}>Audience</Text>
            <Text style={styles.statTrendUp}>{data.overview.totalFollowers > 0 ? '↑ Active' : '—'}</Text>
          </View>
          <Text style={styles.statValue}>{data.overview.totalFollowers.toLocaleString()}</Text>
          <Text style={styles.statCaption}>Followers & subscribers unified</Text>
        </View>

        <View style={styles.statCard}>
          <View style={styles.statHeader}>
            <Text style={styles.statLabel}>Engagement</Text>
            <Text style={styles.statTrendUp}>
              {parseFloat(data.overview.engagementRate || 0) > 0 ? '↑ Real-time' : '—'}
            </Text>
          </View>
          <Text style={styles.statValue}>{data.overview.engagementRate || '0.0%'}</Text>
          <Text style={styles.statCaption}>Average across connected platforms</Text>
        </View>

        <View style={styles.statCard}>
          <View style={styles.statHeader}>
            <Text style={styles.statLabel}>Revenue</Text>
            {data.overview.estimatedRevenue >= 0 && (
              <Text style={styles.statTrendUp}>↑ Est.</Text>
            )}
          </View>
          <Text style={styles.statValue}>
            {data.overview.estimatedRevenue < 0 
              ? "Unmonetized" 
              : `$${data.overview.estimatedRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
          </Text>
          <Text style={styles.statCaption}>
            {data.overview.estimatedRevenue < 0 
              ? "Grow your audience to monetize" 
              : "Estimated from monetized platforms"}
          </Text>
        </View>
      </View>

      {/* ─── Platform Breakdown Cards ─── */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Platform Performance</Text>
        <Text style={styles.sectionSub}>Real-time sync status for each connected platform</Text>
      </View>

      <View style={styles.platformGrid}>
        {Object.entries(PLATFORMS).map(([name, config]) => {
          const dbKeyMap = { 'YouTube': 'yt', 'Instagram': 'ig', 'X (Twitter)': 'x', 'Facebook': 'fb', 'LinkedIn': 'in' };
          const isConnected = connectedPlatforms.some(p => isPlatformMatch(p, dbKeyMap[name]));
          const stats = data?.platformStats?.[name];
          const hasApiData = Boolean(stats && (stats.rawFollowers !== undefined || stats.rawViews !== undefined));
          
          let statusText = 'Not connected';
          let dotStyle = styles.statusDotOff;
          
          if (isConnected) {
            if (hasApiData) {
              statusText = 'Receiving Data (Live)';
              dotStyle = styles.statusDotLive;
            } else {
              statusText = 'Connected (Sync Ready)';
              dotStyle = { width: 8, height: 8, borderRadius: 4, backgroundColor: '#9d50ff' };
            }
          }

          return (
            <View key={name} style={[
              styles.platformCard, 
              { 
                borderTopWidth: 3, 
                borderTopColor: config.color,
                ...(Platform.OS === 'web' ? { boxShadow: `0px 8px 24px ${config.color}15` } : {})
              }
            ]}>
              {/* Platform Header */}
              <View style={styles.platformCardHeader}>
                <View style={[styles.platformIconCircle, { backgroundColor: config.bg, padding: 0 }]}>
                  <Image source={{ uri: config.logo }} style={{ width: 22, height: 22 }} resizeMode="contain" />
                </View>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.platformCardName} numberOfLines={1}>{name}</Text>
                  <Text style={styles.platformCardSyncTime} numberOfLines={2}>{statusText}</Text>
                </View>
                
                {isConnected && (
                  <TouchableOpacity 
                    onPress={() => openConnectModal(name)} 
                    style={{ marginRight: 12, paddingHorizontal: 12, paddingVertical: 4, backgroundColor: '#f5f5f5', borderRadius: 12, borderWidth: 1, borderColor: '#eee' }}
                  >
                    <Text style={{ fontSize: 12, color: '#555', fontWeight: '600' }}>Manage</Text>
                  </TouchableOpacity>
                )}
                <View style={[styles.statusDot, dotStyle]} />
              </View>
              
              {isConnected ? (
                <View style={styles.platformMetrics}>
                  <View style={styles.platformMetricItem}>
                    <Text style={styles.platformMetricVal}>
                      {data.platformStats?.[name]?.followers || '0'}
                    </Text>
                    <Text style={styles.platformMetricLabel}>Followers</Text>
                  </View>
                  <View style={styles.platformMetricDivider} />
                  <View style={styles.platformMetricItem}>
                    <Text style={styles.platformMetricVal}>
                      {data.platformStats?.[name]?.views || '0'}
                    </Text>
                    <Text style={styles.platformMetricLabel}>Views</Text>
                  </View>
                  <View style={styles.platformMetricDivider} />
                  <View style={styles.platformMetricItem}>
                    <Text style={styles.platformMetricVal}>
                      {data.platformStats?.[name]?.engage || '0.0%'}
                    </Text>
                    <Text style={styles.platformMetricLabel}>Engage</Text>
                  </View>
                </View>
              ) : (
                <TouchableOpacity style={styles.connectPlatformBtn} onPress={() => openConnectModal(name)}>
                  <Text style={styles.connectPlatformText}>Connect {name} →</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </View>

      {/* ─── Content Feed ─── */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Cross-Platform Content</Text>
        <View style={styles.tabRow}>
          {['all', 'YouTube', 'Instagram', 'X'].map((tab) => (
            <TouchableOpacity 
              key={tab} 
              style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabBtnText, activeTab === tab && styles.tabBtnTextActive]}>
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
            return (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>◫</Text>
                <Text style={styles.emptyTitle}>
                  {activeTab === 'all' ? 'No content synced yet' : `No ${activeTab} content synced yet`}
                </Text>
                <Text style={styles.emptySub}>
                  {activeTab === 'all'
                    ? 'Connect your platforms above to start seeing your content here.'
                    : `Connect your ${activeTab} account in Platforms to start seeing your posts here.`}
                </Text>
              </View>
            );
          }

          return filteredContent.map((item) => {
            const platformConf = PLATFORMS[item.platform] || { color: '#5a6270', bg: 'rgba(255,255,255,0.04)', icon: '?' };
            return (
              <View key={item.id} style={styles.contentRow}>
                {/* Thumbnail */}
                <View style={styles.contentThumb}>
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
                  <Text style={styles.contentTitle} numberOfLines={1}>{item.title}</Text>
                  <View style={styles.contentMeta}>
                    <View style={[styles.contentPlatformChip, { backgroundColor: platformConf.bg }]}>
                      <Text style={[styles.contentPlatformChipText, { color: platformConf.color }]}>{item.platform}</Text>
                    </View>
                    <Text style={styles.contentMetaText}>{item.views} views</Text>
                    <Text style={[styles.contentMetaText, { color: '#10b981' }]}>• {item.engage} engage</Text>
                  </View>
                </View>
                {/* Actions */}
                <TouchableOpacity style={styles.contentActionBtn}>
                  <Text style={styles.contentActionText}>↗</Text>
                </TouchableOpacity>
              </View>
            );
          });
        })()}
      </View>

      {/* ─── Activity Stream ─── */}
      <View style={styles.twoCol}>
        {/* Recent Comments */}
        <View style={[styles.sectionCard, { flex: 1 }]}>
          <View style={styles.sectionCardHeader}>
            <Text style={styles.sectionCardTitle}>Activity Feed</Text>
            <Text style={styles.sectionCardAction}>View all →</Text>
          </View>
          {data.recentComments.length === 0 ? (
            <Text style={styles.emptySmall}>No recent activity</Text>
          ) : (
            data.recentComments.map((c) => {
              const pConf = PLATFORMS[c.platform] || { color: '#5a6270', bg: 'rgba(255,255,255,0.04)' };
              return (
                <View key={c.id} style={styles.activityRow}>
                  <View style={[styles.activityDot, { backgroundColor: pConf.color }]} />
                  <View style={styles.activityBody}>
                    <Text style={styles.activityUser}>{c.user} <Text style={styles.activityAction}>commented</Text></Text>
                    <Text style={styles.activityText} numberOfLines={1}>{c.text}</Text>
                  </View>
                  <Text style={styles.activityTime}>{c.time}</Text>
                </View>
              );
            })
          )}
        </View>

        {/* Quick Actions */}
        <View style={[styles.sectionCard, { flex: 1 }]}>
          <Text style={styles.sectionCardTitle}>Quick Actions</Text>
          
          <TouchableOpacity style={styles.quickAction}>
            <View style={[styles.qaIcon, { backgroundColor: 'rgba(0,229,255,0.08)' }]}>
              <Text style={styles.qaIconText}>📤</Text>
            </View>
            <View style={styles.qaBody}>
              <Text style={styles.qaTitle}>Cross-Post Content</Text>
              <Text style={styles.qaDesc}>Publish to multiple platforms at once</Text>
            </View>
            <Text style={styles.qaArrow}>→</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.quickAction}>
            <View style={[styles.qaIcon, { backgroundColor: 'rgba(225,48,108,0.08)' }]}>
              <Text style={styles.qaIconText}>📊</Text>
            </View>
            <View style={styles.qaBody}>
              <Text style={styles.qaTitle}>Generate Report</Text>
              <Text style={styles.qaDesc}>Unified analytics across platforms</Text>
            </View>
            <Text style={styles.qaArrow}>→</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.quickAction} onPress={() => openConnectModal('YouTube')}>
            <View style={[styles.qaIcon, { backgroundColor: 'rgba(10,102,194,0.08)' }]}>
              <Text style={styles.qaIconText}>🔗</Text>
            </View>
            <View style={styles.qaBody}>
              <Text style={styles.qaTitle}>Connect Platform</Text>
              <Text style={styles.qaDesc}>Add a new social account to sync</Text>
            </View>
            <Text style={styles.qaArrow}>→</Text>
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
    width: 56, height: 56, borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.04)',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 8,
  },
  loadingIcon: { fontSize: 28, color: '#000' },
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
    ...(Platform.OS === 'web' ? { boxShadow: '0px 8px 20px rgba(157, 80, 255, 0.05)' } : {
      shadowColor: '#9d50ff', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.08, shadowRadius: 30, elevation: 4
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
