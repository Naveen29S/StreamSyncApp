import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { Text, TextInput, Platform } from 'react-native';
import { useFonts, Quicksand_400Regular, Quicksand_500Medium, Quicksand_600SemiBold, Quicksand_700Bold } from '@expo-google-fonts/quicksand';
import { BebasNeue_400Regular } from '@expo-google-fonts/bebas-neue';
import CursorEffect from '../components/CursorEffect';
import { ThemeProvider } from '../context/ThemeContext';

export default function Layout() {
  const [fontsLoaded] = useFonts({
    'BebasNeue': BebasNeue_400Regular,
    'Quicksand-Regular': Quicksand_400Regular,
    'Quicksand-Medium': Quicksand_500Medium,
    'Quicksand-SemiBold': Quicksand_600SemiBold,
    'Quicksand-Bold': Quicksand_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      // Globally apply the font to all Text and TextInput components
      if (Text.defaultProps == null) Text.defaultProps = {};
      Text.defaultProps.style = { fontFamily: 'BebasNeue' };
      
      if (TextInput.defaultProps == null) TextInput.defaultProps = {};
      TextInput.defaultProps.style = { fontFamily: 'BebasNeue' };

      // Foolproof CSS injection for Web to apply Bebas Neue across the entire website
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        const style = document.createElement('style');
        style.type = 'text/css';
        style.appendChild(document.createTextNode(`
          @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Quicksand:wght@400;500;600;700&display=swap');

          html, body, #root, div, span, p, a, input, button, textarea {
            font-family: 'Bebas Neue', 'Quicksand-SemiBold', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            letter-spacing: 0.6px;
          }
        `));
        document.head.appendChild(style);
      }
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null; // Or a loading spinner
  }

  return (
    <ThemeProvider>
      <CursorEffect />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="dashboard" />
      </Stack>
    </ThemeProvider>
  );
}
