import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Platform, TouchableOpacity } from 'react-native';
import * as THREE from 'three';

/**
 * ThreeDStatCard (Option B)
 * Renders a futuristic 3D regular N-sided prism in Three.js WebGL.
 * Each surface represents a running platform and flips upwards on an interval.
 */
export default function ThreeDStatCard({
  title = '',
  metricType = 'reach', // 'reach', 'audience', 'engagement', 'revenue'
  surfaces = [],
  staggerDelay = 0,
  intervalMs = 5000,
  isDark = true,
  colors = {},
  isAutoRotate = true,
  onSurfaceChange = null
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
    let height = container.clientHeight || 155;

    // 1. Offscreen 2D Canvas for Texture Generation
    const texWidthPerFace = 512;
    const texHeight = 320;
    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = texWidthPerFace * N;
    offscreenCanvas.height = texHeight;
    const ctx = offscreenCanvas.getContext('2d');

    // Function to draw all N surfaces on the texture atlas
    const drawTextureAtlas = () => {
      ctx.clearRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);

      for (let i = 0; i < N; i++) {
        const surf = safeSurfaces[i % safeSurfaces.length];
        const xOffset = i * texWidthPerFace;

        // Card background gradient
        const bgGrad = ctx.createLinearGradient(xOffset, 0, xOffset + texWidthPerFace, texHeight);
        if (isDark) {
          bgGrad.addColorStop(0, '#090d16');
          bgGrad.addColorStop(0.5, '#0f172a');
          bgGrad.addColorStop(1, '#1e293b');
        } else {
          bgGrad.addColorStop(0, '#ffffff');
          bgGrad.addColorStop(0.7, '#f8fafc');
          bgGrad.addColorStop(1, '#f1f5f9');
        }
        ctx.fillStyle = bgGrad;
        ctx.fillRect(xOffset, 0, texWidthPerFace, texHeight);

        // Futuristic cyber gridlines / accents
        ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(xOffset, 70);
        ctx.lineTo(xOffset + texWidthPerFace, 70);
        ctx.moveTo(xOffset, 240);
        ctx.lineTo(xOffset + texWidthPerFace, 240);
        ctx.stroke();

        // Top brand accent glow line
        const glowGrad = ctx.createLinearGradient(xOffset, 0, xOffset + texWidthPerFace, 0);
        glowGrad.addColorStop(0, 'rgba(0,0,0,0)');
        glowGrad.addColorStop(0.5, surf.brandColor || '#6366f1');
        glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = glowGrad;
        ctx.fillRect(xOffset + 40, 0, texWidthPerFace - 80, 4);

        // Outer border
        ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)';
        ctx.lineWidth = 2;
        ctx.strokeRect(xOffset + 2, 2, texWidthPerFace - 4, texHeight - 4);

        // Top Row: Metric Category Title
        ctx.fillStyle = isDark ? '#94a3b8' : '#64748b';
        ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'left';
        ctx.fillText((surf.label || title).toUpperCase(), xOffset + 28, 44);

        // Top Row Right: Brand Pill Badge
        const badgeWidth = 140;
        const badgeHeight = 28;
        const badgeX = xOffset + texWidthPerFace - badgeWidth - 28;
        const badgeY = 24;

        ctx.fillStyle = surf.brandBg || 'rgba(99, 102, 241, 0.18)';
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, 14);
        } else {
          ctx.rect(badgeX, badgeY, badgeWidth, badgeHeight);
        }
        ctx.fill();

        ctx.strokeStyle = surf.brandColor || '#6366f1';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Badge Text
        ctx.fillStyle = surf.brandColor || '#6366f1';
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(surf.platformName, badgeX + badgeWidth / 2, badgeY + 19);

        // Middle: Large Bold Metric Value
        ctx.fillStyle = isDark ? '#ffffff' : '#0f172a';
        const valStr = String(surf.value ?? '0');
        ctx.font = valStr.length > 10 ? 'bold 40px sans-serif' : 'bold 54px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(valStr, xOffset + 28, 155);

        // Subtitle / Trend
        ctx.fillStyle = isDark ? '#64748b' : '#94a3b8';
        ctx.font = '14px sans-serif';
        ctx.fillText(surf.caption || 'Live metric stream', xOffset + 28, 195);

        // Bottom Trend & Pagination dots
        ctx.fillStyle = '#10b981';
        ctx.font = 'bold 14px monospace';
        ctx.fillText(`↑ ${surf.trend || 'Live'}`, xOffset + 28, 280);

        // Pagination Dots indicator
        const dotsCount = safeSurfaces.length;
        const dotRadius = 4;
        const dotGap = 14;
        const startDotX = xOffset + texWidthPerFace - 28 - (dotsCount * dotGap);
        for (let d = 0; d < dotsCount; d++) {
          ctx.beginPath();
          ctx.arc(startDotX + (d * dotGap), 276, dotRadius, 0, Math.PI * 2);
          ctx.fillStyle = d === i ? (surf.brandColor || '#6366f1') : (isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)');
          ctx.fill();
        }
      }
    };

    drawTextureAtlas();

    const canvasTexture = new THREE.CanvasTexture(offscreenCanvas);
    canvasTexture.minFilter = THREE.LinearFilter;
    canvasTexture.magFilter = THREE.LinearFilter;

    // 2. Three.js Scene, Camera, Renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.set(0, 0, 4.4);

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance'
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, height, false);
      renderer.setClearColor(0x000000, 0);
    } catch (e) {
      console.warn("Could not create WebGLRenderer for 3D card:", e);
      return;
    }

    // 3. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, isDark ? 1.4 : 1.8);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, isDark ? 0.9 : 1.2);
    dirLight.position.set(2, 3, 5);
    scene.add(dirLight);

    const pointLight = new THREE.PointLight(0x6366f1, 2.5, 12);
    pointLight.position.set(0, 0, 3.5);
    scene.add(pointLight);

    // 4. Geometry: N-sided regular prism oriented horizontally along the X-axis
    // Radius calculation so that front facet is approximately rectangular
    const facetWidth = 3.2; // length along cylinder axis
    const radius = 1.15;
    const geometry = new THREE.CylinderGeometry(radius, radius, facetWidth, N, 1, false);
    // Align cylinder along X axis so rotation around X axis revolves the facets upwards
    geometry.rotateZ(Math.PI / 2);

    // Materials: Facets use the canvas texture; Caps use metallic side cover
    const sideMaterial = new THREE.MeshStandardMaterial({
      map: canvasTexture,
      roughness: isDark ? 0.25 : 0.2,
      metalness: isDark ? 0.2 : 0.1,
    });

    const capMaterial = new THREE.MeshStandardMaterial({
      color: isDark ? 0x0f172a : 0xe2e8f0,
      roughness: 0.6,
      metalness: 0.4,
    });

    const mesh = new THREE.Mesh(geometry, [sideMaterial, capMaterial, capMaterial]);
    scene.add(mesh);

    // 5. Rotation Math & Upward Flipping State
    const angleStep = (2 * Math.PI) / N;
    let currentRotationX = 0;
    let targetRotationX = 0;
    let tiltX = 0;
    let tiltY = 0;
    let currentTiltX = 0;
    let currentTiltY = 0;
    let isMouseOver = false;

    // Event listeners for interactive 3D pointer tilt
    const onMouseMove = (e) => {
      const rect = container.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width; // 0 to 1
      const y = (e.clientY - rect.top) / rect.height; // 0 to 1
      tiltY = (x - 0.5) * 0.35; // horizontal tilt
      tiltX = (y - 0.5) * 0.25; // vertical tilt
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

    // Resize Observer to handle responsive browser widths
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

    // 6. Upward Rotation Flip Function
    const flipUpward = () => {
      // Rotating around X axis with negative delta rolls the front face UPWARDS
      targetRotationX -= angleStep;
      activeSurfaceRef.current = (activeSurfaceRef.current + 1) % safeSurfaces.length;
      setCurrentSurfaceIndex(activeSurfaceRef.current);
      if (onSurfaceChange) {
        onSurfaceChange(activeSurfaceRef.current);
      }

      // Update point light color to match the incoming platform brand color
      const incomingSurf = safeSurfaces[activeSurfaceRef.current];
      if (incomingSurf?.brandColor) {
        const c = new THREE.Color(incomingSurf.brandColor);
        pointLight.color = c;
      }
    };

    // Auto-cycle timer with initial stagger delay for organic domino wave across cards
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

    // Manual flip on click handler
    const onClick = () => {
      flipUpward();
    };
    container.addEventListener('click', onClick);

    // 7. Animation Render Loop
    let running = true;
    const render = () => {
      if (!running) return;

      // Smooth cubic-like easing for upward roll
      currentRotationX += (targetRotationX - currentRotationX) * 0.085;

      // Smooth tilt easing
      currentTiltX += (tiltX - currentTiltX) * 0.1;
      currentTiltY += (tiltY - currentTiltY) * 0.1;

      mesh.rotation.x = currentRotationX + currentTiltX;
      mesh.rotation.y = currentTiltY;

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

      scene.remove(mesh);
      geometry.dispose();
      sideMaterial.dispose();
      capMaterial.dispose();
      canvasTexture.dispose();
      renderer.dispose();
    };
  }, [N, safeSurfaces, isDark, isAutoRotate, intervalMs, staggerDelay]);

  // Fallback rendering for non-web environments
  const activeSurface = safeSurfaces[currentSurfaceIndex] || safeSurfaces[0];

  return (
    <View 
      ref={containerRef}
      style={[
        styles.cardContainer,
        {
          borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)',
          backgroundColor: isDark ? '#0b1120' : '#ffffff',
          ...(Platform.OS === 'web' ? {
            boxShadow: isDark 
              ? `0 8px 32px rgba(0, 0, 0, 0.55), 0 0 24px ${activeSurface.brandColor}20` 
              : `0 8px 24px rgba(0, 0, 0, 0.06), 0 0 20px ${activeSurface.brandColor}15`,
            cursor: 'pointer',
            userSelect: 'none',
          } : {})
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
            borderRadius: 16 
          }} 
        />
      ) : (
        // Mobile 2D Fallback
        <View style={styles.mobileFallback}>
          <View style={styles.fallbackHeader}>
            <Text style={[styles.fallbackLabel, { color: colors.textSecondary }]}>{activeSurface.label}</Text>
            <View style={[styles.fallbackPill, { backgroundColor: activeSurface.brandBg }]}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: activeSurface.brandColor }}>{activeSurface.platformName}</Text>
            </View>
          </View>
          <Text style={[styles.fallbackValue, { color: colors.textPrimary }]}>{activeSurface.value}</Text>
          <Text style={[styles.fallbackCaption, { color: colors.textMuted }]}>{activeSurface.caption}</Text>
        </View>
      )}

      {/* Cyberpunk corner indicator */}
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
    opacity: 0.7,
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
