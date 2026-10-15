import { MAX_FOLDS, MAX_LINES } from './folds';

export const vertex = /* glsl */ `
#define NF ${MAX_FOLDS}
#define NL ${MAX_LINES}
uniform vec2 uSize;          // sheet size, px (== viewport)
uniform float uS;            // short side, px
uniform float uCell;         // grid cell size, px
uniform vec4 uFold[NF];      // point.xy, normal.xy (normal → folding piece)
uniform float uFoldPar[NF];  // parent index, -1 = root
uniform float uFoldAng[NF];  // current signed angle
uniform int uNF;
uniform vec4 uLine[NL];      // crease web: dir.xy, period (px), phase
uniform float uLineK[NL];
uniform int uNL;
uniform float uCrease;       // crease web amplitude 0..1
uniform float uSoft;         // bend width at each fold, px
uniform vec3 uCenter;        // centroid of the folded sheet this frame
uniform float uComp;         // uniform scale-down 0..1 (only in the last third / first third)
uniform float uBall;         // how far the stack is pushed onto the ball shape
uniform float uBallCrease;   // crease relief on the ball
uniform float uRq;           // radius of the fully folded stack
uniform float uRb;           // ball radius
uniform float uLumps;
uniform vec4 uLump;          // lump phases
uniform float uZw;           // layer thickness scale for front/back of the ball
uniform mat3 uRot;           // tumble (+ stop-motion jitter rotation)
uniform vec2 uShift;         // stop-motion jitter + gate weave, px
uniform float uResDepth;     // depth of the left-over creases (residual shading)

out vec2 vUv;
out vec3 vPos;
out float vDeep;
out vec2 vRest;
out vec3 vNormal;
out float vBand;

float sabs(float s, float e) { return sqrt(s * s + e * e) - e; }

// one pleat family: a soft zig-zag across direction dir with the given period and slope k.
// Height stays within ±k·period/4; kinks are rounded over ~1 grid cell so creases never stair-step.
float zig(float s, vec4 L, float k) {
  float f = fract(s / L.z + L.w) - 0.5;
  float e = uCell / L.z;
  return k * L.z * (sqrt(f * f + e * e) - 0.25);
}
float zigD(float s, vec4 L, float k) {
  float f = fract(s / L.z + L.w) - 0.5;
  float e = uCell / L.z;
  return k * f / sqrt(f * f + e * e);
}
float heightAt(vec2 x) {
  float h = 0.0;
  for (int j = 0; j < NL; j++) {
    if (j >= uNL) break;
    h += zig(dot(x, uLine[j].xy), uLine[j], uLineK[j]);
  }
  return h;
}
vec2 gradAt(vec2 x) {
  vec2 g = vec2(0.0);
  for (int j = 0; j < NL; j++) {
    if (j >= uNL) break;
    g += zigD(dot(x, uLine[j].xy), uLine[j], uLineK[j]) * uLine[j].xy;
  }
  return g;
}

vec3 rotAbout(vec3 p, vec3 a, vec3 d, float t) {
  vec3 v = p - a;
  float c = cos(t), s = sin(t);
  return a + v * c + cross(d, v) * s + d * dot(d, v) * (1.0 - c);
}

float lump(vec3 d) {
  return 0.5 * sin(dot(d, vec3(3.1, 1.7, 2.3)) + uLump.x)
       + 0.3 * sin(dot(d, vec3(-2.2, 4.1, 1.3)) + uLump.y)
       + 0.2 * sin(dot(d, vec3(5.3, -3.7, 4.4)) + uLump.z)
       + 0.15 * sin(dot(d, vec3(-7.1, 6.2, -5.3)) + uLump.w);
}

void main() {
  vUv = uv;
  vec2 x = (uv - 0.5) * uSize;   // rest position, px, y up
  vRest = x;

  // which folding pieces contain this point (parents before children)
  float m[NF];
  for (int i = 0; i < NF; i++) {
    m[i] = 0.0;
    if (i >= uNF) break;
    vec4 F = uFold[i];
    float s = dot(x - F.xy, F.zw);
    float side = smoothstep(-uSoft, uSoft, s);
    int par = int(uFoldPar[i]);
    m[i] = (par < 0 ? 1.0 : m[par]) * side;
  }

  float amp = uCrease;
  float h0 = heightAt(x);
  vec3 P = vec3(x, h0 * amp);
  // analytic normal, carried through the same rotations: used inside the bend bands, where
  // per-triangle flat shading would show the grid as a zipper
  vec3 N = normalize(vec3(-gradAt(x) * amp, 1.0));
  float band = 0.0;
  // deepest first, each about its own rest-space line (at the paper's height there)
  for (int i = NF - 1; i >= 0; i--) {
    if (i >= uNF || m[i] <= 0.0 || uFoldAng[i] == 0.0) continue;
    vec4 F = uFold[i];
    float s = dot(x - F.xy, F.zw);
    vec2 ax = x - s * F.zw;
    vec3 d = vec3(-F.w, F.z, 0.0);
    float t = uFoldAng[i] * m[i];
    P = rotAbout(P, vec3(ax, heightAt(ax) * amp), d, t);
    N = rotAbout(N, vec3(0.0), d, t);
    float sd = smoothstep(-uSoft, uSoft, s);
    int par = int(uFoldPar[i]);
    band = max(band, (par < 0 ? 1.0 : m[par]) * 4.0 * sd * (1.0 - sd) * min(1.0, abs(uFoldAng[i]) * 2.0));
  }
  vBand = band;

  // last third only: scale the stack down and push it onto a lumpy, faceted ball
  vec3 Q = (P - uCenter) * mix(1.0, min(1.0, uRb / uRq), uComp);
  float deep = 0.0;
  if (uBall > 0.0) {
    vec3 Q0 = P - uCenter;
    float r = length(Q0.xy);
    float rho = min(r / uRq, 1.0);
    vec2 dir = r > 1e-3 ? Q0.xy / r : vec2(1.0, 0.0);
    vec3 nd = normalize(vec3(Q0.xy / uRq, Q0.z / uRq * 2.0) + vec3(1e-4));
    float L = uRb * (1.0 + uLumps * lump(nd));
    float rr = L * pow(rho, 0.6);
    float front = sqrt(max(0.0, 1.0 - rr * rr / (L * L)));
    float side = tanh(Q0.z / uZw);
    vec3 B = vec3(dir * rr, L * front * side);
    // the crease web becomes the ball's facets: straight ridges pushed in and out
    B += normalize(B + vec3(0.0, 0.0, 1e-3)) * h0 * amp * uBallCrease * min(1.0, uRb / uRq);
    Q = mix(Q, B, uBall);
    deep = clamp((L * front - Q.z) / (L * 0.9), 0.0, 1.0) * uBall;
  }
  vDeep = deep;

  vec3 W = uRot * Q;
  W.xy += uShift;
  vec4 mv = modelViewMatrix * vec4(W, 1.0);
  vPos = mv.xyz;
  vNormal = normalize(mat3(modelViewMatrix) * (uRot * N));
  gl_Position = projectionMatrix * mv;
}
`;

