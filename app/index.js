import React from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Platform, Dimensions, Image, Linking } from 'react-native';
import { Link } from 'expo-router';
import Animated, { FadeInUp, FadeInDown, FadeIn } from 'react-native-reanimated';

const { width } = Dimensions.get('window');

export default function App() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      
      {/* Subtle background glows */}
      <View style={styles.glowA} pointerEvents="none" />
      <View style={styles.glowB} pointerEvents="none" />

      {/* ─── Top Navigation ─── */}
      <View style={styles.navBar}>
        <View style={styles.logoContainer}>
          <Image
            source={require('../assets/logo-mark.png')}
            style={styles.logoIcon}
            resizeMode="contain"
          />
          <Text style={styles.brandName}>StreamSync</Text>
        </View>

        {width > 768 && (
          <View style={styles.navLinks}>
            <Text style={styles.navLink}>Features</Text>
            <Text style={styles.navLink}>Platforms</Text>
            <Text style={styles.navLink}>Pricing</Text>
          </View>
        )}

        <View style={styles.authButtons}>
          <Link href="/auth?mode=signin" asChild>
            <TouchableOpacity style={styles.signInButton}>
              <Text style={styles.signInText}>Sign In</Text>
            </TouchableOpacity>
          </Link>
          <Link href="/auth?mode=signup" asChild>
            <TouchableOpacity style={styles.navButton}>
              <Text style={styles.navButtonText}>Get Started</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </View>

      {/* ─── Hero Section ─── */}
      <Animated.View entering={FadeInDown.duration(800)} style={styles.heroSection}>
        <View style={styles.heroPill}>
          <View style={styles.heroPillDot} />
          <Text style={styles.heroPillText}>Multi-platform syncing for creators</Text>
        </View>
        <Text style={styles.heroTitle}>
          All your platforms.{'\n'}One command center.
        </Text>
        <Text style={styles.heroDesc}>
          Connect YouTube, Instagram, X, Facebook, and LinkedIn. See unified analytics, manage comments, and cross-post content — all from a single dashboard.
        </Text>

        <View style={styles.heroCTA}>
          <Link href="/auth?mode=signup" asChild>
            <TouchableOpacity style={styles.heroButton}>
              <Text style={styles.heroButtonText}>START SYNCING →</Text>
            </TouchableOpacity>
          </Link>
          <Link href="/auth?mode=signin" asChild>
            <TouchableOpacity style={styles.heroButtonOutline}>
              <Text style={styles.heroButtonOutlineText}>Sign In</Text>
            </TouchableOpacity>
          </Link>
        </View>

        {/* ─── Dashboard Preview ─── */}
        <Animated.View entering={FadeInUp.delay(300).duration(1000)} style={styles.previewContainer}>
          <View style={styles.previewWindow}>
            {/* Title bar */}
            <View style={styles.previewTitleBar}>
              <View style={styles.previewDots}>
                <View style={[styles.previewDot, { backgroundColor: '#ff6b6b' }]} />
                <View style={[styles.previewDot, { backgroundColor: '#ffd93d' }]} />
                <View style={[styles.previewDot, { backgroundColor: '#6bff8d' }]} />
              </View>
              <Text style={styles.previewBarText}>StreamSync Studio</Text>
              <View style={{ width: 40 }} />
            </View>
            {/* Mock content */}
            <View style={styles.previewBody}>
              <View style={styles.previewSidebar}>
                {['⬡', '◫', '◩', '◪'].map((i, idx) => (
                  <View key={idx} style={[styles.previewNavItem, idx === 0 && styles.previewNavItemActive]}>
                    <Text style={[styles.previewNavIcon, idx === 0 && { color: '#00e5ff' }]}>{i}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.previewMain}>
                <View style={styles.previewStatRow}>
                  {['#FF0000', '#E1306C', '#ffffff', '#1877F2'].map((c, i) => (
                    <View key={i} style={[styles.previewStat, { borderTopColor: c, borderTopWidth: 2 }]}>
                      <View style={[styles.previewStatDot, { backgroundColor: c }]} />
                    </View>
                  ))}
                </View>
                <View style={styles.previewChart} />
              </View>
            </View>
          </View>
        </Animated.View>
      </Animated.View>

      {/* ─── Features Section ─── */}
      <Animated.View entering={FadeIn.delay(600).duration(1000)} style={styles.featuresSection}>
        <Text style={styles.sectionTitle}>Built for multi-platform creators</Text>
        <Text style={styles.sectionDesc}>
          Stop switching between 5 different dashboards. StreamSync brings everything together.
        </Text>

        <View style={styles.featuresGrid}>
          {[
            { icon: '🔗', title: 'Platform Sync', desc: 'Connect YouTube, Instagram, X, Facebook, and LinkedIn in one click. Real-time data sync keeps you up to date.' },
            { icon: '📊', title: 'Unified Analytics', desc: 'See aggregated metrics across all platforms. Compare performance side-by-side without spreadsheets.' },
            { icon: '📤', title: 'Cross-Post', desc: 'Write once, publish everywhere. Schedule and distribute content across all your connected platforms.' },
          ].map((f, i) => (
            <View key={i} style={styles.featureCard}>
              <View style={styles.featureIconWrap}>
                <Text style={styles.featureIcon}>{f.icon}</Text>
              </View>
              <Text style={styles.featureTitle}>{f.title}</Text>
              <Text style={styles.featureDesc}>{f.desc}</Text>
            </View>
          ))}
        </View>
      </Animated.View>

      {/* ─── Footer ─── */}
      <View style={styles.footer}>
        <View style={styles.footerInner}>
          <View style={styles.footerBrand}>
            <Image
              source={require('../assets/logo-mark.png')}
              style={styles.logoIcon}
              resizeMode="contain"
            />
            <Text style={styles.footerBrandName}>StreamSync</Text>
          </View>

          <View style={styles.footerLinks}>
            <TouchableOpacity
              accessibilityRole="link"
              href="/privacy.html"
              onPress={() => {
                if (Platform.OS === 'web' && typeof window !== 'undefined') {
                  window.location.href = '/privacy.html';
                } else {
                  Linking.openURL('https://stream-sync-app.vercel.app/privacy.html');
                }
              }}
              style={styles.footerLinkBtn}
            >
              <Text style={styles.footerLinkText}>Privacy Policy</Text>
            </TouchableOpacity>

            <TouchableOpacity
              accessibilityRole="link"
              href="/terms.html"
              onPress={() => {
                if (Platform.OS === 'web' && typeof window !== 'undefined') {
                  window.location.href = '/terms.html';
                } else {
                  Linking.openURL('https://stream-sync-app.vercel.app/terms.html');
                }
              }}
              style={styles.footerLinkBtn}
            >
              <Text style={styles.footerLinkText}>Terms of Service</Text>
            </TouchableOpacity>

            <TouchableOpacity
              accessibilityRole="link"
              href="mailto:naveensujith31@gmail.com"
              onPress={() => Linking.openURL('mailto:naveensujith31@gmail.com')}
              style={styles.footerLinkBtn}
            >
              <Text style={styles.footerLinkText}>Contact Support</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.footerText}>© 2026 StreamSync. All rights reserved.</Text>
        </View>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  contentContainer: {
    overflow: 'hidden',
  },
  glowA: {
    position: 'absolute', top: -150, left: -100,
    width: 600, height: 600, borderRadius: 300,
    backgroundColor: '#ff4b91', opacity: 0.5,
    ...(Platform.OS === 'web' ? { filter: 'blur(140px)' } : {}),
  },
  glowB: {
    position: 'absolute', top: 600, right: -100,
    width: 500, height: 500, borderRadius: 250,
    backgroundColor: '#fb923c', opacity: 0.4,
    ...(Platform.OS === 'web' ? { filter: 'blur(120px)' } : {}),
  },

  // ─── Nav ───
  navBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 32, paddingVertical: 18, zIndex: 10,
  },
  logoContainer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoIcon: {
    width: 36,
    height: 36,
  },
  brandName: { fontSize: 20, fontWeight: '700', color: '#000', letterSpacing: -0.3 },
  navLinks: { flexDirection: 'row', gap: 28 },
  navLink: { fontSize: 14, color: '#666', fontWeight: '500' },
  authButtons: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  signInButton: { paddingHorizontal: 16, paddingVertical: 8 },
  signInText: { fontSize: 14, fontWeight: '600', color: '#000' },
  navButton: {
    backgroundColor: '#000', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 999,
  },
  navButtonText: { fontSize: 14, fontWeight: '600', color: '#fff' },

  // ─── Hero ───
  heroSection: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 20, zIndex: 10 },
  heroPill: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.04)', paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)',
    marginBottom: 24, gap: 8,
  },
  heroPillDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#9d50ff' },
  heroPillText: { fontSize: 13, color: '#333', fontWeight: '500', fontStyle: 'italic', fontFamily: Platform.OS === 'web' ? '"Playfair Display", Georgia, serif' : 'serif' },
  heroTitle: {
    fontSize: width > 768 ? 56 : 36, fontWeight: '700', color: '#000',
    textAlign: 'center', letterSpacing: -1.5, marginBottom: 20, maxWidth: 700,
    lineHeight: width > 768 ? 64 : 44,
  },
  heroDesc: {
    fontSize: 16, color: '#666', textAlign: 'center',
    maxWidth: 560, lineHeight: 26, marginBottom: 36,
  },
  heroCTA: { flexDirection: 'row', gap: 14, marginBottom: 80 },
  heroButton: {
    backgroundColor: '#000', paddingHorizontal: 28, paddingVertical: 14, borderRadius: 999,
  },
  heroButtonText: { color: '#fff', fontSize: 13, fontWeight: '600', letterSpacing: 1 },
  heroButtonOutline: {
    paddingHorizontal: 28, paddingVertical: 14, borderRadius: 999,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.15)',
  },
  heroButtonOutlineText: { color: '#000', fontSize: 13, fontWeight: '600' },

  // ─── Preview ───
  previewContainer: { width: '100%', maxWidth: 700, alignItems: 'center', marginBottom: 100 },
  previewWindow: {
    width: '100%', backgroundColor: '#fff', borderRadius: 24,
    borderWidth: 1, borderColor: '#e5e5e5', overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.08, shadowRadius: 40,
  },
  previewTitleBar: {
    height: 36, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: 14,
    backgroundColor: '#f8f8f8', borderBottomWidth: 1, borderBottomColor: '#eee',
  },
  previewDots: { flexDirection: 'row', gap: 6 },
  previewDot: { width: 10, height: 10, borderRadius: 5 },
  previewBarText: { fontSize: 11, color: '#aaa' },
  previewBody: { flexDirection: 'row', height: 240 },
  previewSidebar: {
    width: 48, backgroundColor: '#fafafa', borderRightWidth: 1,
    borderRightColor: '#eee', paddingVertical: 12, alignItems: 'center', gap: 8,
  },
  previewNavItem: {
    width: 32, height: 32, borderRadius: 6,
    justifyContent: 'center', alignItems: 'center',
  },
  previewNavItemActive: { backgroundColor: 'rgba(0,0,0,0.06)' },
  previewNavIcon: { fontSize: 14, color: '#aaa' },
  previewMain: { flex: 1, padding: 16, gap: 12 },
  previewStatRow: { flexDirection: 'row', gap: 8 },
  previewStat: {
    flex: 1, height: 48, backgroundColor: '#f8f8f8', borderRadius: 6,
    borderWidth: 1, borderColor: '#eee', justifyContent: 'center', alignItems: 'center',
  },
  previewStatDot: { width: 6, height: 6, borderRadius: 3 },
  previewChart: {
    flex: 1, backgroundColor: '#f8f8f8', borderRadius: 6,
    borderWidth: 1, borderColor: '#eee',
  },

  // ─── Features ───
  featuresSection: { paddingHorizontal: 32, paddingVertical: 60, alignItems: 'center', zIndex: 10 },
  sectionTitle: { fontSize: 28, fontWeight: '700', color: '#000', marginBottom: 8, textAlign: 'center', letterSpacing: -0.5 },
  sectionDesc: { fontSize: 15, color: '#666', textAlign: 'center', maxWidth: 480, marginBottom: 40, lineHeight: 22 },
  featuresGrid: {
    flexDirection: width > 768 ? 'row' : 'column',
    gap: 20, width: '100%', maxWidth: 900,
  },
  featureCard: {
    flex: 1, backgroundColor: '#fff', padding: 24, borderRadius: 12,
    borderWidth: 1, borderColor: '#eee',
  },
  featureIconWrap: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.04)', justifyContent: 'center',
    alignItems: 'center', marginBottom: 16,
  },
  featureIcon: { fontSize: 20 },
  featureTitle: { fontSize: 16, fontWeight: '700', color: '#000', marginBottom: 8 },
  featureDesc: { fontSize: 14, color: '#666', lineHeight: 22 },

  // ─── Footer ───
  footer: {
    paddingVertical: 48, paddingHorizontal: 32,
    backgroundColor: '#9d50ff', // Match the vibrant gradient footer color from screenshot
    borderTopLeftRadius: 40, borderTopRightRadius: 40,
  },
  footerInner: {
    flexDirection: width > 768 ? 'row' : 'column',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
    maxWidth: 1100,
    width: '100%',
    alignSelf: 'center',
  },
  footerBrand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  footerBrandName: { fontSize: 16, fontWeight: '600', color: '#fff' },
  footerLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  footerLinkBtn: {
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  footerLinkText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  footerText: { color: 'rgba(255,255,255,0.85)', fontSize: 13 },
});
