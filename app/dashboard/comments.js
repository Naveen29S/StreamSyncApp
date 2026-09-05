import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, TextInput, Platform, Image } from 'react-native';

const COMMENTS = [
  { id: '1', user: 'AlexTech', platform: 'YouTube', color: '#FF0000', text: 'This was super helpful, thanks!', time: '10m', unread: true },
  { id: '2', user: 'SarahDesign', platform: 'Instagram', color: '#E1306C', text: 'Love the color palette you used here 🔥', time: '1h', unread: true },
  { id: '3', user: 'DevGuy99', platform: 'X (Twitter)', color: '#000000', text: 'Are you planning to open source this?', time: '3h', unread: false },
  { id: '4', user: 'MarketingPro', platform: 'LinkedIn', color: '#0A66C2', text: 'Great insights on remote work trends.', time: '5h', unread: false },
  { id: '5', user: 'JaneDoe', platform: 'YouTube', color: '#FF0000', text: 'Could you do a tutorial on the backend setup?', time: '1d', unread: false },
];

export default function CommentsScreen() {
  const [activeId, setActiveId] = useState('1');
  
  const activeComment = COMMENTS.find(c => c.id === activeId);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.pageTitle}>Inbox</Text>
          <Text style={styles.pageSubtitle}>Respond to your community across all platforms</Text>
        </View>
        <View style={styles.headerFilters}>
          <TouchableOpacity style={[styles.filterBtn, styles.filterBtnActive]}>
            <Text style={[styles.filterBtnText, styles.filterBtnTextActive]}>Unread (2)</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.filterBtn}>
            <Text style={styles.filterBtnText}>All</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.inboxWrapper}>
        
        {/* Left List */}
        <View style={styles.inboxList}>
          <ScrollView>
            {COMMENTS.map((c) => {
              const isActive = c.id === activeId;
              return (
                <TouchableOpacity 
                  key={c.id} 
                  style={[styles.commentRow, isActive && styles.commentRowActive]}
                  onPress={() => setActiveId(c.id)}
                >
                  <View style={styles.rowHeader}>
                    <Text style={[styles.rowUser, isActive && styles.textWhite]}>{c.user}</Text>
                    <Text style={[styles.rowTime, isActive && styles.textWhite70]}>{c.time}</Text>
                  </View>
                  <Text style={[styles.rowPlatform, { color: isActive ? '#fff' : c.color }]} style={[{ fontSize: 10, fontWeight: '700', marginBottom: 6, color: isActive ? 'rgba(255,255,255,0.7)' : c.color }]}>
                    {c.platform}
                  </Text>
                  <Text style={[styles.rowText, isActive && styles.textWhite]} numberOfLines={2}>{c.text}</Text>
                  {c.unread && !isActive && <View style={styles.unreadDot} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Right Detail Pane */}
        <View style={styles.inboxDetail}>
          {activeComment ? (
            <View style={styles.detailInner}>
              
              <View style={styles.detailHeader}>
                <View style={styles.detailUserWrap}>
                  <View style={styles.detailAvatar}>
                    <Text style={styles.detailAvatarText}>{activeComment.user[0]}</Text>
                  </View>
                  <View>
                    <Text style={styles.detailUserName}>{activeComment.user}</Text>
                    <Text style={styles.detailMeta}>via {activeComment.platform} • {activeComment.time} ago</Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.resolveBtn}>
                  <Text style={styles.resolveBtnText}>✓ Resolve</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.chatArea}>
                <View style={styles.chatBubbleRecv}>
                  <Text style={styles.chatTextRecv}>{activeComment.text}</Text>
                </View>
              </ScrollView>

              <View style={styles.replyArea}>
                <TextInput 
                  style={styles.replyInput}
                  placeholder={`Reply to ${activeComment.user}...`}
                  placeholderTextColor="#999"
                  multiline
                />
                <TouchableOpacity style={styles.sendBtn}>
                  <Text style={styles.sendBtnText}>Send</Text>
                </TouchableOpacity>
              </View>
              
            </View>
          ) : (
            <View style={styles.emptyDetail}>
              <Text style={styles.emptyDetailText}>Select a conversation</Text>
            </View>
          )}
        </View>

      </View>
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
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2,
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
    right: 20,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#9d50ff',
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
  },
  detailAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#eee',
    justifyContent: 'center',
    alignItems: 'center',
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
  resolveBtnText: {
    color: '#10b981',
    fontWeight: '600',
    fontSize: 13,
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
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.02, shadowRadius: 4,
  },
  chatTextRecv: {
    fontSize: 14,
    color: '#000',
    lineHeight: 22,
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
    minHeight: 80,
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
  },
  emptyDetailText: {
    color: '#999',
    fontSize: 16,
    fontWeight: '500',
  },
});
