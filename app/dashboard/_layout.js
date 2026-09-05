import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Platform, TextInput } from 'react-native';
import { Slot, useRouter, usePathname, Link } from 'expo-router';
import { supabase } from '../../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', path: '/dashboard', icon: 'grid' },
  { id: 'content', label: 'Content', path: '/dashboard/content', icon: 'layers' },
  { id: 'analytics', label: 'Analytics', path: '/dashboard/analytics', icon: 'bar-chart-2' },
  { id: 'comments', label: 'Comments', path: '/dashboard/comments', icon: 'message-square' },
  { id: 'schedule', label: 'Schedule', path: '/dashboard/schedule', icon: 'calendar' },
  { id: 'platforms', label: 'Platforms', path: '/dashboard/platforms', icon: 'share-2' },
];

export default function DashboardLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.replace('/auth');
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session) {
        router.replace('/auth');
        return;
      }
      setSession(session);
      
        // 1. Sync connected_platforms based strictly on Supabase identities (global sync)
        const { data: profile } = await supabase.from('profiles').select('connected_platforms, api_keys').eq('id', session.user.id).single();
        let newConnected = profile?.connected_platforms || [];
        
        // Cleanup any dirty data (full names) that might have been saved previously
        newConnected = newConnected.map(p => {
          if (p === 'YouTube') return 'yt';
          if (p === 'Facebook') return 'fb';
          if (p === 'Instagram') return 'ig';
          if (p === 'X (Twitter)') return 'x';
          if (p === 'LinkedIn') return 'in';
          return p;
        });

        let profileUpdated = false;
        const providerToPlatformMap = { 'google': 'yt', 'facebook': 'fb', 'twitter': 'x', 'linkedin_oidc': 'in' };
        
        // Fetch fresh user data from server to ensure identities are up-to-date
        const { data: { user } } = await supabase.auth.getUser();
        const identities = user?.identities || session.user?.identities || [];
        
        identities.forEach(id => {
           const platformId = providerToPlatformMap[id.provider];
           if (platformId && !newConnected.includes(platformId)) {
               newConnected.push(platformId);
               profileUpdated = true;
           }
        });
        
        if (profileUpdated) {
           const { error } = await supabase.from('profiles').update({ connected_platforms: newConnected }).eq('id', session.user.id);
           if (error) console.error('DEBUG UPDATE ERROR:', error);
        }

        // 2. Handle provider token capture if available
        if (session.provider_token) {
          console.log("DEBUG: Found provider_token in session:", session.provider_token.substring(0, 15) + "...");
          const lastProcessedToken = await AsyncStorage.getItem('last_processed_token');
          if (lastProcessedToken !== session.provider_token) {
            await AsyncStorage.setItem('last_processed_token', session.provider_token);
            
            const pendingPlatform = await AsyncStorage.getItem('pending_connection');
            let platformId = pendingPlatform;
            console.log("DEBUG: pendingPlatform:", pendingPlatform);
            
            if (!platformId) {
              const provider = session.user?.app_metadata?.provider;
              const platformMap = { google: 'yt', facebook: 'fb', twitter: 'x', linkedin_oidc: 'in' };
              platformId = platformMap[provider];
            }

            if (platformId) {
               console.log("DEBUG: Saving token for platform:", platformId);
               await AsyncStorage.removeItem('pending_connection');
               const newApiKeys = { ...(profile?.api_keys || {}) };
               newApiKeys[platformId] = session.provider_token;
               
               console.log("DEBUG: Attempting to save newApiKeys:", newApiKeys);
               
               const { data, error } = await supabase.from('profiles').upsert({
                 id: session.user.id,
                 email: session.user.email,
                 api_keys: newApiKeys
               }, { onConflict: 'id' }).select();
               
               if (error) {
                 console.error("DEBUG: Update API keys error:", error);
               } else if (!data || data.length === 0) {
                 console.error("DEBUG: Update returned 0 rows! RLS might be blocking this update or profile is missing!");
               } else {
                 console.log("DEBUG: Successfully updated API keys in DB! Row:", data[0]);
               }
            }
          } else {
             console.log("DEBUG: Token already processed, skipping.");
          }
        }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const userInitial = session?.user?.email?.[0]?.toUpperCase() || '?';

  return (
    <View style={styles.container}>
      
      {/* ─── Top Navigation Bar ─── */}
      <View style={styles.topbar}>
        <View style={styles.topbarLeft}>
          <View style={styles.brandRow}>
            <View style={styles.brandIcon}>
              <Text style={styles.brandIconText}>⟁</Text>
            </View>
            <View>
              <Text style={styles.brandName}>StreamSync</Text>
              <Text style={styles.brandTag}>Creator Hub</Text>
            </View>
          </View>
        </View>

        <View style={styles.topbarCenter}>
          <View style={styles.searchContainer}>
            <Text style={styles.searchIconText}>⌕</Text>
            <TextInput 
              style={styles.searchInput} 
              placeholder="Search content, analytics, comments..." 
              placeholderTextColor="#5a6270"
            />
            <View style={styles.searchShortcut}>
              <Text style={styles.searchShortcutText}>⌘K</Text>
            </View>
          </View>
        </View>

        <View style={styles.topbarRight}>
          {/* Sync Status Indicator */}
          <View style={styles.syncStatusPill}>
            <View style={styles.syncDot} />
            <Text style={styles.syncStatusText}>All synced</Text>
          </View>
          
          <TouchableOpacity style={styles.topIconBtn}>
            <Text style={styles.topIconEmoji}>🔔</Text>
          </TouchableOpacity>

          {session && (
            <TouchableOpacity style={styles.avatarBtn}>
              <Text style={styles.avatarText}>{userInitial}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ─── Body: Sidebar + Content ─── */}
      <View style={styles.body}>
        
        {/* ─── Left Sidebar ─── */}
        <View style={styles.sidebar}>
          {/* Platform Sync Indicators */}
          <View style={styles.platformSyncSection}>
            <Text style={styles.sidebarSectionLabel}>PLATFORMS</Text>
            {[
              { name: 'YouTube', color: '#FF0000', synced: true },
              { name: 'Instagram', color: '#E1306C', synced: true },
              { name: 'X', color: '#ffffff', synced: true },
              { name: 'Facebook', color: '#1877F2', synced: false },
              { name: 'LinkedIn', color: '#0A66C2', synced: false },
            ].map((p) => (
              <View key={p.name} style={styles.platformRow}>
                <View style={[styles.platformDot, { backgroundColor: p.color }]} />
                <Text style={styles.platformLabel}>{p.name}</Text>
                <View style={[styles.syncBadge, p.synced ? styles.syncBadgeActive : styles.syncBadgeIdle]}>
                  <Text style={[styles.syncBadgeText, p.synced ? styles.syncBadgeTextActive : styles.syncBadgeTextIdle]}>
                    {p.synced ? 'Live' : 'Idle'}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          {/* Navigation */}
          <View style={styles.navSection}>
            <Text style={styles.sidebarSectionLabel}>NAVIGATION</Text>
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.path || (item.path !== '/dashboard' && pathname.startsWith(item.path));
              return (
                <Link href={item.path} key={item.id} asChild>
                  <TouchableOpacity style={StyleSheet.flatten([styles.navItem, isActive && styles.navItemActive])}>
                    <View style={styles.navIconContainer}>
                      <Feather name={item.icon} size={18} color={isActive ? '#000' : '#666'} />
                    </View>
                    <Text style={[styles.navLabel, isActive && styles.navItemActiveText]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                </Link>
              );
            })}
          </View>

          {/* Bottom */}
          <View style={styles.sidebarBottom}>
            <Link href="/dashboard/settings" asChild>
              <TouchableOpacity style={StyleSheet.flatten([styles.navItem, pathname.startsWith('/dashboard/settings') && styles.navItemActive])}>
                <View style={styles.navIconContainer}>
                  <Feather name="settings" size={18} color={pathname.startsWith('/dashboard/settings') ? '#000' : '#666'} />
                </View>
                <Text style={[styles.navLabel, pathname.startsWith('/dashboard/settings') && styles.navItemActiveText]}>Settings</Text>
              </TouchableOpacity>
            </Link>
            
            <TouchableOpacity style={styles.navItem} onPress={handleSignOut}>
              <View style={styles.navIconContainer}>
                <Feather name="log-out" size={18} color="#ff6b6b" />
              </View>
              <Text style={[styles.navLabel, { color: '#ff6b6b' }]}>Log out</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ─── Main Content ─── */}
        <View style={styles.mainContent}>
          <Slot />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },

  // ─── Top Bar ───
  topbar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    zIndex: 100,
  },
  topbarLeft: {
    width: 220,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandIconText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: 'bold',
  },
  brandName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
    letterSpacing: -0.3,
  },
  brandTag: {
    fontSize: 10,
    color: '#666',
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  topbarCenter: {
    flex: 1,
    maxWidth: 520,
    marginHorizontal: 24,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    paddingHorizontal: 14,
    height: 36,
    borderWidth: 1,
    borderColor: '#eee',
  },
  searchIconText: {
    fontSize: 16,
    color: '#666',
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    color: '#000',
    fontSize: 13,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}),
  },
  searchShortcut: {
    backgroundColor: '#eee',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  searchShortcutText: {
    fontSize: 11,
    color: '#666',
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
  },
  topbarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  syncStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    gap: 6,
  },
  syncDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#9d50ff',
  },
  syncStatusText: {
    fontSize: 12,
    color: '#000',
    fontWeight: '600',
  },
  topIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    borderWidth: 1,
    borderColor: '#eee',
  },
  topIconEmoji: {
    fontSize: 14,
  },
  avatarBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },

  // ─── Body ───
  body: {
    flex: 1,
    flexDirection: 'row',
  },

  // ─── Sidebar ───
  sidebar: {
    width: 230,
    backgroundColor: '#fff',
    borderRightWidth: 1,
    borderRightColor: '#eee',
    paddingTop: 20,
    justifyContent: 'flex-start',
  },
  sidebarSectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#666',
    letterSpacing: 1.2,
    paddingHorizontal: 16,
    marginBottom: 10,
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
  },
  platformSyncSection: {
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    marginBottom: 16,
  },
  platformRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 16,
  },
  platformDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 10,
  },
  platformLabel: {
    flex: 1,
    fontSize: 13,
    color: '#000',
    fontWeight: '500',
  },
  syncBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  syncBadgeActive: {
    backgroundColor: 'rgba(157, 80, 255, 0.08)',
  },
  syncBadgeIdle: {
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
  },
  syncBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
  },
  syncBadgeTextActive: {
    color: '#9d50ff',
  },
  syncBadgeTextIdle: {
    color: '#666',
  },
  navSection: {
    flex: 1,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginHorizontal: 8,
    borderRadius: 6,
    marginBottom: 2,
  },
  navItemActive: {
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
  },
  navIconContainer: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  navLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  navItemActiveText: {
    color: '#000',
    fontWeight: '600',
  },
  sidebarBottom: {
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 12,
    paddingBottom: 16,
  },

  // ─── Main Content ───
  mainContent: {
    flex: 1,
  },
});
