/**
 * 수면 아래의 손잡이. 물결(`CAUSTICS`)처럼 색은 여기 없고 `--caustics-glow` · `--caustics-core`
 * 를 읽으며, 밝기 · 빛줄기 세기 · 흐르는 빠르기도 물결 값을 그대로 씁니다 — 두 화면을 오가도
 * 빛이 같게.
 *
 * 값은 시안 「잠수하는 향수 목록」의 조절판에서 디자인이 맞춘 것입니다.
 */
export const UNDERWATER = {
  /** 세로 화각(°). 넓을수록 머리 위 천장이 크게 들어와, 평면 화면에 공간감이 생깁니다 */
  fov: 60,
  /** 올려다보는 각도(°). 가라앉는 동안에도 그대로입니다 — 숙이면 내려가는 느낌이 아니라 둘러보는 느낌이 됩니다 */
  pitch: 19,
  /** 방 깊이(0 ~ 1). 1 이면 수면이 처음부터 멀어 한 톤 가라앉은 채로 시작합니다 */
  depth: 1,
  /**
   * 가장 밝은 천장이 화면 위 가장자리에서 내려온 거리(세로 한 화면 = 1).
   *
   * NOTE: 헤더가 방과 같은 그림으로 위를 가리고 그 아래 160px 에 걸쳐 물빛이 드러나서, 이 값이
   * 작으면 밝은 천장이 헤더에 묻힙니다. 헤더 높이를 바꾸면 이 값도 같이 봅니다.
   */
  glareDrop: 0.1,
  /** 절반만큼 가라앉는 스크롤 거리(화면 수) */
  halfScreens: 0.5,
  /** 끝까지 가라앉았을 때 방 바탕에 덮는 어둠의 불투명도 */
  roomDim: 0.65,
} as const

/*
 * 수면(끝없이 넓은 물결 면)을 물속에서 비스듬히 올려다봅니다. 시선이 물결 면을 지나 하늘로
 * 빠져나가면 환하고, 너무 비스듬해 빠져나가지 못하면(전반사) 깊은 물을 비춰 어둡습니다 —
 * 그래서 마루 · 골을 따라 결이 생깁니다. 빛줄기는 레퍼런스에서 잰 자리(화면 왼쪽 가장자리 위)에서
 * 부채꼴로 내려오고, 가장 밝은 천장은 헤더 아래로 내려 둡니다.
 *
 * 가라앉기(`uDive`)는 고개를 그대로 둔 채 곧게 내려가는 것입니다. 수면까지의 거리가 멀어져
 * 물결이 위로 흘러가며 잘아지고, 물이 빛을 삼켜 수면 · 물속 · 빛줄기가 함께 어두워집니다.
 *
 * 두 겹(`uFine` · `uWide`)은 물결과 같은 뜻입니다 — 옅은 물빛과 굵은 빛줄기 · 반짝임.
 * 바닥은 칠하지 않습니다. 방의 그라데이션이 물이고 여기서는 빛만 냅니다(프리멀티플라이드 알파).
 */
