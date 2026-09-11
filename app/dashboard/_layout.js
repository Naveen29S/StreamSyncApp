import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Platform, TextInput, Image } from 'react-native';
import { Slot, useRouter, usePathname, Link } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { processSessionOAuthTokens, normalizePlatformKey, isPlatformMatch } from '../../lib/api';
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
  const [connectedPlatforms, setConnectedPlatforms] = useState([]);
  
  const fetchActivePlatforms = async (currentSession) => {
    if (!currentSession) return [];
    try {
      const [profileRes, anRes] = await Promise.all([
        supabase.from('profiles').select('connected_platforms, api_keys').eq('id', currentSession.user.id).maybeSingle(),
        supabase.from('analytics').select('platform').eq('user_id', currentSession.user.id)
      ]);
      const profile = profileRes.data;
      const anRows = anRes.data || [];
      const identities = currentSession.user?.identities || [];
      const providerToPlatformMap = { 'google': 'yt', 'facebook': 'fb', 'twitter': 'x', 'linkedin_oidc': 'in', 'linkedin': 'in' };
      const identityPlatforms = identities.map(id => providerToPlatformMap[id.provider]).filter(Boolean);

      const apiKeys = profile?.api_keys || {};
      const keyPlatforms = [];
      if (apiKeys.youtube || apiKeys.yt || apiKeys.youtube_channel_id || apiKeys.youtube_token) {
        keyPlatforms.push('yt');
      }
      if (apiKeys.twitch || apiKeys.twitch_username || apiKeys.twitch_login || apiKeys.twitch_channel_id) {
        keyPlatforms.push('twitch');
      }
      if (apiKeys.x || apiKeys.x_username || apiKeys.twitter_username || apiKeys.twitter || apiKeys.x_bearer_token) {
        keyPlatforms.push('x');
      }

      const anPlatforms = anRows.map(r => normalizePlatformKey(r.platform)).filter(Boolean);

      const rawList = [
        ...(profile?.connected_platforms || []),
        ...identityPlatforms,
        ...keyPlatforms,
        ...anPlatforms
      ];
      return Array.from(new Set(rawList.map(p => normalizePlatformKey(p)).filter(Boolean)));
    } catch (e) {
      console.warn('Error checking platforms in layout:', e);
      return [];
    }
  };

  useEffect(() => {
    let isMounted = true;
    let realtimeSub = null;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!isMounted) return;
      if (!session) router.replace('/auth');
      setSession(session);
      if (session) {
        if (session.provider_token) {
          await processSessionOAuthTokens(session);
        }
        const platforms = await fetchActivePlatforms(session);
        if (isMounted) {
          setConnectedPlatforms(platforms);
        }
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!isMounted) return;
      if (!session) {
        if (realtimeSub) {
          supabase.removeChannel(realtimeSub);
          realtimeSub = null;
        }
        router.replace('/auth');
        return;
      }
      setSession(session);
      
      if (session.provider_token) {
        await processSessionOAuthTokens(session);
      }

      const platforms = await fetchActivePlatforms(session);
      if (isMounted) setConnectedPlatforms(platforms);

      if (!isMounted) return;

      // Realtime listener for profile and analytics updates
      if (!realtimeSub) {
        const channelName = `layout-profile-${session.user.id}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const channel = supabase.channel(channelName)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${session.user.id}` }, async () => {
            if (isMounted) {
              const updated = await fetchActivePlatforms(session);
              if (isMounted) setConnectedPlatforms(updated);
            }
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'analytics', filter: `user_id=eq.${session.user.id}` }, async () => {
            if (isMounted) {
              const updated = await fetchActivePlatforms(session);
              if (isMounted) setConnectedPlatforms(updated);
            }
          });

        if (!isMounted) {
          supabase.removeChannel(channel);
          return;
        }

        realtimeSub = channel;
        channel.subscribe();
      }
    });

    return () => {
      isMounted = false;
      subscription?.unsubscribe?.();
      if (realtimeSub) {
        supabase.removeChannel(realtimeSub);
        realtimeSub = null;
      }
    };
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
            <Image
              source={require('../../assets/logo-mark.png')}
              style={styles.brandIcon}
              resizeMode="contain"
            />
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
            <View style={[styles.syncDot, { backgroundColor: connectedPlatforms.length > 0 ? '#10b981' : '#9d50ff' }]} />
            <Text style={styles.syncStatusText}>
              {connectedPlatforms.length > 0 ? `${connectedPlatforms.length} active` : 'Sync ready'}
            </Text>
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
              { id: 'yt', name: 'YouTube', color: '#FF0000' },
              { id: 'twitch', name: 'Twitch', color: '#9146FF' },
              { id: 'ig', name: 'Instagram', color: '#E1306C' },
              { id: 'x', name: 'X', color: '#000000' },
              { id: 'fb', name: 'Facebook', color: '#1877F2' },
              { id: 'in', name: 'LinkedIn', color: '#0A66C2' },
            ].map((p) => {
              const isSynced = connectedPlatforms.some(cp => isPlatformMatch(cp, p.id));

              return (
                <View key={p.name} style={styles.platformRow}>
                  <View style={[styles.platformDot, { backgroundColor: p.color }]} />
                  <Text style={styles.platformLabel}>{p.name}</Text>
                  <View style={[styles.syncBadge, isSynced ? styles.syncBadgeActive : styles.syncBadgeIdle]}>
                    <Text style={[styles.syncBadgeText, isSynced ? styles.syncBadgeTextActive : styles.syncBadgeTextIdle]}>
                      {isSynced ? 'Live' : 'Idle'}
                    </Text>
                  </View>
                </View>
              );
            })}
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
    width: 32,
    height: 32,
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
