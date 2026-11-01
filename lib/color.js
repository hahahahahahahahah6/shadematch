// Small color helpers: hex -> CIELAB, color distance, and a simple undertone estimate.

export function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!m) throw new Error(`Not a hex color: ${hex}`);
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function toLinear(c) {
  c /= 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function hexToLab(hex) {
  const { r, g, b } = hexToRgb(hex);
  const R = toLinear(r), G = toLinear(g), B = toLinear(b);
  // sRGB -> XYZ (D65)
  const X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  const Y = (R * 0.2126 + G * 0.7152 + B * 0.0722) / 1.0;
  const Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = t => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(X), fy = f(Y), fz = f(Z);
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

// CIE76 color difference. Simple and good enough for a small demo catalog.
export function deltaE(hex1, hex2) {
  const p = hexToLab(hex1), q = hexToLab(hex2);
  return Math.hypot(p.L - q.L, p.a - q.a, p.b - q.b);
}

// Hue angle in degrees (0 = red, 90 = yellow).
export function hueAngle(hex) {
  const { a, b } = hexToLab(hex);
  return (Math.atan2(b, a) * 180) / Math.PI;
}

// ShadeMatch's own estimate, made from the skin color YouCam returns.
// More yellow (higher hue angle) reads warm; more pink/red reads cool.
export function estimateUndertone(skinHex) {
  const h = hueAngle(skinHex);
  if (h >= 65) return 'warm';
  if (h <= 55) return 'cool';
  return 'neutral';
}

// Rough depth bucket from lightness, for display.
export function depthLabel(skinHex) {
  const { L } = hexToLab(skinHex);
  if (L >= 75) return 'fair';
  if (L >= 65) return 'light';
  if (L >= 55) return 'medium';
  if (L >= 42) return 'tan';
  return 'deep';
}
