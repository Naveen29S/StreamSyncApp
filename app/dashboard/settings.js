import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, TextInput, Platform, Switch } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'expo-router';

export default function SettingsScreen() {
  const router = useRouter();
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
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.pageTitle}>Settings</Text>
        <Text style={styles.pageSubtitle}>Manage your account preferences and integrations</Text>
      </View>

      <View style={styles.settingsWrapper}>
        
        {/* Left Sidebar Menu */}
        <View style={styles.settingsMenu}>
          {['Account', 'Notifications', 'Billing', 'Integrations'].map((tab) => (
            <TouchableOpacity 
              key={tab} 
              style={[styles.menuBtn, activeTab === tab && styles.menuBtnActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.menuBtnText, activeTab === tab && styles.menuBtnTextActive]}>{tab}</Text>
              {activeTab === tab && <Text style={styles.menuBtnArrow}>→</Text>}
            </TouchableOpacity>
          ))}
        </View>

        {/* Right Content Area */}
        <ScrollView style={styles.settingsContent}>
          
          {activeTab === 'Account' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Profile Information</Text>
              
              <View style={styles.formGroup}>
                <Text style={styles.label}>Email Address</Text>
                <TextInput 
                  style={[styles.input, styles.inputDisabled]} 
                  value={email} 
                  editable={false} 
                />
                <Text style={styles.hint}>Email is linked to your authentication provider.</Text>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Creator Name</Text>
                <TextInput 
                  style={styles.input} 
                  placeholder="e.g. Alex Tech" 
                  placeholderTextColor="#999"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Bio</Text>
                <TextInput 
                  style={[styles.input, { height: 100, paddingTop: 16 }]} 
                  placeholder="Tell your community a bit about yourself..." 
                  placeholderTextColor="#999"
                  multiline
                />
              </View>

              <TouchableOpacity style={styles.saveBtn}>
                <Text style={styles.saveBtnText}>Save Changes</Text>
              </TouchableOpacity>
              
              <View style={styles.dangerZone}>
                <Text style={styles.dangerTitle}>Danger Zone</Text>
                <TouchableOpacity style={styles.deleteBtn}>
                  <Text style={styles.deleteBtnText}>Delete Account</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {activeTab === 'Notifications' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Notification Preferences</Text>
              
              <View style={styles.toggleRow}>
                <View style={styles.toggleInfo}>
                  <Text style={styles.toggleTitle}>New Comments</Text>
                  <Text style={styles.toggleDesc}>Get notified when you receive a new comment on any platform.</Text>
                </View>
                <Switch value={notifyComments} onValueChange={setNotifyComments} trackColor={{ true: '#9d50ff', false: '#eee' }} />
              </View>

              <View style={styles.toggleRow}>
                <View style={styles.toggleInfo}>
                  <Text style={styles.toggleTitle}>Milestones & Growth</Text>
                  <Text style={styles.toggleDesc}>Weekly reports on your audience growth and engagement.</Text>
                </View>
                <Switch value={notifyMilestones} onValueChange={setNotifyMilestones} trackColor={{ true: '#9d50ff', false: '#eee' }} />
              </View>

              <View style={styles.toggleRow}>
                <View style={styles.toggleInfo}>
                  <Text style={styles.toggleTitle}>StreamSync Newsletter</Text>
                  <Text style={styles.toggleDesc}>Product updates, tips, and creator news.</Text>
                </View>
                <Switch value={notifyNewsletter} onValueChange={setNotifyNewsletter} trackColor={{ true: '#9d50ff', false: '#eee' }} />
              </View>
            </View>
          )}

          {activeTab === 'Integrations' && (
            <View style={styles.section}>
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>🔗</Text>
                <Text style={styles.emptyTitle}>Manage Connected Platforms</Text>
                <Text style={styles.emptySub}>Add, remove, or re-authenticate your social media accounts.</Text>
                <TouchableOpacity style={styles.saveBtn} onPress={() => router.push('/connects')}>
                  <Text style={styles.saveBtnText}>Go to Connects Page</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {activeTab === 'Billing' && (
            <View style={styles.section}>
              <View style={styles.planCard}>
                <View style={styles.planHeader}>
                  <Text style={styles.planName}>Creator Pro</Text>
                  <Text style={styles.planPrice}>$29<Text style={styles.planPriceMonth}>/mo</Text></Text>
                </View>
                <Text style={styles.planDesc}>You are currently on the Pro plan. Your next billing date is Nov 12, 2026.</Text>
                <TouchableOpacity style={styles.manageBillingBtn}>
                  <Text style={styles.manageBillingText}>Manage Subscription</Text>
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
