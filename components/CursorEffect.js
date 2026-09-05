import React, { useEffect } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

export default function CursorEffect() {
  if (Platform.OS !== 'web') return null;

  useEffect(() => {
    // Inject global CSS to hide default cursor
    const style = document.createElement('style');
    style.innerHTML = `
      * { cursor: none !important; }
      a, button, [role="button"] { cursor: none !important; }
      .custom-cursor-wrapper {
        position: fixed;
        top: 0; left: 0;
        width: 40px; height: 40px;
        border-radius: 20px;
        background-color: rgba(157, 80, 255, 0.2);
        display: flex; justify-content: center; align-items: center;
        z-index: 999999;
        pointer-events: none;
        transform: translate(-100px, -100px);
        will-change: transform;
      }
      .custom-cursor-inner {
        width: 8px; height: 8px;
        border-radius: 4px;
        background-color: #9d50ff;
        box-shadow: 0 0 10px #9d50ff;
      }
    `;
    document.head.appendChild(style);

    // Create cursor DOM elements directly to bypass React rendering lag
    const cursor = document.createElement('div');
    cursor.className = 'custom-cursor-wrapper';
    const inner = document.createElement('div');
    inner.className = 'custom-cursor-inner';
    cursor.appendChild(inner);
    document.body.appendChild(cursor);

    const handleMouseMove = (e) => {
      // Direct DOM manipulation is infinitely faster than React state for 60fps mouse events
      cursor.style.transform = `translate(${e.clientX - 20}px, ${e.clientY - 20}px)`;
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      document.head.removeChild(style);
      if (document.body.contains(cursor)) document.body.removeChild(cursor);
    };
  }, []);

  return null; // Render nothing in React to keep it fast
}

const styles = StyleSheet.create({
  cursor: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(157, 80, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 99999,
  },
  cursorInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#9d50ff',
    shadowColor: '#9d50ff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 10,
  }
});
