import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, TextInput, Platform, Switch } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';

export default function SettingsScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const [activeTab, setActiveTab] = useState('Account');
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  
  // Toggles
  const [notifyComments, setNotifyComments] = useState(true);
  const [notifyMilestones, setNotifyMilestones] = useState(true);
  const [notifyNewsletter, setNotifyNewsletter] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setEmail(data.session?.user?.email || '');
    });
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.bodyBg }]}>
      <View style={styles.header}>
        <Text style={[styles.pageTitle, { color: colors.textPrimary }]}>Settings</Text>
        <Text style={[styles.pageSubtitle, { color: colors.textSecondary }]}>Manage your account preferences and integrations</Text>
      </View>

      <View style={[styles.settingsWrapper, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
        
        {/* Left Sidebar Menu */}
        <View style={[styles.settingsMenu, { backgroundColor: isDark ? colors.sidebarBg : '#fafafa', borderRightColor: colors.border }]}>
          {['Account', 'Notifications', 'Billing', 'Integrations'].map((tab) => (
            <TouchableOpacity 
              key={tab} 
              style={[
                styles.menuBtn, 
                activeTab === tab && [styles.menuBtnActive, { backgroundColor: isDark ? colors.accent : '#000' }]
              ]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[
                styles.menuBtnText, 
                { color: colors.textSecondary },
                activeTab === tab && styles.menuBtnTextActive
              ]}>{tab}</Text>
              {activeTab === tab && <Text style={styles.menuBtnArrow}>→</Text>}
            </TouchableOpacity>
          ))}
        </View>

        {/* Right Content Area */}
        <ScrollView style={[styles.settingsContent, { backgroundColor: colors.cardBg }]}>
          
          {activeTab === 'Account' && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Profile Information</Text>
              
              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Email Address</Text>
                <TextInput 
                  style={[
                    styles.input, 
                    styles.inputDisabled,
                    { 
                      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#f8f8f8',
                      borderColor: colors.border,
                      color: colors.textMuted 
                    }
                  ]} 
                  value={email} 
                  editable={false} 
                />
                <Text style={[styles.hint, { color: colors.textMuted }]}>Email is linked to your authentication provider.</Text>
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Creator Name</Text>
                <TextInput 
                  style={[
                    styles.input, 
                    { 
                      backgroundColor: colors.inputBg, 
                      borderColor: colors.border, 
                      color: colors.textPrimary 
                    }
                  ]} 
                  placeholder="e.g. Alex Tech" 
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Bio</Text>
                <TextInput 
                  style={[
                    styles.input, 
                    { 
                      height: 100, 
                      paddingTop: 16,
                      backgroundColor: colors.inputBg,
                      borderColor: colors.border,
                      color: colors.textPrimary
                    }
                  ]} 
                  placeholder="Tell your community a bit about yourself..." 
                  placeholderTextColor={colors.textMuted}
                  multiline
                />
              </View>

              <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.accent }]}>
                <Text style={styles.saveBtnText}>Save Changes</Text>
              </TouchableOpacity>
              
              <View style={[styles.dangerZone, { borderTopColor: isDark ? 'rgba(239, 68, 68, 0.2)' : '#ffe5e5' }]}>
                <Text style={styles.dangerTitle}>Danger Zone</Text>
                <TouchableOpacity style={[styles.deleteBtn, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : '#fff' }]}>
                  <Text style={styles.deleteBtnText}>Delete Account</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {activeTab === 'Notifications' && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Notification Preferences</Text>
              
              <View style={[styles.toggleRow, { borderBottomColor: colors.border }]}>
                <View style={styles.toggleInfo}>
                  <Text style={[styles.toggleTitle, { color: colors.textPrimary }]}>New Comments</Text>
                  <Text style={[styles.toggleDesc, { color: colors.textSecondary }]}>Get notified when you receive a new comment on any platform.</Text>
                </View>
                <Switch value={notifyComments} onValueChange={setNotifyComments} trackColor={{ true: colors.accent, false: isDark ? '#334155' : '#eee' }} />
              </View>

              <View style={[styles.toggleRow, { borderBottomColor: colors.border }]}>
                <View style={styles.toggleInfo}>
                  <Text style={[styles.toggleTitle, { color: colors.textPrimary }]}>Milestones & Growth</Text>
                  <Text style={[styles.toggleDesc, { color: colors.textSecondary }]}>Weekly reports on your audience growth and engagement.</Text>
                </View>
                <Switch value={notifyMilestones} onValueChange={setNotifyMilestones} trackColor={{ true: colors.accent, false: isDark ? '#334155' : '#eee' }} />
              </View>

              <View style={[styles.toggleRow, { borderBottomColor: colors.border }]}>
                <View style={styles.toggleInfo}>
                  <Text style={[styles.toggleTitle, { color: colors.textPrimary }]}>StreamSync Newsletter</Text>
                  <Text style={[styles.toggleDesc, { color: colors.textSecondary }]}>Product updates, tips, and creator news.</Text>
                </View>
                <Switch value={notifyNewsletter} onValueChange={setNotifyNewsletter} trackColor={{ true: colors.accent, false: isDark ? '#334155' : '#eee' }} />
              </View>
            </View>
          )}

          {activeTab === 'Integrations' && (
            <View style={styles.section}>
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>🔗</Text>
                <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>Manage Connected Platforms</Text>
                <Text style={[styles.emptySub, { color: colors.textSecondary }]}>Add, remove, or re-authenticate your social media accounts.</Text>
                <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.accent }]} onPress={() => router.push('/dashboard/platforms')}>
                  <Text style={styles.saveBtnText}>Go to Platforms</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {activeTab === 'Billing' && (
            <View style={styles.section}>
              <View style={[styles.planCard, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                <View style={styles.planHeader}>
                  <Text style={[styles.planName, { color: colors.textPrimary }]}>Creator Pro</Text>
                  <Text style={[styles.planPrice, { color: colors.textPrimary }]}>$29<Text style={[styles.planPriceMonth, { color: colors.textMuted }]}>/mo</Text></Text>
                </View>
                <Text style={[styles.planDesc, { color: colors.textSecondary }]}>You are currently on the Pro plan. Your next billing date is Nov 12, 2026.</Text>
                <TouchableOpacity style={[styles.manageBillingBtn, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
                  <Text style={[styles.manageBillingText, { color: colors.textPrimary }]}>Manage Subscription</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
    padding: 32,
  },
  header: {
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
  settingsWrapper: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#eee',
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.02, shadowRadius: 20,
  },
  settingsMenu: {
    width: 240,
    backgroundColor: '#fafafa',
    borderRightWidth: 1,
    borderRightColor: '#eee',
    padding: 24,
  },
  menuBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 4,
  },
  menuBtnActive: {
    backgroundColor: '#000',
  },
  menuBtnText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  menuBtnTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  menuBtnArrow: {
    color: '#fff',
    fontSize: 16,
  },
  
  settingsContent: {
    flex: 1,
    padding: 40,
  },
  section: {
    maxWidth: 600,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
    marginBottom: 24,
  },
  formGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#000',
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}),
  },
  inputDisabled: {
    backgroundColor: '#f8f8f8',
    color: '#999',
  },
  hint: {
    fontSize: 12,
    color: '#999',
    marginTop: 6,
  },
  saveBtn: {
    backgroundColor: '#9d50ff',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  dangerZone: {
    marginTop: 60,
    paddingTop: 32,
    borderTopWidth: 1,
    borderTopColor: '#ffe5e5',
  },
  dangerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ef4444',
    marginBottom: 16,
  },
  deleteBtn: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ef4444',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  deleteBtnText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '600',
  },

  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  toggleInfo: {
    flex: 1,
    paddingRight: 24,
  },
  toggleTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  toggleDesc: {
    fontSize: 13,
    color: '#666',
  },

  planCard: {
    backgroundColor: '#fafafa',
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 16,
    padding: 24,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  planName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
  },
  planPrice: {
    fontSize: 24,
    fontWeight: '800',
    color: '#000',
  },
  planPriceMonth: {
    fontSize: 14,
    fontWeight: '500',
    color: '#999',
  },
  planDesc: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
    lineHeight: 20,
  },
  manageBillingBtn: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  manageBillingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },

  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: { fontSize: 48, marginBottom: 16, opacity: 0.5 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#000', marginBottom: 8 },
  emptySub: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 24 },
});
