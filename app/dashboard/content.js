import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Image, Platform, ActivityIndicator } from 'react-native';
import { supabase } from '../../lib/supabase';
import { normalizePlatformName, normalizePlatformKey, syncPlatformData } from '../../lib/api';
import { useRouter } from 'expo-router';
import ConnectModal from '../../components/ConnectModal';

const PLATFORM_COLORS = {
  'YouTube': '#FF0000',
  'Instagram': '#E1306C',
  'X (Twitter)': '#000000',
  'Facebook': '#1877F2',
  'LinkedIn': '#0A66C2'
};

function formatCompactNumber(num) {
  if (num === null || num === undefined || isNaN(num)) return '0';
  const n = Number(num);
  if (n >= 1000000) {
    return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (n >= 1000) {
    return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return n.toLocaleString();
}

export default function ContentScreen() {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState('All');
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [connectModalVisible, setConnectModalVisible] = useState(false);
  const filters = ['All', 'YouTube', 'Video', 'Image', 'Text'];

  const loadContent = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from('content')
        .select('*')
        .eq('user_id', session.user.id)
        .order('views', { ascending: false });

      if (error) throw error;

      const mapped = (data || []).map(item => {
        const pName = normalizePlatformName(item.platform);
        const pKey = normalizePlatformKey(item.platform);
        const isVideo = pKey === 'yt' || (item.title && item.title.toLowerCase().includes('video'));

        return {
          id: item.id,
          title: item.title,
          platform: pName,
          platformKey: pKey,
          type: isVideo ? 'Video' : 'Text',
          views: formatCompactNumber(item.views),
          rawViews: Number(item.views || 0),
          date: item.published_at 
            ? new Date(item.published_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
            : 'Recent',
          thumbnail: item.thumbnail_url,
          status: 'Published',
          engagement: item.engagement !== null && item.engagement !== undefined ? `${Number(item.engagement).toFixed(1)}%` : null
        };
      });

      setPosts(mapped);
    } catch (err) {
      console.warn("Failed to load content:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContent();

    let subscription = null;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        subscription = supabase.channel('content-db-sync')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'content', filter: `user_id=eq.${session.user.id}` }, () => {
            loadContent();
          })
          .subscribe();
      }
    });

    return () => {
      if (subscription) supabase.removeChannel(subscription);
    };
  }, []);

  const handleSyncContent = async () => {
    setSyncing(true);
    await syncPlatformData(['yt']);
    await loadContent();
    setSyncing(false);
  };

  const filteredPosts = posts.filter(p => {
    if (activeFilter === 'All') return true;
    if (activeFilter === 'YouTube') return p.platformKey === 'yt' || p.platform === 'YouTube';
    if (activeFilter === 'Video') return p.type === 'Video';
    if (activeFilter === 'Image') return p.type === 'Image';
    if (activeFilter === 'Text') return p.type === 'Text';
    return true;
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.pageTitle}>Content Library</Text>
          <Text style={styles.pageSubtitle}>Manage and organize your posts across all platforms</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TouchableOpacity 
            style={[styles.createBtn, { backgroundColor: '#fff', borderWidth: 1, borderColor: '#eee' }]}
            onPress={handleSyncContent}
            disabled={syncing}
          >
            <Text style={[styles.createBtnText, { color: '#000' }]}>
              {syncing ? 'Syncing...' : '↻ Refresh Data'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.createBtn}
            onPress={() => setConnectModalVisible(true)}
          >
            <Text style={styles.createBtnIcon}>+</Text>
            <Text style={styles.createBtnText}>Connect Channel</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.filterRow}>
        {filters.map(f => (
          <TouchableOpacity 
            key={f} 
            style={[styles.filterChip, activeFilter === f && styles.filterChipActive]}
            onPress={() => setActiveFilter(f)}
          >
            <Text style={[styles.filterText, activeFilter === f && styles.filterTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#9d50ff" />
          <Text style={{ marginTop: 12, color: '#666' }}>Loading synced content...</Text>
        </View>
      ) : filteredPosts.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
          <Text style={{ fontSize: 36, marginBottom: 12 }}>🎬</Text>
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#000', marginBottom: 8 }}>
            {activeFilter === 'All' ? 'No Synced Videos or Posts' : `No ${activeFilter} Content`}
          </Text>
          <Text style={{ fontSize: 14, color: '#666', textAlign: 'center', maxWidth: 360, marginBottom: 24, lineHeight: 22 }}>
            Connect your YouTube channel to automatically sync your latest uploads, views, and engagement metrics.
          </Text>
          <TouchableOpacity 
            style={{ backgroundColor: '#000', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 999 }}
            onPress={() => setConnectModalVisible(true)}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Connect YouTube Channel →</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.grid}>
          {filteredPosts.map(post => (
            <View key={post.id} style={styles.card}>
              {post.thumbnail ? (
                <Image source={{ uri: post.thumbnail }} style={styles.thumbnail} resizeMode="cover" />
              ) : (
                <View style={[styles.thumbnail, styles.thumbnailPlaceholder]}>
                  <Text style={styles.textPlaceholderIcon}>🎬</Text>
                </View>
              )}
              
              <View style={styles.cardBody}>
                <View style={styles.cardTopRow}>
                  <View style={[styles.platformBadge, { backgroundColor: PLATFORM_COLORS[post.platform] ? (PLATFORM_COLORS[post.platform] + '1A') : 'rgba(0,0,0,0.06)' }]}>
                    <View style={[styles.platformDot, { backgroundColor: PLATFORM_COLORS[post.platform] || '#333' }]} />
                    <Text style={[styles.platformText, { color: PLATFORM_COLORS[post.platform] || '#333' }]}>{post.platform}</Text>
                  </View>
                  <Text style={styles.statusText(post.status)}>{post.status}</Text>
                </View>
                
                <Text style={styles.postTitle} numberOfLines={2}>{post.title}</Text>
                
                <View style={styles.cardFooter}>
                  <Text style={styles.postDate}>{post.date}</Text>
                  <View style={styles.viewsContainer}>
                    <Text style={styles.viewsIcon}>👁</Text>
                    <Text style={styles.viewsText}>{post.views} views</Text>
                    {post.engagement && (
                      <Text style={[styles.viewsText, { color: '#10b981', marginLeft: 8 }]}>• {post.engagement}</Text>
                    )}
                  </View>
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      <ConnectModal
        visible={connectModalVisible}
        onClose={() => setConnectModalVisible(false)}
        initialPlatform="YouTube"
        onSuccess={async () => {
          await handleSyncContent();
          await loadContent();
        }}
      />
    </View>
  );
}

const mono = Platform.OS === 'web' ? 'monospace' : undefined;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 32,
    paddingBottom: 24,
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
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#000',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
    gap: 8,
  },
  createBtnIcon: {
    color: '#fff',
    fontSize: 18,
    lineHeight: 18,
  },
  createBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 32,
    marginBottom: 24,
    gap: 10,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eee',
  },
  filterChipActive: {
    backgroundColor: '#000',
    borderColor: '#000',
  },
  filterText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '600',
  },
  filterTextActive: {
    color: '#fff',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 24,
    paddingBottom: 40,
    gap: 16,
  },
  card: {
    width: Platform.OS === 'web' ? 'calc(33.333% - 11px)' : '100%',
    minWidth: 280,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#eee',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
  },
  thumbnail: {
    width: '100%',
    height: 160,
    backgroundColor: '#f0f0f0',
  },
  thumbnailPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(157, 80, 255, 0.05)',
  },
  textPlaceholderIcon: {
    fontSize: 48,
    opacity: 0.5,
  },
  cardBody: {
    padding: 16,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  platformBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 6,
  },
  platformDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  platformText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: mono,
  },
  statusText: (status) => ({
    fontSize: 11,
    fontWeight: '600',
    color: status === 'Published' ? '#10b981' : (status === 'Draft' ? '#f59e0b' : '#3b82f6'),
    fontFamily: mono,
  }),
  postTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
    lineHeight: 22,
    marginBottom: 16,
    height: 44, // forces alignment for 2 lines
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  postDate: {
    fontSize: 12,
    color: '#999',
    fontFamily: mono,
  },
  viewsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewsIcon: {
    fontSize: 12,
    color: '#666',
  },
  viewsText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000',
    fontFamily: mono,
  },
});
