import { supabase } from './supabase';

/**
 * StreamSync - API Service
 * 
 * This securely calls our Supabase Edge Function, which acts as the backend server.
 * The Edge Function holds the API Secrets (e.g., FB_PAGE_ACCESS_TOKEN) and makes
 * the actual fetch requests to the Facebook Graph API, YouTube API, etc., without
 * exposing tokens to the frontend.
 */

export const syncPlatformData = async (platforms) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    
    // Call the Edge Function to fetch new data from APIs and save to Supabase DB
    const res = await supabase.functions.invoke('fetch-platform-data', {
      body: { platforms }
    });
    console.log("DEBUG: Edge Function Response:", res);
  } catch (error) {
    console.error("Error syncing platform data:", error);
  }
};

export const fetchPlatformData = async (platforms) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("No session");
    const userId = session.user.id;

    // Fetch from new tables
    const { data: analytics } = await supabase.from('analytics').select('*').eq('user_id', userId);
    const { data: content } = await supabase.from('content').select('*').eq('user_id', userId).order('views', { ascending: false }).limit(5);
    const { data: comments } = await supabase.from('comments').select('*, content(title, platform)').eq('user_id', userId).order('created_at', { ascending: false }).limit(5);

    // Aggregate data
    let totalViews = 0;
    let totalFollowers = 0;
    let estimatedRevenue = 0;
    const platformStats = {};

    if (analytics && analytics.length > 0) {
      analytics.forEach(row => {
        if (platforms.includes(row.platform)) {
          totalViews += Number(row.total_views || 0);
          totalFollowers += Number(row.total_followers || 0);
          estimatedRevenue += Number(row.estimated_revenue || 0);
          
          let platformName = row.platform;
          if (row.platform === 'yt') platformName = 'YouTube';
          if (row.platform === 'ig') platformName = 'Instagram';
          if (row.platform === 'x') platformName = 'X (Twitter)';
          if (row.platform === 'fb') platformName = 'Facebook';
          if (row.platform === 'in') platformName = 'LinkedIn';

          platformStats[platformName] = {
            followers: row.total_followers,
            views: row.total_views,
            engage: row.engagement_rate + '%'
          };
        }
      });
    }


    const chartData = []; // Removed mock data; populate when time-series data is ready

    const demographics = null; // Removed mock data; populate when real demographic data is fetched

    const topContent = content?.map(c => ({
      id: c.id,
      title: c.title,
      platform: c.platform === 'yt' ? 'YouTube' : c.platform === 'ig' ? 'Instagram' : c.platform === 'x' ? 'X (Twitter)' : c.platform === 'fb' ? 'Facebook' : c.platform === 'in' ? 'LinkedIn' : c.platform,
      views: c.views,
      engage: c.engagement + '%',
      thumb: c.thumbnail_url || null
    })) || [];

    const recentComments = comments?.map(c => {
      // Basic time formatting
      const date = new Date(c.created_at);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);
      let timeStr = 'just now';
      if (diffDays > 0) timeStr = `${diffDays}d ago`;
      else if (diffHours > 0) timeStr = `${diffHours}h ago`;
      else if (diffMins > 0) timeStr = `${diffMins}m ago`;

      return {
        id: c.id,
        user: c.author_name || 'User',
        text: c.text,
        time: timeStr,
        platform: c.content?.platform === 'yt' ? 'YouTube' : c.content?.platform === 'ig' ? 'Instagram' : c.content?.platform === 'x' ? 'X (Twitter)' : c.content?.platform === 'fb' ? 'Facebook' : c.content?.platform === 'in' ? 'LinkedIn' : 'Unknown'
      };
    }) || [];

    return {
      overview: { totalViews, totalFollowers, estimatedRevenue },
      platformStats,
      chartData,
      topContent,
      demographics,
      recentComments
    };
  } catch (err) {
    console.warn('Failed to fetch platform data:', err.message || err);
    return {
      overview: { totalViews: 0, totalFollowers: 0, estimatedRevenue: 0 },
      platformStats: {},
      chartData: [],
      topContent: [],
      demographics: null,
      recentComments: []
    };
  }
};
