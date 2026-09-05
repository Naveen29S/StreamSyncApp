import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { Text, TextInput, Platform } from 'react-native';
import { useFonts, Quicksand_400Regular, Quicksand_500Medium, Quicksand_600SemiBold, Quicksand_700Bold } from '@expo-google-fonts/quicksand';
import CursorEffect from '../components/CursorEffect';

export default function Layout() {
  const [fontsLoaded] = useFonts({
    'Quicksand-Regular': Quicksand_400Regular,
    'Quicksand-Medium': Quicksand_500Medium,
    'Quicksand-SemiBold': Quicksand_600SemiBold,
    'Quicksand-Bold': Quicksand_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      // Globally apply the font to all Text components
      const oldTextRender = Text.render;
      const customTextProps = { style: { fontFamily: 'Quicksand-SemiBold' } };
      
      // Override defaultProps for global text styling (works mostly on native)
      if (Text.defaultProps == null) Text.defaultProps = {};
      Text.defaultProps.style = { fontFamily: 'Quicksand-SemiBold' };
      
      if (TextInput.defaultProps == null) TextInput.defaultProps = {};
      TextInput.defaultProps.style = { fontFamily: 'Quicksand-SemiBold' };

      // Foolproof CSS injection for Web to completely override all browser fonts
      if (Platform.OS === 'web') {
        const style = document.createElement('style');
        style.type = 'text/css';
        style.appendChild(document.createTextNode(`
          html, body, #root, div, span, p, a, input, button, textarea { font-family: 'Quicksand-SemiBold', sans-serif; }
        `));
        document.head.appendChild(style);
      }
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null; // Or a loading spinner
  }

  return (
    <>
      <CursorEffect />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="connects" />
        <Stack.Screen name="dashboard" />
      </Stack>
    </>
  );
}
