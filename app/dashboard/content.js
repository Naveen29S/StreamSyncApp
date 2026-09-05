import React, { useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Image, Platform } from 'react-native';

const POSTS = [
  { id: '1', title: 'How to build a SaaS in 24 hours', platform: 'YouTube', type: 'Video', views: '142K', date: 'Oct 12', thumbnail: 'https://images.unsplash.com/photo-1627398225058-f4daeb20b410?w=800&q=80', status: 'Published' },
  { id: '2', title: 'Top 5 design tips for 2026 🎨', platform: 'Instagram', type: 'Image', views: '45K', date: 'Oct 10', thumbnail: 'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=800&q=80', status: 'Published' },
  { id: '3', title: 'Just launched my new course! Check it out 👇', platform: 'X (Twitter)', type: 'Text', views: '210K', date: 'Oct 9', thumbnail: null, status: 'Published' },
  { id: '4', title: 'The future of remote work is hybrid', platform: 'LinkedIn', type: 'Article', views: '12K', date: 'Oct 8', thumbnail: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&q=80', status: 'Published' },
  { id: '5', title: 'React Native vs Flutter in 2026', platform: 'YouTube', type: 'Video', views: '89K', date: 'Oct 5', thumbnail: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&q=80', status: 'Draft' },
  { id: '6', title: 'Workspace tour 💻', platform: 'Instagram', type: 'Image', views: '67K', date: 'Oct 1', thumbnail: 'https://images.unsplash.com/photo-1497215728101-856f4ea42174?w=800&q=80', status: 'Scheduled' },
];

const PLATFORM_COLORS = {
  'YouTube': '#FF0000',
  'Instagram': '#E1306C',
  'X (Twitter)': '#000000',
  'Facebook': '#1877F2',
  'LinkedIn': '#0A66C2'
};

export default function ContentScreen() {
  const [activeFilter, setActiveFilter] = useState('All');
  const filters = ['All', 'Video', 'Image', 'Text'];

  const filteredPosts = activeFilter === 'All' 
    ? POSTS 
    : POSTS.filter(p => p.type === activeFilter);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.pageTitle}>Content Library</Text>
          <Text style={styles.pageSubtitle}>Manage and organize your posts across all platforms</Text>
        </View>
        <TouchableOpacity style={styles.createBtn}>
          <Text style={styles.createBtnIcon}>+</Text>
          <Text style={styles.createBtnText}>New Post</Text>
        </TouchableOpacity>
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

      <ScrollView contentContainerStyle={styles.grid}>
        {filteredPosts.map(post => (
          <View key={post.id} style={styles.card}>
            {post.thumbnail ? (
              <Image source={{ uri: post.thumbnail }} style={styles.thumbnail} resizeMode="cover" />
            ) : (
              <View style={[styles.thumbnail, styles.thumbnailPlaceholder]}>
                <Text style={styles.textPlaceholderIcon}>📝</Text>
              </View>
            )}
            
            <View style={styles.cardBody}>
              <View style={styles.cardTopRow}>
                <View style={[styles.platformBadge, { backgroundColor: PLATFORM_COLORS[post.platform] + '1A' }]}>
                  <View style={[styles.platformDot, { backgroundColor: PLATFORM_COLORS[post.platform] }]} />
                  <Text style={[styles.platformText, { color: PLATFORM_COLORS[post.platform] }]}>{post.platform}</Text>
                </View>
                <Text style={styles.statusText(post.status)}>{post.status}</Text>
              </View>
              
              <Text style={styles.postTitle} numberOfLines={2}>{post.title}</Text>
              
              <View style={styles.cardFooter}>
                <Text style={styles.postDate}>{post.date}</Text>
                <View style={styles.viewsContainer}>
                  <Text style={styles.viewsIcon}>👁</Text>
                  <Text style={styles.viewsText}>{post.views}</Text>
                </View>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
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
