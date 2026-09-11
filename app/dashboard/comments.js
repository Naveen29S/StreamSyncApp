import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, TextInput, Platform, Image, ActivityIndicator } from 'react-native';
import { supabase } from '../../lib/supabase';
import { normalizePlatformName, normalizePlatformKey, syncPlatformData } from '../../lib/api';
import { useRouter } from 'expo-router';
import ConnectModal from '../../components/ConnectModal';

const PLATFORM_COLORS = {
  'YouTube': '#FF0000',
  'Twitch': '#9146FF',
  'Instagram': '#E1306C',
  'X (Twitter)': '#000000',
  'Facebook': '#1877F2',
  'LinkedIn': '#0A66C2'
};

function formatRelativeTime(dateStr) {
  if (!dateStr) return 'recently';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = Math.max(0, now - date);
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) return `${diffDays}d`;
  if (diffHours > 0) return `${diffHours}h`;
  if (diffMins > 0) return `${diffMins}m`;
  return 'just now';
}

export default function CommentsScreen() {
  const router = useRouter();
  const [comments, setComments] = useState([]);
  const [connectedPlatforms, setConnectedPlatforms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [connectModalVisible, setConnectModalVisible] = useState(false);
  const [activeId, setActiveId] = useState(null);
  const [activeFilter, setActiveFilter] = useState('All');
  const [replyText, setReplyText] = useState('');
  const [repliedComments, setRepliedComments] = useState({});
  const [resolvedMap, setResolvedMap] = useState({});

  const loadComments = async () => {
    try {
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

      if (platforms.length === 0) {
        setComments([]);
        setActiveId(null);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('comments')
        .select('*, content(title, platform)')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const mapped = (data || [])
        .filter(c => connectedPlatforms.includes(normalizePlatformKey(c.content?.platform || 'yt')))
        .map((c, index) => {
          const platformName = normalizePlatformName(c.content?.platform || 'YouTube');
          return {
            id: c.id,
            user: c.author_name || 'YouTube Viewer',
            avatar: c.author_avatar || null,
            platform: platformName,
            videoTitle: c.content?.title || 'YouTube Upload',
            color: PLATFORM_COLORS[platformName] || '#FF0000',
            text: c.text || '',
            time: formatRelativeTime(c.created_at),
            unread: index < 2,
            createdAt: c.created_at
          };
        });

      setComments(mapped);
      if (mapped.length > 0) {
        if (!activeId || !mapped.some(m => m.id === activeId)) {
          setActiveId(mapped[0].id);
        }
      } else {
        setActiveId(null);
      }
    } catch (err) {
      console.warn("Failed to load comments:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    let subscription = null;

    loadComments();

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted || !session) return;

      const channelName = `comments-db-sync-${session.user.id}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const channel = supabase.channel(channelName)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'comments', filter: `user_id=eq.${session.user.id}` }, () => {
          if (isMounted) loadComments();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${session.user.id}` }, () => {
          if (isMounted) loadComments();
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
  }, []);

  const handleSyncComments = async () => {
    setSyncing(true);
    if (connectedPlatforms.length > 0) {
      await syncPlatformData(connectedPlatforms);
    }
    await loadComments();
    setSyncing(false);
  };

  const handleSendReply = () => {
    if (!replyText.trim() || !activeId) return;
    setRepliedComments(prev => ({
      ...prev,
      [activeId]: [...(prev[activeId] || []), replyText.trim()]
    }));
    setReplyText('');
  };

  const handleToggleResolve = () => {
    if (!activeId) return;
    setResolvedMap(prev => ({
      ...prev,
      [activeId]: !prev[activeId]
    }));
  };

  const filteredComments = comments.filter(c => {
    if (activeFilter === 'Unread') return c.unread && !resolvedMap[c.id];
    if (activeFilter === 'YouTube') return c.platform === 'YouTube';
    return true;
  });

  const activeComment = comments.find(c => c.id === activeId) || filteredComments[0] || null;
  const isResolved = activeComment ? Boolean(resolvedMap[activeComment.id]) : false;
  const currentReplies = activeComment ? (repliedComments[activeComment.id] || []) : [];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.pageTitle}>Inbox</Text>
          <Text style={styles.pageSubtitle}>Respond to your community across all platforms</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <TouchableOpacity 
            style={styles.refreshBtn} 
            onPress={handleSyncComments}
            disabled={syncing}
          >
            <Text style={styles.refreshBtnText}>{syncing ? 'Syncing...' : '↻ Refresh'}</Text>
          </TouchableOpacity>
          <View style={styles.headerFilters}>
            {['All', 'Unread', 'YouTube'].map(f => (
              <TouchableOpacity 
                key={f}
                style={[styles.filterBtn, activeFilter === f && styles.filterBtnActive]}
                onPress={() => setActiveFilter(f)}
              >
                <Text style={[styles.filterBtnText, activeFilter === f && styles.filterBtnTextActive]}>
                  {f === 'Unread' ? `Unread (${comments.filter(c => c.unread && !resolvedMap[c.id]).length})` : f}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {/* Main Inbox Container */}
      <View style={styles.inboxWrapper}>
        {/* Left List */}
        <View style={styles.inboxList}>
          {loading ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <ActivityIndicator size="small" color="#9d50ff" />
              <Text style={{ marginTop: 8, color: '#888', fontSize: 13 }}>Loading inbox...</Text>
            </View>
          ) : filteredComments.length === 0 ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
              <Text style={{ fontSize: 32, marginBottom: 8 }}>💬</Text>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#000', marginBottom: 4 }}>No Comments Found</Text>
              <Text style={{ fontSize: 12, color: '#888', textAlign: 'center', marginBottom: 16 }}>
                {connectedPlatforms.includes('yt')
                  ? 'Your YouTube channel is connected. Comments from viewers will appear here when posted on your videos.'
                  : 'Connect your YouTube channel to view audience comments.'}
              </Text>
              {connectedPlatforms.includes('yt') ? (
                <TouchableOpacity 
                  style={styles.connectLinkBtn}
                  onPress={handleSyncComments}
                  disabled={syncing}
                >
                  <Text style={styles.connectLinkText}>{syncing ? 'Syncing...' : '↻ Refresh Comments'}</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity 
                  style={styles.connectLinkBtn}
                  onPress={() => setConnectModalVisible(true)}
                >
                  <Text style={styles.connectLinkText}>Connect YouTube →</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <ScrollView>
              {filteredComments.map((c) => {
                const isActive = activeComment && c.id === activeComment.id;
                const cResolved = Boolean(resolvedMap[c.id]);

                return (
                  <TouchableOpacity 
                    key={c.id} 
                    style={[styles.commentRow, isActive && styles.commentRowActive]}
                    onPress={() => setActiveId(c.id)}
                  >
                    <View style={styles.rowHeader}>
                      <Text style={[styles.rowUser, isActive && styles.textWhite]} numberOfLines={1}>{c.user}</Text>
                      <Text style={[styles.rowTime, isActive && styles.textWhite70]}>{c.time}</Text>
                    </View>
                    <Text style={[{ fontSize: 11, fontWeight: '700', marginBottom: 6, color: isActive ? 'rgba(255,255,255,0.8)' : c.color }]}>
                      {c.platform}
                    </Text>
                    <Text style={[styles.rowText, isActive && styles.textWhite]} numberOfLines={2}>{c.text}</Text>
                    {c.unread && !isActive && !cResolved && <View style={styles.unreadDot} />}
                    {cResolved && (
                      <View style={[styles.resolvedBadge, isActive && { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                        <Text style={[styles.resolvedBadgeText, isActive && { color: '#fff' }]}>✓ Done</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>

        {/* Right Detail Pane */}
        <View style={styles.inboxDetail}>
          {activeComment ? (
            <View style={styles.detailInner}>
              <View style={styles.detailHeader}>
                <View style={styles.detailUserWrap}>
                  {activeComment.avatar ? (
                    <Image source={{ uri: activeComment.avatar }} style={styles.detailAvatarImg} />
                  ) : (
                    <View style={styles.detailAvatar}>
                      <Text style={styles.detailAvatarText}>{activeComment.user[0]}</Text>
                    </View>
                  )}
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text style={styles.detailUserName}>{activeComment.user}</Text>
                    <Text style={styles.detailMeta} numberOfLines={1}>
                      via {activeComment.platform} • on "{activeComment.videoTitle}" • {activeComment.time} ago
                    </Text>
                  </View>
                </View>
                <TouchableOpacity 
                  style={[styles.resolveBtn, isResolved && styles.resolveBtnActive]}
                  onPress={handleToggleResolve}
                >
                  <Text style={[styles.resolveBtnText, isResolved && styles.resolveBtnTextActive]}>
                    {isResolved ? '✓ Resolved' : 'Mark Resolved'}
                  </Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.chatArea}>
                <View style={styles.chatBubbleRecv}>
                  <Text style={styles.chatTextRecv}>{activeComment.text}</Text>
                  <Text style={styles.chatTimestamp}>{activeComment.time} ago</Text>
                </View>

                {currentReplies.map((r, i) => (
                  <View key={i} style={styles.chatBubbleSent}>
                    <Text style={styles.chatTextSent}>{r}</Text>
                    <Text style={styles.chatTimestampSent}>Just now</Text>
                  </View>
                ))}
              </ScrollView>

              <View style={styles.replyArea}>
                <TextInput 
                  style={styles.replyInput}
                  placeholder={`Reply to ${activeComment.user}...`}
                  placeholderTextColor="#999"
                  value={replyText}
                  onChangeText={setReplyText}
                  multiline
                />
                <TouchableOpacity 
                  style={[styles.sendBtn, !replyText.trim() && { opacity: 0.6 }]}
                  onPress={handleSendReply}
                  disabled={!replyText.trim()}
                >
                  <Text style={styles.sendBtnText}>Send</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.emptyDetail}>
              <Text style={styles.emptyDetailText}>Select a conversation from the left to view details</Text>
            </View>
          )}
        </View>
      </View>

      <ConnectModal
        visible={connectModalVisible}
        onClose={() => setConnectModalVisible(false)}
        initialPlatform="YouTube"
        onSuccess={async () => {
          await handleSyncComments();
          await loadComments();
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
    padding: 32,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
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
  refreshBtn: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eee',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  refreshBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  headerFilters: {
    flexDirection: 'row',
    backgroundColor: '#eee',
    padding: 4,
    borderRadius: 8,
  },
  filterBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  filterBtnActive: {
    backgroundColor: '#fff',
    ...(Platform.OS === 'web' ? { boxShadow: '0 1px 2px rgba(0,0,0,0.08)' } : { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 }),
  },
  filterBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  filterBtnTextActive: {
    color: '#000',
  },

  inboxWrapper: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#eee',
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 20,
  },
  inboxList: {
    width: 320,
    borderRightWidth: 1,
    borderRightColor: '#eee',
    backgroundColor: '#fff',
  },
  commentRow: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f8f8f8',
    position: 'relative',
  },
  commentRowActive: {
    backgroundColor: '#000',
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  rowUser: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000',
    flex: 1,
    marginRight: 8,
  },
  rowTime: {
    fontSize: 11,
    color: '#999',
    fontFamily: mono,
  },
  rowText: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  textWhite: { color: '#fff' },
  textWhite70: { color: 'rgba(255,255,255,0.7)' },
  unreadDot: {
    position: 'absolute',
    top: 24,
    right: 16,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#9d50ff',
  },
  resolvedBadge: {
    marginTop: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  resolvedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#16a34a',
  },

  inboxDetail: {
    flex: 1,
    backgroundColor: '#fafafa',
  },
  detailInner: {
    flex: 1,
    flexDirection: 'column',
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  detailUserWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  detailAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#eee',
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailAvatarImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  detailAvatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#666',
  },
  detailUserName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
    marginBottom: 2,
  },
  detailMeta: {
    fontSize: 12,
    color: '#666',
    fontFamily: mono,
  },
  resolveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  resolveBtnActive: {
    backgroundColor: '#10b981',
  },
  resolveBtnText: {
    color: '#10b981',
    fontWeight: '600',
    fontSize: 13,
  },
  resolveBtnTextActive: {
    color: '#fff',
  },
  
  chatArea: {
    flex: 1,
    padding: 24,
  },
  chatBubbleRecv: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    borderTopLeftRadius: 4,
    maxWidth: '80%',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#eee',
    marginBottom: 16,
  },
  chatTextRecv: {
    fontSize: 14,
    color: '#000',
    lineHeight: 22,
  },
  chatTimestamp: {
    fontSize: 10,
    color: '#999',
    marginTop: 6,
    textAlign: 'right',
  },
  chatBubbleSent: {
    backgroundColor: '#9d50ff',
    padding: 16,
    borderRadius: 16,
    borderTopRightRadius: 4,
    maxWidth: '80%',
    alignSelf: 'flex-end',
    marginBottom: 16,
  },
  chatTextSent: {
    fontSize: 14,
    color: '#fff',
    lineHeight: 22,
  },
  chatTimestampSent: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 6,
    textAlign: 'right',
  },
  
  replyArea: {
    padding: 24,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 16,
  },
  replyInput: {
    flex: 1,
    backgroundColor: '#f8f8f8',
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 12,
    padding: 16,
    paddingTop: 16,
    fontSize: 14,
    minHeight: 70,
    color: '#000',
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}),
  },
  sendBtn: {
    backgroundColor: '#9d50ff',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  sendBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },

  emptyDetail: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyDetailText: {
    color: '#999',
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
  },
  connectLinkBtn: {
    backgroundColor: '#000',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  connectLinkText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
});
