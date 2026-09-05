import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Platform, Image, ActivityIndicator } from 'react-native';
import { supabase } from '../../lib/supabase';
import { fetchPlatformData, syncPlatformData } from '../../lib/api';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';

export default function AnalyticsScreen() {
  const [timeframe, setTimeframe] = useState('7D');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connectedPlatforms, setConnectedPlatforms] = useState([]);
  const router = useRouter();
  
  useEffect(() => {
    let subscription = null;

    async function loadData() {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      const { data: profile } = await supabase.from('profiles').select('connected_platforms').eq('id', session.user.id).single();
      const platforms = profile?.connected_platforms || [];
      setConnectedPlatforms(platforms);
      
      const platformData = await fetchPlatformData(platforms);
      setData(platformData);
      setLoading(false);

      if (platforms.length > 0) {
        syncPlatformData(platforms);
      }

      // Subscribe to real-time changes
      subscription = supabase.channel('schema-db-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'analytics', filter: `user_id=eq.${session.user.id}` }, () => {
           fetchPlatformData(platforms).then(setData);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'content', filter: `user_id=eq.${session.user.id}` }, () => {
           fetchPlatformData(platforms).then(setData);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'comments', filter: `user_id=eq.${session.user.id}` }, () => {
           fetchPlatformData(platforms).then(setData);
        })
        .subscribe();
    }
    
    loadData();

    return () => {
      if (subscription) {
        supabase.removeChannel(subscription);
      }
    };
  }, [timeframe]);

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#9d50ff" />
        <Text style={{ marginTop: 16, color: '#666' }}>Crunching the numbers...</Text>
      </View>
    );
  }

  // Empty State if no platforms are connected
  if (connectedPlatforms.length === 0) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 32 }]}>
        <Feather name="bar-chart-2" size={64} color="#ccc" style={{ marginBottom: 24 }} />
        <Text style={styles.pageTitle}>No Data Available</Text>
        <Text style={[styles.pageSubtitle, { textAlign: 'center', marginBottom: 32, maxWidth: 400 }]}>
          Connect at least one platform (like YouTube or Instagram) to start seeing deep analytics, audience demographics, and growth trends.
        </Text>
        <TouchableOpacity 
          style={{ backgroundColor: '#000', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 }}
          onPress={() => router.push('/dashboard/platforms')}
        >
          <Text style={{ color: '#fff', fontWeight: '600', fontSize: 16 }}>Connect Platforms →</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const PLATFORM_COLORS = {
    'YouTube': '#FF0000',
    'Instagram': '#E1306C',
    'X (Twitter)': '#000000',
    'Facebook': '#1877F2',
    'LinkedIn': '#0A66C2'
  };
  
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.pageTitle}>Analytics</Text>
          <Text style={styles.pageSubtitle}>Deep dive into your performance metrics</Text>
        </View>
        <View style={styles.timeframeToggle}>
          {['7D', '30D', '90D', 'YTD'].map(t => (
            <TouchableOpacity 
              key={t} 
              style={[styles.timeBtn, timeframe === t && styles.timeBtnActive]}
              onPress={() => setTimeframe(t)}
            >
              <Text style={[styles.timeBtnText, timeframe === t && styles.timeBtnTextActive]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Top Metrics Row */}
      <View style={styles.topMetricsRow}>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>TOTAL AUDIENCE</Text>
          <Text style={styles.metricValue}>{(data.overview.totalFollowers / 1000000).toFixed(1)}M</Text>
          <Text style={styles.metricTrendUp}>↑ 124K this week</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>ENGAGEMENT RATE</Text>
          <Text style={styles.metricValue}>5.2%</Text>
          <Text style={styles.metricTrendUp}>↑ 0.4% this week</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>REVENUE (EST)</Text>
          <Text style={[styles.metricValue, data.overview.estimatedRevenue < 0 && { fontSize: 24, marginTop: 4 }]}>
            {data.overview.estimatedRevenue < 0 
              ? "Unmonetized" 
              : `$${data.overview.estimatedRevenue.toLocaleString(undefined, { minimumFractionDigits: 0 })}`}
          </Text>
          {data.overview.estimatedRevenue >= 0 ? (
            <Text style={styles.metricTrendDown}>↓ $120 this week</Text>
          ) : (
            <Text style={[styles.metricTrendDown, { color: '#888' }]}>Grow audience to monetize</Text>
          )}
        </View>
      </View>

      <View style={{ flexDirection: Platform.OS === 'web' && window.innerWidth > 900 ? 'row' : 'column', gap: 32, marginBottom: 32 }}>
        
        {/* Main Chart Area */}
        <View style={[styles.card, { flex: 2 }]}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Audience Growth</Text>
            <Text style={styles.cardSubtitle}>Across all connected platforms</Text>
          </View>
          
          <View style={styles.chartWrap}>
            {data.chartData.length > 0 ? (
              data.chartData.map((d, i) => (
                <View key={i} style={styles.barCol}>
                  <View style={[styles.bar, { height: `${d.val}%` }]} />
                  <Text style={styles.barLabel}>{d.day}</Text>
                </View>
              ))
            ) : (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ color: '#999', fontSize: 13, marginBottom: 20 }}>Gathering historical data...</Text>
              </View>
            )}
          </View>
        </View>

        {/* Demographics Area */}
        <View style={[styles.card, { flex: 1 }]}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Demographics</Text>
            <Text style={styles.cardSubtitle}>Combined audience data</Text>
          </View>
          
          {data.demographics ? (
            <View>
              {/* Gender */}
              <Text style={styles.demoLabel}>Gender</Text>
              <View style={styles.demoBarContainer}>
                {data.demographics.gender.map(g => (
                  <View key={g.type} style={[styles.demoSegment, { width: `${g.pct}%`, backgroundColor: g.type === 'Male' ? '#3b82f6' : '#ec4899' }]} />
                ))}
              </View>
              <View style={styles.demoLegend}>
                {data.demographics.gender.map(g => (
                  <Text key={g.type} style={styles.demoLegendText}>
                    <Text style={{color: g.type === 'Male' ? '#3b82f6' : '#ec4899'}}>● </Text>{g.type} {g.pct}%
                  </Text>
                ))}
              </View>

              {/* Age */}
              <Text style={[styles.demoLabel, { marginTop: 24 }]}>Age Range</Text>
              {data.demographics.age.map(a => (
                <View key={a.range} style={{ marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={{ fontSize: 13, color: '#444' }}>{a.range}</Text>
                    <Text style={{ fontSize: 13, color: '#888', fontFamily: mono }}>{a.pct}%</Text>
                  </View>
                  <View style={{ height: 6, backgroundColor: '#f0f0f0', borderRadius: 3, overflow: 'hidden' }}>
                    <View style={{ height: '100%', width: `${a.pct}%`, backgroundColor: '#9d50ff' }} />
                  </View>
                </View>
              ))}
            </View>
          ) : (
             <Text style={{ color: '#888', fontSize: 14 }}>Demographics not available.</Text>
          )}
        </View>
      </View>

      <View style={{ flexDirection: Platform.OS === 'web' && window.innerWidth > 900 ? 'row' : 'column', gap: 32 }}>
        
        {/* Top Content */}
        <View style={[styles.card, { flex: 1.5 }]}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Top Performing Content</Text>
            <Text style={styles.cardSubtitle}>Based on highest engagement</Text>
          </View>
          
          <View style={styles.contentList}>
            {data.topContent.map(item => (
              <View key={item.id} style={styles.contentItem}>
                <Image source={{ uri: item.thumb }} style={styles.contentThumb} />
                <View style={styles.contentInfo}>
                  <Text style={styles.contentTitle} numberOfLines={1}>{item.title}</Text>
                  <Text style={styles.contentPlatform}>{item.platform}</Text>
                </View>
                <View style={styles.contentStats}>
                  <Text style={styles.contentStatMain}>{item.views}</Text>
                  <Text style={styles.contentStatSub}>Views</Text>
                </View>
                <View style={styles.contentStats}>
                  <Text style={[styles.contentStatMain, { color: '#10b981' }]}>{item.engage}</Text>
                  <Text style={styles.contentStatSub}>Engage</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Platform Breakdown */}
        <View style={[styles.card, { flex: 1 }]}>
          <Text style={styles.cardTitle}>Platform Breakdown</Text>
          
          <View style={styles.table}>
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.tableCell, { flex: 1.5 }]}>Platform</Text>
              <Text style={styles.tableCell}>Views</Text>
              <Text style={styles.tableCell}>Followers</Text>
            </View>
            
            {Object.entries(data.platformStats).map(([platform, stats], i) => (
              <View key={platform} style={styles.tableRow}>
                <View style={[styles.tableCell, { flex: 1.5, flexDirection: 'row', alignItems: 'center' }]}>
                  <View style={[styles.platformDot, { backgroundColor: PLATFORM_COLORS[platform] || '#000' }]} />
                  <Text style={styles.platformName}>{platform}</Text>
                </View>
                <Text style={[styles.tableCell, styles.cellValue]}>{stats.views}</Text>
                <Text style={[styles.tableCell, styles.cellValue]}>{stats.followers}</Text>
              </View>
            ))}
          </View>
        </View>

      </View>

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