export const underwaterFragment = /* glsl */ `
  uniform float uTime;
  uniform vec2 uResolution;
  uniform float uIntensity;
  uniform float uRays;
  uniform vec3 uGlow;
  uniform vec3 uCore;
  uniform float uFine;
  uniform float uWide;
  uniform float uDepth;
  uniform float uDive;
  uniform float uPitch;
  uniform float uFocal;
  uniform float uDrop;

  // 카메라 → 세상 (p 만큼 올려다봄)
  vec3 lookUp(vec3 v, float p) {
    return vec3(v.x, v.y * cos(p) + v.z * sin(p), v.z * cos(p) - v.y * sin(p));
  }

  // 화면 자리 → 수면에 닿는 자리(x 옆, y 앞). den 이 0 이하면 수면에 닿지 않는 시선입니다
  vec2 ceilingAt(vec2 uv, float height, out float den) {
    den = uv.y * cos(uPitch) + uFocal * sin(uPitch);
    return height * vec2(uv.x, uFocal * cos(uPitch) - uv.y * sin(uPitch)) / max(den, 0.001);
  }

  // 빛줄기가 모이는 자리 — 화면 왼쪽 가장자리 위, 위 가장자리에서 화면 높이 1/3 위 (세로 한 화면 = 1)
  vec2 sunAt() {
    return vec2(-0.48 * uResolution.x / uResolution.y, 0.83);
  }

  // 가장 밝은 천장 — 왼쪽에서 1/5, 위 가장자리에서 uDrop 아래
  vec2 glareAt() {
    return vec2(-0.3 * uResolution.x / uResolution.y, 0.5 - uDrop);
  }

  // 밝은 천장 쪽 물결 면이 반짝이도록, 그 방향을 수면 밖 하늘로 꺾습니다. 스넬의 창(수직에서 48.6°) 안으로 당깁니다
  vec3 skySun() {
    vec3 s = lookUp(normalize(vec3(glareAt(), uFocal)), uPitch);
    float y = max(s.y, 0.7);
    vec2 side = normalize(s.xz) * sqrt(1.0 - y * y);
    return refract(vec3(side.x, y, side.y), vec3(0.0, -1.0, 0.0), 1.33);
  }

  /*
   * 물결 열두 줄기를 겹친 수면의 기울기. 대부분 앞뒤로 밀려와 화면에서 가로로 눕습니다.
   * footprint 는 한 픽셀이 덮는 수면 너비라, 그보다 잘은 물결은 미리 지워 먼 수면이 깜빡이지 않습니다.
   */
  vec2 waveSlope(vec2 p, float t, float footprint) {
    vec2 slope = vec2(0.0);
    for (int i = 0; i < 12; i++) {
      float fi = float(i);
      float len = pow(0.76, fi);
      float k = 6.2832 / len;
      float ang = 1.5708 + (fract(sin(fi * 12.9898 + 3.1) * 43758.5453) - 0.5) * 1.4;
      vec2 dir = vec2(cos(ang), sin(ang));
      float speed = sqrt(9.8 * k) * 0.05;
      float phase = dot(dir, p) * k - t * speed + fi * 1.7;
      float fade = exp(-k * footprint * k * footprint * 1.5);
      slope += dir * (0.13 * cos(phase) * fade);
    }
    return slope;
  }

  vec4 rayHash(float cell) {
    return fract(sin(vec4(12.9898, 78.233, 37.719, 93.989) * cell) * 43758.5453);
  }

  // 빛줄기 다발 하나 — 1분 남짓한 박자로 아주 조금 기울고 은은하게 밝아졌다 옅어집니다
  float rayBundle(float a, float center, float spread, float amp, float t, float seed) {
    float d = (a - center - 0.03 * sin(t * 0.21 + seed)) / spread;
    return amp * (0.8 + 0.2 * sin(t * 0.3 + seed * 2.3)) * exp(-d * d);
  }

  /*
   * 줄기 한 벌 — 해에서 본 각도를 한 라디안에 cells 칸으로 나눠 칸마다 keep 의 확률로 줄기를 둡니다.
   * 줄기마다 제자리에서 흔들리고 나타나는 깊이 · 길이가 다릅니다. 한 픽셀보다 가늘어지는 줄기는
   * 그만큼 넓혀 계단지지 않습니다.
   */
  float rayComb(float a, float r, float cells, float keep, float wMin, float wMax, float sharp, float t, float seed) {
    float ca = a * cells;
    float pixel = cells / (r * uResolution.y);
    float sum = 0.0;
    for (int k = -2; k <= 2; k++) {
      float cell = floor(ca) + float(k);
      vec4 h = rayHash(cell + seed);
      float center = cell + 0.5 + 0.4 * (h.x - 0.5) + 0.2 * sin(t * (0.3 + 0.25 * h.y) + 6.2832 * h.z);
      float w = mix(wMin, wMax, h.y);
      float we = sqrt(w * w + pixel * pixel);
      float d = (ca - center) / we;
      float start = mix(0.5, 0.85, h.z);
      float reach = smoothstep(start - 0.2, start + 0.2, r) * exp(-r * mix(0.25, 0.7, h.x));
      float amp = mix(0.4, 1.0, fract(h.x * 7.31 + h.y * 3.17)) * (0.75 + 0.25 * sin(t * (0.35 + 0.2 * h.w) + 6.2832 * h.x));
      float dd = d * d;
      sum += step(1.0 - keep, h.w) * amp * (w / we) * exp(-mix(dd, dd * dd, sharp)) * reach;
    }
    return sum;
  }

  // 레퍼런스에서 잰 다발 자리(56° · 82° · 43° · 29°)에 부드러운 굵은 줄기 · 또렷한 가는 줄기 두 벌
  float sunRays(vec2 uv, float t) {
    vec2 v = uv - sunAt();
    float r = length(v);
    float a = atan(-v.y, v.x);
    float gather = 0.06
      + rayBundle(a, 0.977, 0.09, 1.0, t, 0.0)
      + rayBundle(a, 1.431, 0.12, 1.0, t, 2.1)
      + rayBundle(a, 0.75, 0.04, 0.3, t, 4.2)
      + rayBundle(a, 0.506, 0.06, 0.35, t, 5.3);
    float beams = rayComb(a, r, 12.0, 0.6, 0.25, 0.55, 0.6, t, 200.0);
    float streaks = rayComb(a, r, 26.0, 0.7, 0.25, 0.45, 1.0, t, 0.0);
    float soft = smoothstep(0.4, 0.9, r) * exp(-r * 0.5);
    return gather * (0.3 * soft + 0.7 * beams + 0.45 * streaks);
  }

  void main() {
    float t = uTime;
    float deep = clamp(uDepth, 0.0, 1.0);
    float dive = clamp(uDive, 0.0, 1.0);
    vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;

    // 방이 깊을수록, 가라앉을수록 수면이 멀어집니다(끝까지 가라앉으면 3.5 배)
    float height = mix(1.0, 2.6, deep) * (1.0 + 2.5 * dive);
    float dim = exp(-(height - 1.0) * 0.5);
    float atten = exp(-1.6 * dive);

    vec2 glow = glareAt();
    float lightDist = length(uv - glow);
    float nearSun = 0.7 * exp(-lightDist * 1.1);
    // 천장은 원근으로 납작하게 보여, 밝은 자리도 가로로 긴 타원입니다
    float glare = 0.33 * exp(-length((uv - glow) * vec2(0.8, 1.3)) * 3.4);
    vec3 sunSky = skySun();
    float surface = 0.5 * uFine + 0.5 * uWide;
    vec3 light = vec3(0.0);

    vec3 dir = lookUp(normalize(vec3(uv, uFocal)), uPitch);
    float den;
    vec2 hit = ceilingAt(uv, height, den);
    // 화면 맨 위 줄의 수면이 얼마나 앞에 있는지 — 옅어지는 정도를 이 거리에 견줘 위쪽은 늘 또렷합니다
    float topDen;
    float aheadTop = ceilingAt(vec2(0.0, 0.5), 1.0, topDen).y;
    if (den > 0.02) {
      float ahead = hit.y / height;
      float clear = exp(-max(ahead / aheadTop - 1.0, 0.0) * 0.5) * dim;
      if (clear > 0.004) {
        float footprint = height * uFocal / (den * den * uResolution.y);
        vec2 slope = waveSlope(hit, t, footprint);
        vec3 up = normalize(vec3(-slope.x, 1.0, -slope.y));
        float cosi = dot(dir, up);
        // 1 - (1.33 · sinθ)² — 0 보다 작으면 전반사, 클수록 하늘빛이 잘 빠져나갑니다
        float pass = smoothstep(0.0, 0.5, 1.0 - 1.769 * (1.0 - cosi * cosi));
        vec3 outDir = refract(dir, -up, 1.33);
        float sky = pass * (0.35 + 0.65 * max(outDir.y, 0.0));
        vec3 bounce = reflect(dir, -up);
        sky += (1.0 - pass) * 0.22 * (1.0 - smoothstep(0.0, 0.5, -bounce.y));
        float glint = pass * pow(max(dot(outDir, sunSky), 0.0), 60.0);
        float lit = 0.15 + 1.3 * nearSun + 6.0 * glare;
        light += (uGlow * (0.05 + 0.95 * sky) * surface + uCore * glint * 1.2 * uWide) * clear * lit;
        // 가장 밝은 천장은 눈부십니다 — 마루는 거의 희고 골은 어둡게 남습니다
        light += uGlow * surface * clear * glare * (0.15 + 0.85 * sky) * 16.0;
      }
      light += uGlow * uFine * clear * (0.02 + 0.12 * nearSun);
    }

    // 물속 — 수면 쪽과 밝은 천장 쪽으로 갈수록 은은하게 밝습니다
    float horizon = -uFocal * tan(uPitch);
    float haze = (0.03 + 0.07 * smoothstep(horizon - 0.15, 0.5, uv.y)) * (0.35 + 1.5 * nearSun);
    light += uGlow * uFine * haze * mix(1.0, 0.55, deep);

    float strength = (0.35 * uFine + 0.65 * uWide) * uRays * mix(1.0, 0.6, deep);
    float corona = 0.42 * exp(-lightDist * 2.6);
    light = (light * uIntensity + uGlow * (sunRays(uv, t) * 1.8 + corona * 0.6) * strength) * atten;

    float alpha = clamp(max(light.r, max(light.g, light.b)), 0.0, 1.0);
    gl_FragColor = vec4(min(light, vec3(alpha)), alpha);
  }
`
