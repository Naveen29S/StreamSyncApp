import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import * as THREE from 'three';

/**
 * ThreeDStatCard (Option B - Three.js WebGL)
 * Renders a futuristic 3D regular N-sided prism using Three.js WebGL.
 * Each surface represents a running platform and flips upwards on an interval.
 */
export default function ThreeDStatCard({
  title = '',
  metricType = 'reach',
  surfaces = [],
  staggerDelay = 0,
  intervalMs = 4500,
  isDark = true,
  colors = {},
  isAutoRotate = true,
  onSurfaceChange = null,
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const animFrameId = useRef(null);
  const activeSurfaceRef = useRef(0);
  const [currentSurfaceIndex, setCurrentSurfaceIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  // Safe fallback if surfaces is empty
  const safeSurfaces = surfaces.length > 0 ? surfaces : [
    {
      platformName: 'All Platforms',
      platformKey: 'all',
      brandColor: '#6366f1',
      brandBg: 'rgba(99, 102, 241, 0.15)',
      value: '0',
      label: title.toUpperCase(),
      caption: 'Live telemetry stream',
      trend: 'Live'
    }
  ];

  const N = Math.max(3, safeSurfaces.length); // Minimum 3 sides for a regular geometric prism

  useEffect(() => {
    if (Platform.OS !== 'web' || !canvasRef.current || !containerRef.current) {
      return;
    }

    const container = containerRef.current;
    const canvas = canvasRef.current;
    let width = container.clientWidth || 280;
    let height = container.clientHeight || 160;

    // 1. Generate Individual High-DPI Canvas Textures for each surface
    const texWidth = 512;
    const texHeight = 320;
    const textures = [];

    for (let i = 0; i < N; i++) {
      const surf = safeSurfaces[i % safeSurfaces.length];
      const faceCanvas = document.createElement('canvas');
      faceCanvas.width = texWidth;
      faceCanvas.height = texHeight;
      const ctx = faceCanvas.getContext('2d');

      // Card Background Gradient
      const bgGrad = ctx.createLinearGradient(0, 0, texWidth, texHeight);
      if (isDark) {
        bgGrad.addColorStop(0, '#0a0f1d');
        bgGrad.addColorStop(0.5, '#0f172a');
        bgGrad.addColorStop(1, '#1e293b');
      } else {
        bgGrad.addColorStop(0, '#ffffff');
        bgGrad.addColorStop(0.6, '#f8fafc');
        bgGrad.addColorStop(1, '#f1f5f9');
      }
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, texWidth, texHeight);

      // Cyber Gridlines / Tech Accents
      ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, 72);
      ctx.lineTo(texWidth, 72);
      ctx.moveTo(0, 245);
      ctx.lineTo(texWidth, 245);
      ctx.stroke();

      // Top Brand Accent Line
      const glowGrad = ctx.createLinearGradient(0, 0, texWidth, 0);
      glowGrad.addColorStop(0, 'rgba(0,0,0,0)');
      glowGrad.addColorStop(0.5, surf.brandColor || '#6366f1');
      glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glowGrad;
      ctx.fillRect(30, 0, texWidth - 60, 5);

      // Card Border with subtle rounded bevel
      ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.1)';
      ctx.lineWidth = 3;
      ctx.strokeRect(3, 3, texWidth - 6, texHeight - 6);

      // Top Header: Metric Category Title
      ctx.fillStyle = isDark ? '#94a3b8' : '#64748b';
      ctx.font = 'bold 18px monospace';
      ctx.textAlign = 'left';
      ctx.fillText((surf.label || title).toUpperCase(), 32, 46);

      // Top Header Right: Brand Pill Badge
      const badgeWidth = 148;
      const badgeHeight = 32;
      const badgeX = texWidth - badgeWidth - 32;
      const badgeY = 24;

      ctx.fillStyle = surf.brandBg || 'rgba(99, 102, 241, 0.18)';
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, 16);
      } else {
        ctx.rect(badgeX, badgeY, badgeWidth, badgeHeight);
      }
      ctx.fill();

      ctx.strokeStyle = surf.brandColor || '#6366f1';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Badge Text
      ctx.fillStyle = surf.brandColor || '#6366f1';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(surf.platformName, badgeX + badgeWidth / 2, badgeY + 21);

      // Center: Large Bold Value
      ctx.fillStyle = isDark ? '#ffffff' : '#0f172a';
      const valStr = String(surf.value ?? '0');
      ctx.font = valStr.length > 9 ? 'bold 44px sans-serif' : 'bold 56px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(valStr, 32, 160);

      // Caption Subtitle
      ctx.fillStyle = isDark ? '#64748b' : '#94a3b8';
      ctx.font = '15px sans-serif';
      ctx.fillText(surf.caption || 'Live metric telemetry', 32, 202);

      // Bottom Status / Trend
      ctx.fillStyle = '#10b981';
      ctx.font = 'bold 15px monospace';
      ctx.fillText(`↑ ${surf.trend || 'Live'}`, 32, 285);

      // Bottom Pagination Dots
      const dotCount = safeSurfaces.length;
      const dotRadius = 4.5;
      const dotGap = 15;
      const startDotX = texWidth - 32 - (dotCount * dotGap);
      for (let d = 0; d < dotCount; d++) {
        ctx.beginPath();
        ctx.arc(startDotX + (d * dotGap), 280, dotRadius, 0, Math.PI * 2);
        ctx.fillStyle = (d === (i % safeSurfaces.length))
          ? (surf.brandColor || '#6366f1')
          : (isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)');
        ctx.fill();
      }

      const texture = new THREE.CanvasTexture(faceCanvas);
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      textures.push(texture);
    }

    // 2. Three.js Scene, Camera, Renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(0, 0, 4.2);

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, height, false);
      renderer.setClearColor(0x000000, 0);
    } catch (e) {
      console.warn('Could not create WebGLRenderer for 3D card:', e);
      return;
    }

    // 3. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, isDark ? 1.5 : 1.8);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, isDark ? 1.0 : 1.2);
    dirLight.position.set(2, 3, 5);
    scene.add(dirLight);

    const pointLight = new THREE.PointLight(0x6366f1, 2.5, 12);
    pointLight.position.set(0, 0, 3.5);
    scene.add(pointLight);

    // 4. Geometry: N-sided regular prism constructed from planar facets
    const prismGroup = new THREE.Group();
    scene.add(prismGroup);

    const facetWidth = 3.3;
    const facetHeight = 1.65;
    // Radius of in-circle to facet centers: R = (facetHeight / 2) / tan(pi / N)
    const R = (facetHeight / 2) / Math.tan(Math.PI / N);

    const planeGeo = new THREE.PlaneGeometry(facetWidth, facetHeight);

    for (let i = 0; i < N; i++) {
      const angle = i * ((2 * Math.PI) / N);
      const faceMat = new THREE.MeshStandardMaterial({
        map: textures[i],
        roughness: isDark ? 0.25 : 0.2,
        metalness: isDark ? 0.15 : 0.1,
        side: THREE.FrontSide,
      });

      const faceMesh = new THREE.Mesh(planeGeo, faceMat);
      // Place face on circumference at angle:
      // When angle = 0, y = 0, z = R, facing positive Z (directly at camera)
      faceMesh.position.set(0, -R * Math.sin(angle), R * Math.cos(angle));
      faceMesh.rotation.x = angle;
      prismGroup.add(faceMesh);
    }

    // 5. Rotation Math & Upward Flipping State
    const angleStep = (2 * Math.PI) / N;
    let currentRotationX = 0;
    let targetRotationX = 0;
    let tiltX = 0;
    let tiltY = 0;
    let currentTiltX = 0;
    let currentTiltY = 0;
    let isMouseOver = false;

    // Interactive pointer physics
    const onMouseMove = (e) => {
      const rect = container.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      tiltY = (x - 0.5) * 0.3;
      tiltX = (y - 0.5) * 0.2;
    };

    const onMouseEnter = () => {
      isMouseOver = true;
      setIsHovered(true);
    };

    const onMouseLeave = () => {
      isMouseOver = false;
      setIsHovered(false);
      tiltX = 0;
      tiltY = 0;
    };

    container.addEventListener('mousemove', onMouseMove);
    container.addEventListener('mouseenter', onMouseEnter);
    container.addEventListener('mouseleave', onMouseLeave);

    // Resize Observer
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const newW = entry.contentRect.width;
        const newH = entry.contentRect.height;
        if (newW > 0 && newH > 0 && renderer) {
          width = newW;
          height = newH;
          camera.aspect = newW / newH;
          camera.updateProjectionMatrix();
          renderer.setSize(newW, newH, false);
        }
      }
    });
    resizeObserver.observe(container);

    // Upward Flip Action: Rolls the front face UPWARDS
    const flipUpward = () => {
      targetRotationX += angleStep;
      activeSurfaceRef.current = (activeSurfaceRef.current + 1) % safeSurfaces.length;
      setCurrentSurfaceIndex(activeSurfaceRef.current);
      if (onSurfaceChange) {
        onSurfaceChange(activeSurfaceRef.current);
      }

      // Update light color to platform accent
      const incomingSurf = safeSurfaces[activeSurfaceRef.current];
      if (incomingSurf?.brandColor) {
        pointLight.color = new THREE.Color(incomingSurf.brandColor);
      }
    };

    // Auto-cycle timer with staggered delay
    let autoFlipTimer = null;
    let staggerTimeout = null;

    if (isAutoRotate) {
      staggerTimeout = setTimeout(() => {
        autoFlipTimer = setInterval(() => {
          if (!isMouseOver) {
            flipUpward();
          }
        }, intervalMs);
      }, staggerDelay);
    }

    const onClick = () => {
      flipUpward();
    };
    container.addEventListener('click', onClick);

    // 6. Animation Render Loop
    let running = true;
    const render = () => {
      if (!running) return;

      // Smooth cubic easing towards target upward angle
      currentRotationX += (targetRotationX - currentRotationX) * 0.085;
      currentTiltX += (tiltX - currentTiltX) * 0.1;
      currentTiltY += (tiltY - currentTiltY) * 0.1;

      prismGroup.rotation.x = currentRotationX + currentTiltX;
      prismGroup.rotation.y = currentTiltY;

      renderer.render(scene, camera);
      animFrameId.current = requestAnimationFrame(render);
    };
    animFrameId.current = requestAnimationFrame(render);

    // Cleanup
    return () => {
      running = false;
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
      if (autoFlipTimer) clearInterval(autoFlipTimer);
      if (staggerTimeout) clearTimeout(staggerTimeout);
      resizeObserver.disconnect();
      container.removeEventListener('mousemove', onMouseMove);
      container.removeEventListener('mouseenter', onMouseEnter);
      container.removeEventListener('mouseleave', onMouseLeave);
      container.removeEventListener('click', onClick);
      textures.forEach((t) => t.dispose());
      planeGeo.dispose();
      renderer.dispose();
    };
  }, [safeSurfaces, N, isDark, isAutoRotate, intervalMs, staggerDelay]);

  const activeSurface = safeSurfaces[currentSurfaceIndex] || safeSurfaces[0];

  return (
    <View
      ref={containerRef}
      style={[
        styles.cardContainer,
        {
          backgroundColor: isDark ? '#090d16' : '#ffffff',
          borderColor: isHovered
            ? (activeSurface.brandColor || '#6366f1')
            : (isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'),
        }
      ]}
    >
      {Platform.OS === 'web' ? (
        <canvas
          ref={canvasRef}
          style={{
            width: '100%',
            height: '100%',
            display: 'block',
            borderRadius: 16,
          }}
        />
      ) : (
        <View style={styles.mobileFallback}>
          <View style={styles.fallbackHeader}>
            <Text style={[styles.fallbackLabel, { color: colors.textSecondary }]}>{activeSurface.label}</Text>
            <View style={[styles.fallbackPill, { backgroundColor: activeSurface.brandBg }]}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: activeSurface.brandColor }}>
                {activeSurface.platformName}
              </Text>
            </View>
          </View>
          <Text style={[styles.fallbackValue, { color: colors.textPrimary }]}>{activeSurface.value}</Text>
          <Text style={[styles.fallbackCaption, { color: colors.textMuted }]}>{activeSurface.caption}</Text>
        </View>
      )}

      {/* Cyberpunk corner telemetry tag */}
      <View style={styles.cornerIndicator}>
        <Text style={[styles.cornerText, { color: activeSurface.brandColor }]}>
          3D // {activeSurface.platformName.toUpperCase()}
        </Text>
      </View>
    </View>
  );
}

const mono = Platform.OS === 'web' ? 'monospace' : undefined;

const styles = StyleSheet.create({
  cardContainer: {
    flex: 1,
    minWidth: 240,
    height: 160,
    borderRadius: 16,
    borderWidth: 1.5,
    position: 'relative',
    overflow: 'hidden',
  },
  cornerIndicator: {
    position: 'absolute',
    top: 8,
    right: 12,
    pointerEvents: 'none',
  },
  cornerText: {
    fontSize: 9,
    fontFamily: mono,
    fontWeight: '800',
    letterSpacing: 0.5,
    opacity: 0.75,
  },
  mobileFallback: {
    flex: 1,
    padding: 20,
    justifyContent: 'space-between',
  },
  fallbackHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fallbackLabel: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: mono,
  },
  fallbackPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  fallbackValue: {
    fontSize: 32,
    fontWeight: '800',
    fontFamily: mono,
  },
  fallbackCaption: {
    fontSize: 12,
  },
});
