import React, { useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Platform } from 'react-native';

const DAYS = [
  { day: 'Mon', date: '15', active: false },
  { day: 'Tue', date: '16', active: false },
  { day: 'Wed', date: '17', active: true },
  { day: 'Thu', date: '18', active: false },
  { day: 'Fri', date: '19', active: false },
  { day: 'Sat', date: '20', active: false },
  { day: 'Sun', date: '21', active: false },
];

const INITIAL_POSTS = [
  { id: '1', time: '09:00 AM', title: 'Morning Motivation Tweet', platform: 'X (Twitter)', color: '#000000', date: '17' },
  { id: '2', time: '12:30 PM', title: 'New Vlog: Setup Tour', platform: 'YouTube', color: '#FF0000', date: '17' },
  { id: '3', time: '02:00 PM', title: 'Setup Photo Drop', platform: 'Instagram', color: '#E1306C', date: '17' },
  { id: '4', time: '05:00 PM', title: 'Tech Career Advice', platform: 'LinkedIn', color: '#0A66C2', date: '17' },
];

export default function ScheduleScreen() {
  const [selectedDate, setSelectedDate] = useState('17');
  const [posts, setPosts] = useState(INITIAL_POSTS);
  
  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [newPostPlatform, setNewPostPlatform] = useState('X (Twitter)');
  const [newPostTitle, setNewPostTitle] = useState('');
  const [newPostTime, setNewPostTime] = useState('10:00');

  const handleScheduleSubmit = () => {
    if (!newPostTitle) return;
    const colorMap = {
      'YouTube': '#FF0000',
      'Twitch': '#9146FF',
      'Instagram': '#E1306C',
      'X (Twitter)': '#000000',
      'Facebook': '#1877F2',
      'LinkedIn': '#0A66C2'
    };
    const newEntry = {
      id: Date.now().toString(),
      time: newPostTime,
      title: newPostTitle,
      platform: newPostPlatform,
      color: colorMap[newPostPlatform] || '#999',
      date: selectedDate
    };
    setPosts(prev => [...prev, newEntry].sort((a,b) => a.time.localeCompare(b.time)));
    setModalVisible(false);
    setNewPostTitle('');
  };

  const currentDayPosts = posts.filter(p => p.date === selectedDate);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.pageTitle}>Schedule</Text>
          <Text style={styles.pageSubtitle}>Plan and organize your upcoming content calendar</Text>
        </View>
        <TouchableOpacity style={styles.createBtn} onPress={() => setModalVisible(true)}>
          <Text style={styles.createBtnIcon}>+</Text>
          <Text style={styles.createBtnText}>Schedule Post</Text>
        </TouchableOpacity>
      </View>

      {/* Week Calendar Strip */}
      <View style={styles.calendarStrip}>
        {DAYS.map((d) => {
          const isActive = d.date === selectedDate;
          return (
            <TouchableOpacity 
              key={d.date} 
              style={[styles.dayCard, isActive && styles.dayCardActive]}
              onPress={() => setSelectedDate(d.date)}
            >
              <Text style={[styles.dayText, isActive && styles.dayTextActive]}>{d.day}</Text>
              <Text style={[styles.dateText, isActive && styles.dateTextActive]}>{d.date}</Text>
              {d.date === '17' && <View style={styles.hasContentDot} />}
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={styles.timeline}>
        {currentDayPosts.length > 0 ? (
          currentDayPosts.map((post, index) => (
            <View key={post.id} style={styles.timelineItem}>
              
              <View style={styles.timeCol}>
                <Text style={styles.timeText}>{post.time}</Text>
                {index !== currentDayPosts.length - 1 && <View style={styles.timeLine} />}
              </View>

              <View style={styles.postCard}>
                <View style={[styles.cardAccent, { backgroundColor: post.color }]} />
                <View style={styles.cardContent}>
                  <Text style={[styles.postPlatform, { color: post.color, fontWeight: '700', fontSize: 11, marginBottom: 4 }]}>{post.platform}</Text>
                  <Text style={styles.postTitle}>{post.title}</Text>
                </View>
                <TouchableOpacity style={styles.editBtn}>
                  <Text style={styles.editBtnText}>Edit</Text>
                </TouchableOpacity>
              </View>

            </View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📅</Text>
            <Text style={styles.emptyTitle}>No posts scheduled</Text>
            <Text style={styles.emptySub}>Take the day off, or schedule a new post!</Text>
          </View>
        )}
      </ScrollView>

      {/* Modal for Scheduling a New Post */}
      {modalVisible && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Schedule New Post</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.label}>Select Platform</Text>
              <View style={styles.platformSelector}>
                {['YouTube', 'Twitch', 'Instagram', 'X (Twitter)', 'LinkedIn', 'Facebook'].map(p => (
                  <TouchableOpacity 
                    key={p} 
                    style={[styles.platformChip, newPostPlatform === p && styles.platformChipActive]}
                    onPress={() => setNewPostPlatform(p)}
                  >
                    <Text style={[styles.platformChipText, newPostPlatform === p && styles.platformChipTextActive]}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Time (for {selectedDate})</Text>
              <View style={{
                  backgroundColor: '#f8f8f8',
                  borderWidth: 1,
                  borderColor: '#eee',
                  borderRadius: 12,
                  padding: 16,
                  height: 52,
                  marginBottom: 8
              }}>
                 <input 
                   type="time"
                   value={newPostTime}
                   onChange={(e) => setNewPostTime(e.target.value)}
                   style={{
                     width: '100%',
                     height: '100%',
                     background: 'transparent',
                     border: 'none',
                     outline: 'none',
                     fontSize: '14px',
                     fontFamily: 'inherit',
                     color: '#333'
                   }}
                 />
              </View>

              <Text style={styles.label}>Post Content / Title</Text>
              <View style={{
                  backgroundColor: '#f8f8f8',
                  borderWidth: 1,
                  borderColor: '#eee',
                  borderRadius: 12,
                  padding: 16,
                  height: 120,
              }}>
                 <input 
                   type="text"
                   value={newPostTitle}
                   onChange={(e) => setNewPostTitle(e.target.value)}
                   placeholder="What do you want to post?"
                   style={{
                     width: '100%',
                     height: '100%',
                     background: 'transparent',
                     border: 'none',
                     outline: 'none',
                     fontSize: '14px',
                     fontFamily: 'inherit'
                   }}
                 />
              </View>
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitBtn} onPress={handleScheduleSubmit}>
                <Text style={styles.submitBtnText}>Schedule Post</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
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
    backgroundColor: '#9d50ff',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
    gap: 8,
  },
  createBtnIcon: { color: '#fff', fontSize: 18, lineHeight: 18 },
  createBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  
  calendarStrip: {
    flexDirection: 'row',
    paddingHorizontal: 32,
    marginBottom: 32,
    justifyContent: 'space-between',
    maxWidth: 800,
  },
  dayCard: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 64,
    height: 80,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eee',
    position: 'relative',
  },
  dayCardActive: {
    backgroundColor: '#000',
    borderColor: '#000',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 10,
  },
  dayText: { fontSize: 13, color: '#999', fontWeight: '600', marginBottom: 4 },
  dayTextActive: { color: '#fff' },
  dateText: { fontSize: 20, color: '#000', fontWeight: '700', fontFamily: mono },
  dateTextActive: { color: '#fff' },
  hasContentDot: {
    position: 'absolute',
    bottom: 8,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#9d50ff',
  },

  timeline: {
    paddingHorizontal: 32,
    paddingBottom: 60,
    maxWidth: 800,
  },
  timelineItem: {
    flexDirection: 'row',
    minHeight: 120,
  },
  timeCol: {
    width: 80,
    alignItems: 'center',
  },
  timeText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
    fontFamily: mono,
    marginTop: 20,
  },
  timeLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#eee',
    marginTop: 16,
    marginBottom: -16, // Connect to next item
  },
  postCard: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#eee',
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.02, shadowRadius: 8,
    alignItems: 'center',
    paddingRight: 16,
  },
  cardAccent: {
    width: 6,
    height: '100%',
  },
  cardContent: {
    flex: 1,
    padding: 20,
  },
  postTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
  },
  editBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  editBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#000',
  },

  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: { fontSize: 48, marginBottom: 16, opacity: 0.5 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#000', marginBottom: 8 },
  emptySub: { fontSize: 14, color: '#666' },

  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  modalContent: {
    width: '90%',
    maxWidth: 500,
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 30,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#000' },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: '#f0f0f0',
    justifyContent: 'center', alignItems: 'center',
  },
  closeBtnText: { fontSize: 14, color: '#666', fontWeight: 'bold' },
  modalBody: { marginBottom: 32 },
  label: { fontSize: 13, fontWeight: '600', color: '#333', marginBottom: 12, marginTop: 16 },
  
  platformSelector: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  platformChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: '#f8f8f8', borderWidth: 1, borderColor: '#eee' },
  platformChipActive: { backgroundColor: '#000', borderColor: '#000' },
  platformChipText: { fontSize: 13, color: '#666', fontWeight: '500' },
  platformChipTextActive: { color: '#fff', fontWeight: '600' },

  timeSelector: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  timeChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: '#f8f8f8', borderWidth: 1, borderColor: '#eee' },
  timeChipActive: { backgroundColor: '#e5d5ff', borderColor: '#9d50ff' },
  timeChipText: { fontSize: 13, color: '#666', fontWeight: '600', fontFamily: mono },
  timeChipTextActive: { color: '#9d50ff' },

  modalFooter: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  cancelBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 999 },
  cancelBtnText: { color: '#666', fontWeight: '600', fontSize: 14 },
  submitBtn: { backgroundColor: '#9d50ff', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 999 },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
