import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Platform, Image, ActivityIndicator } from 'react-native';
import { supabase } from '../../lib/supabase';
import { fetchPlatformData, syncPlatformData, normalizePlatformKey } from '../../lib/api';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import ConnectModal from '../../components/ConnectModal';
import { useTheme } from '../../context/ThemeContext';

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

export default function AnalyticsScreen() {
  const { colors, isDark } = useTheme();
  const [timeframe, setTimeframe] = useState('7D');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connectedPlatforms, setConnectedPlatforms] = useState([]);
  const [connectModalVisible, setConnectModalVisible] = useState(false);
  const router = useRouter();

  const loadData = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('connected_platforms, api_keys')
      .eq('id', session.user.id)
      .maybeSingle();

    const identities = session.user?.identities || [];
    const providerToPlatformMap = { 'google': 'yt', 'facebook': 'fb', 'twitter': 'x', 'linkedin_oidc': 'in', 'linkedin': 'in' };
    const identityPlatforms = identities.map(id => providerToPlatformMap[id.provider]).filter(Boolean);

    const profileKeys = profile?.api_keys || {};
    const keyPlatforms = [];
    if (profileKeys.youtube || profileKeys.yt || profileKeys.youtube_channel_id || profileKeys.youtube_token) {
      keyPlatforms.push('yt');
    }
    if (profileKeys.twitch || profileKeys.twitch_username || profileKeys.twitch_login || profileKeys.twitch_channel_id) {
      keyPlatforms.push('twitch');
    }
    if (profileKeys.x || profileKeys.x_username || profileKeys.twitter_username || profileKeys.twitter || profileKeys.x_bearer_token) {
      keyPlatforms.push('x');
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

    loadData();

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted || !session) return;

      const channelName = `analytics-changes-${session.user.id}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const channel = supabase.channel(channelName)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${session.user.id}` }, () => {
          if (isMounted) loadData();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'analytics', filter: `user_id=eq.${session.user.id}` }, () => {
          if (isMounted) loadData();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'content', filter: `user_id=eq.${session.user.id}` }, () => {
          if (isMounted) loadData();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'comments', filter: `user_id=eq.${session.user.id}` }, () => {
          if (isMounted) loadData();
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
      if (subscription) {
        supabase.removeChannel(subscription);
        subscription = null;
      }
    };
  }, [timeframe]);

  if (loading) {
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
      
      {/* Header */}
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

      {/* Top Metrics Row */}
      <View style={styles.topMetricsRow}>
        <View dataSet={{ gridBox: 'true' }} style={[styles.metricCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>TOTAL AUDIENCE</Text>
          <Text style={[styles.metricValue, { color: colors.textPrimary }]}>{formatCompactNumber(data.overview.totalFollowers)}</Text>
          <Text style={styles.metricTrendUp}>{data.overview.totalFollowers > 0 ? '↑ Unified Audience' : '—'}</Text>
        </View>
        <View dataSet={{ gridBox: 'true' }} style={[styles.metricCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>ENGAGEMENT RATE</Text>
          <Text style={[styles.metricValue, { color: colors.textPrimary }]}>{data.overview.engagementRate || '0.0%'}</Text>
          <Text style={styles.metricTrendUp}>{parseFloat(data.overview.engagementRate || 0) > 0 ? '↑ Real-time average' : '—'}</Text>
        </View>
        <View dataSet={{ gridBox: 'true' }} style={[styles.metricCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>REVENUE (EST)</Text>
          <Text style={[styles.metricValue, { color: colors.textPrimary }, data.overview.estimatedRevenue < 0 && { fontSize: 24, marginTop: 4 }]}>
            {data.overview.estimatedRevenue < 0 
              ? "Unmonetized" 
              : `$${data.overview.estimatedRevenue.toLocaleString(undefined, { minimumFractionDigits: 0 })}`}
          </Text>
          {data.overview.estimatedRevenue >= 0 ? (
            <Text style={styles.metricTrendUp}>↑ Estimated earnings</Text>
          ) : (
            <Text style={[styles.metricTrendDown, { color: colors.textSecondary }]}>Grow audience to monetize</Text>
          )}
        </View>
      </View>

      <View style={{ flexDirection: Platform.OS === 'web' && window.innerWidth > 900 ? 'row' : 'column', gap: 32, marginBottom: 32 }}>
        
        {/* Main Chart Area */}
        <View dataSet={{ gridBox: 'true' }} style={[styles.card, { flex: 2, backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Audience Growth</Text>
            <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>Across all connected platforms</Text>
          </View>
          
          <View style={styles.chartWrap}>
            {data.chartData.length > 0 ? (
              data.chartData.map((d, i) => (
                <View key={i} style={styles.barCol}>
                  <View style={[styles.bar, { height: `${d.val}%`, backgroundColor: colors.accent }]} />
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

        {/* Demographics Area */}
        <View dataSet={{ gridBox: 'true' }} style={[styles.card, { flex: 1, backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Demographics</Text>
            <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>Combined audience data</Text>
          </View>
          
          {data.demographics ? (
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

      <View style={{ flexDirection: Platform.OS === 'web' && window.innerWidth > 900 ? 'row' : 'column', gap: 32 }}>
        
        {/* Top Content */}
        <View dataSet={{ gridBox: 'true' }} style={[styles.card, { flex: 1.5, backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Top Performing Content</Text>
            <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>Based on highest engagement</Text>
          </View>
          
          <View style={styles.contentList}>
            {data.topContent.length === 0 ? (
              <View style={{ padding: 24, alignItems: 'center' }}>
                <Text style={{ color: colors.textSecondary, fontSize: 13 }}>No content synced yet. Connect YouTube in Platforms.</Text>
              </View>
            ) : (
              data.topContent.map(item => (
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
          
          <View style={styles.table}>
            <View style={[styles.tableHeaderRow, { borderBottomColor: colors.border }]}>
              <Text style={[styles.tableCell, { flex: 1.5, color: colors.textSecondary }]}>Platform</Text>
              <Text style={[styles.tableCell, { color: colors.textSecondary }]}>Views</Text>
              <Text style={[styles.tableCell, { color: colors.textSecondary }]}>Followers</Text>
              <Text style={[styles.tableCell, { color: colors.textSecondary }]}>Engage</Text>
            </View>
            
            {Object.entries(data.platformStats).map(([platform, stats], i) => (
              <View key={platform} style={[styles.tableRow, { borderBottomColor: colors.border }]}>
                <View style={[styles.tableCell, { flex: 1.5, flexDirection: 'row', alignItems: 'center' }]}>
                  <View style={[styles.platformDot, { backgroundColor: PLATFORM_COLORS[platform] || colors.textPrimary }]} />
                  <Text style={[styles.platformName, { color: colors.textPrimary }]}>{platform}</Text>
                </View>
                <Text style={[styles.tableCell, styles.cellValue, { color: colors.textPrimary }]}>{stats.views}</Text>
                <Text style={[styles.tableCell, styles.cellValue, { color: colors.textPrimary }]}>{stats.followers}</Text>
                <Text style={[styles.tableCell, styles.cellValue, { color: '#10b981' }]}>{stats.engage}</Text>
              </View>
            ))}
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
    marginBottom: 32,
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
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#eee',
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#999',
    letterSpacing: 1,
    marginBottom: 12,
    fontFamily: mono,
  },
  metricValue: {
    fontSize: 32,
    fontWeight: '800',
    color: '#000',
    marginBottom: 8,
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
    marginBottom: 32,
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
    backgroundColor: '#9d50ff',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    opacity: 0.8,
  },
  barLabel: {
    marginTop: 12,
    fontSize: 12,
    color: '#999',
    fontFamily: mono,
    marginBottom: -24,
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
    marginTop: 20,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 12,
    marginBottom: 12,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
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