export const fragment = /* glsl */ `
#define NF ${MAX_FOLDS}
#define NL ${MAX_LINES}
precision highp float;
uniform sampler2D uTexA;     // outgoing page
uniform sampler2D uTexB;     // incoming page
uniform float uMix;          // A → B, crossfaded over 2–3 film frames at the ball
uniform float uDarkA;        // 1 if the page is the dark back cover / cover
uniform float uDarkB;
uniform float uShade;        // 0 = flat & unlit (pixel-exact ends), 1 = fully lit paper
uniform vec3 uLight;
uniform float uAmbient, uDiffuse, uSheen, uFoldDark, uRimDark, uRimLight;
uniform vec3 uBack;          // paper back colour
uniform float uShowThrough;
uniform float uExposure;     // film flicker
// residual creases (the ones the page just opened from), drawn on the final frame and baked for the DOM
uniform float uResAlpha;
uniform float uResMode;      // 0 none, 1 multiply (paper), 2 screen (dark)
uniform float uBake;         // 1 → output the residual layer itself (grey + alpha) for the overlay bake
uniform vec4 uFold[NF];
uniform float uFoldPar[NF];
uniform float uFoldRes[NF];  // residual fold tilt (radians)
uniform int uNF;
uniform vec4 uLine[NL];
uniform float uLineK[NL];
uniform int uNL;
uniform float uS;
uniform float uCell;
uniform float uSoft;
uniform float uResDepth;

in vec2 vUv;
in vec3 vPos;
in float vDeep;
in vec2 vRest;
in vec3 vNormal;
in float vBand;
out vec4 outColor;

// gradient of the residual height field: crease web + a slight tilt on every folded piece
vec2 residualGrad(vec2 x) {
  vec2 g = vec2(0.0);
  for (int j = 0; j < NL; j++) {
    if (j >= uNL) break;
    vec4 L = uLine[j];
    float f = fract(dot(x, L.xy) / L.z + L.w) - 0.5;
    float e = uCell / L.z;
    g += uLineK[j] * f / sqrt(f * f + e * e) * L.xy;
  }
  g *= uResDepth;
  float m[NF];
  for (int i = 0; i < NF; i++) {
    m[i] = 0.0;
    if (i >= uNF) break;
    vec4 F = uFold[i];
    float s = dot(x - F.xy, F.zw);
    int par = int(uFoldPar[i]);
    m[i] = (par < 0 ? 1.0 : m[par]) * smoothstep(-uSoft, uSoft, s);
    g += m[i] * tan(uFoldRes[i]) * F.zw;
  }
  return g;
}

float residualLayer() {
  vec2 g = residualGrad(vRest);
  vec3 n = normalize(vec3(-g, 1.0));
  float flat_ = max(dot(vec3(0.0, 0.0, 1.0), uLight), 0.05);
  float k = max(dot(n, uLight), 0.0) / flat_;   // 1 = no change
  // multiply layer: grey = 1 - darkness; screen layer: grey = highlight
  return uResMode > 1.5 ? clamp((k - 1.0) * 4.0 + 0.04 * (1.0 - k), 0.0, 1.0) : clamp(1.0 - (1.0 - k) * 2.2, 0.0, 1.0);
}

void main() {
  if (uBake > 0.5) {
    float c = residualLayer();
    outColor = vec4(c, c, c, 1.0);
    return;
  }
  vec4 a = texture(uTexA, vUv);
  vec4 b = texture(uTexB, vUv);
  vec3 print = mix(a.rgb, b.rgb, uMix);
  float dark = mix(uDarkA, uDarkB, uMix);
  vec3 col;
  vec3 n = normalize(cross(dFdx(vPos), dFdy(vPos)));   // flat facets: one normal per triangle
  if (dot(n, -vPos) < 0.0) n = -n;
  vec3 ns = normalize(vNormal);
  if (dot(ns, -vPos) < 0.0) ns = -ns;
  n = normalize(mix(n, ns, clamp(vBand * 1.5, 0.0, 1.0)));   // smooth inside the bend bands
  if (gl_FrontFacing) {
    col = print;
  } else {
    // blank back of the sheet, faint mirrored show-through of the print
    col = mix(uBack, print, uShowThrough);
  }
  if (uShade > 0.0) {
    vec3 v = normalize(-vPos);
    float lam = max(dot(n, uLight), 0.0);
    vec3 h = normalize(uLight + v);
    float spec = pow(max(dot(n, h), 0.0), 28.0);
    float facing = clamp(dot(n, v), 0.0, 1.0);
    float lit = uAmbient + uDiffuse * lam + uSheen * spec;
    lit *= 1.0 - uFoldDark * vDeep;
    lit *= 1.0 - uRimDark * pow(1.0 - facing, 2.0);
    vec3 shaded = col * lit;
    // the black back cover still reads on the black stage: rim light on its edges
    shaded += uRimLight * dark * pow(1.0 - facing, 3.0) * vec3(0.88, 0.94, 1.0) * (gl_FrontFacing ? 1.0 : 0.3);
    col = mix(col, shaded, uShade);
  }
  if (uResMode > 0.5 && uResAlpha > 0.0) {
    float c = residualLayer();
    col = uResMode > 1.5 ? col + uResAlpha * (c - col * c) : col * (1.0 - uResAlpha * (1.0 - c));
  }
  outColor = vec4(col * uExposure, 1.0);
}
`;
