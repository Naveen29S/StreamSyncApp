import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://dqyqczyqraddbmexnifi.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_QyaMAc9YR0iAPY8FaSLCzQ_QyPeEht8';

// Clean known non-fatal OAuth redirect error hashes (like identity_already_exists) BEFORE Supabase GoTrue tries to process them and breaks the active session
if (typeof window !== 'undefined' && window.location && window.location.hash) {
  try {
    const rawHash = window.location.hash.startsWith('#') ? window.location.hash.substring(1) : window.location.hash;
    const hashParams = new URLSearchParams(rawHash);
    const err = hashParams.get('error');
    const errCode = hashParams.get('error_code');
    const errDesc = hashParams.get('error_description');

    if (err || errCode) {
      try {
        sessionStorage.setItem('streamsync_oauth_redirect_info', JSON.stringify({
          error: err,
          errorCode: errCode,
          errorDescription: errDesc ? decodeURIComponent(errDesc.replace(/\+/g, ' ')) : null,
          timestamp: Date.now()
        }));
      } catch (e) {}

      // Strip the hash fragment immediately
      window.history.replaceState(null, document.title, window.location.pathname + (window.location.search || ''));
    }
  } catch (e) {
    console.warn('[supabase.js] Error parsing hash:', e);
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
  },
});

