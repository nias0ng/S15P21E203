/**
 * 물결(수면 빛 그물)의 손잡이. 참고한 효과(aidesigner.ai 의 Caustics)의 조절 항목을 같은
 * 이름으로 옮겼습니다 — 값을 만질 때 그 페이지의 설명을 그대로 읽으면 됩니다.
 *
 * 색은 여기 없습니다. `styles/scent-display.css` 의 `--caustics-glow` · `--caustics-core` 를
 * 읽습니다 — 팔레트가 TS 로 새어 나오면 화면을 보며 색을 고칠 때 TS 를 고쳐야 합니다.
 */
export const CAUSTICS = {
  /** 흐르는 빠르기. 낮을수록 깊고 잔잔한 물 */
  speed: 0.32,
  /** 그물의 촘촘함. 높을수록 작은 칸이 많은 얕은 물 */
  scale: 1,
  /**
   * 빛줄기의 밝기.
   *
   * NOTE: 어둠 위에 바로 놓인 글자(머리 구역)가 이 빛을 등지고 섭니다. 올리면 보조 글자
   * (`--color-ink-muted`)의 대비가 빛줄기 위에서 먼저 무너집니다 — docs/어두운-방-유리판.md 의 대비 기준.
   */
  intensity: 0.5,
  /** 빛줄기 가장자리의 무지갯빛 테 */
  dispersion: 0.6,
  /** 위쪽을 비스듬히 가르는 햇살 기둥 */
  rays: 0.7,
  /** 그물이 구불거리는 정도 */
  wobble: 0.7,
} as const

export const causticsVertex = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

/*
 * 칸(보로노이) 그물 두 겹을 서로 반대로 흘려 겹칩니다. 칸의 경계가 빛줄기, 경계가 만나는
 * 꼭짓점과 두 그물이 포개지는 자리가 하얗게 달아오르는 심입니다.
 *
 * 바닥은 칠하지 않습니다 — 방의 그라데이션(`.scent-night`)이 이미 물이라, 여기서는 빛만
 * 내고 나머지는 투명하게 둡니다(프리멀티플라이드 알파).
 */
export const causticsFragment = /* glsl */ `
  uniform float uTime;
  uniform vec2 uResolution;
  uniform float uScale;
  uniform float uIntensity;
  uniform float uDispersion;
  uniform float uRays;
  uniform float uWobble;
  uniform vec3 uGlow;
  uniform vec3 uCore;

  varying vec2 vUv;

  const float TAU = 6.28318530718;

  vec2 hash2(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return fract(sin(p) * 43758.5453);
  }

  // 칸마다 점 하나가 제자리에서 맴돕니다. 폭을 0.38 로 묶어 이웃 칸을 넘지 않게 합니다
  vec2 cellPoint(vec2 cell, float t) {
    vec2 h = hash2(cell);
    return 0.5 + 0.38 * sin(t * (0.6 + 0.4 * h.yx) + TAU * h);
  }

  /*
   * 칸 경계까지의 거리. x 는 가장 가까운 경계, y 는 그다음 경계라 꼭짓점에서는 둘 다 0 입니다.
   * 두 점 사이 거리의 차(F2 - F1)로 재면 줄 굵기가 칸마다 달라져, 이웃 점과의 수직이등분선까지
   * 거리를 잽니다.
   *
   * NOTE: 두 번째 탐색은 정석이 5x5 인데 3x3 으로 줄였습니다. 점이 칸 안(0.12~0.88)에서만
   * 맴돌아 바깥 줄까지 볼 일이 드뭅니다 — 5x5 와 달라지는 픽셀이 0.2% 미만이고 GPU 시간은
   * 절반입니다 (Intel Arc 내장 GPU · 1440x810 에서 2.0ms → 1.1ms).
   */
  vec2 cellBorders(vec2 x, float t) {
    vec2 n = floor(x);
    vec2 f = fract(x);

    vec2 nearCell = vec2(0.0);
    vec2 nearVec = vec2(0.0);
    float nearDist = 8.0;
    for (int j = -1; j <= 1; j++) {
      for (int i = -1; i <= 1; i++) {
        vec2 g = vec2(float(i), float(j));
        vec2 r = g + cellPoint(n + g, t) - f;
        float d = dot(r, r);
        if (d < nearDist) {
          nearDist = d;
          nearVec = r;
          nearCell = g;
        }
      }
    }

    float first = 8.0;
    float second = 8.0;
    for (int j = -1; j <= 1; j++) {
      for (int i = -1; i <= 1; i++) {
        vec2 g = nearCell + vec2(float(i), float(j));
        vec2 r = g + cellPoint(n + g, t) - f;
        vec2 gap = r - nearVec;
        if (dot(gap, gap) > 0.00001) {
          float d = dot(0.5 * (nearVec + r), normalize(gap));
          second = min(second, max(d, first));
          first = min(first, d);
        }
      }
    }
    return vec2(first, second);
  }

  vec2 warp(vec2 p, float t) {
    vec2 q = p;
    q += uWobble * 0.1 * vec2(sin(p.y * 2.3 + t * 0.9), sin(p.x * 1.9 - t * 0.8));
    q += uWobble * 0.05 * vec2(sin(p.y * 4.7 - t * 1.3 + 1.7), sin(p.x * 5.3 + t * 1.1 + 0.4));
    return q;
  }

  // 경계 거리 → 빛. 가운데는 좁고 뜨겁게, 둘레는 넓게 번집니다
  float filament(float d, float sharp) {
    d = max(d, 0.0);
    return exp(-d * sharp) + 0.22 * exp(-d * sharp * 0.18);
  }

  void main() {
    float t = uTime;
    float aspect = uResolution.x / uResolution.y;
    // 세로 한 화면에 칸이 네 개쯤 — 화면 높이로 나눠 창 모양이 달라도 칸은 정사각형입니다
    vec2 p = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y * uScale * 4.0;

    mat2 turnA = mat2(0.955, 0.296, -0.296, 0.955);
    mat2 turnB = mat2(0.62, -0.785, 0.785, 0.62);
    vec2 pa = warp(turnA * p + vec2(0.06, 0.035) * t, t);
    vec2 pb = warp(turnB * p * 1.7 - vec2(0.05, -0.07) * t, t * 1.1 + 3.0);

    vec2 wideWeb = cellBorders(pa, t * 0.55);
    vec2 fineWeb = cellBorders(pb, t * 0.7 + 11.0);

    // 채널마다 경계를 조금씩 밀어, 빛줄기 가장자리가 물속 빛처럼 갈라집니다
    vec3 split = vec3(1.0, 0.0, -1.0) * uDispersion * 0.012;
    vec3 web = vec3(
      filament(wideWeb.x + split.r, 55.0),
      filament(wideWeb.x + split.g, 55.0),
      filament(wideWeb.x + split.b, 55.0)
    );
    web += 0.35 * filament(fineWeb.x, 70.0);

    float knot = exp(-wideWeb.y * 22.0);
    float overlap = exp(-wideWeb.x * 40.0) * exp(-fineWeb.x * 50.0);
    float hot = knot * 0.9 + overlap * 1.4;

    // 밝은 자리가 물결을 따라 천천히 옮겨 다닙니다
    float travel = 0.6 + 0.4 * sin(dot(p, vec2(0.55, 0.3)) - t * 0.45)
                             * sin(dot(p, vec2(-0.25, 0.6)) + t * 0.33);

    /*
     * 수면 쪽(위)이 밝고 바닥으로 갈수록 가라앉습니다. 방의 빛무리(왼쪽 위 25% · -5%)와 같은
     * 자리를 가장 밝게 두어, 그라데이션과 빛 그물이 한 광원에서 온 것으로 읽힙니다.
     */
    float depth = mix(0.35, 1.0, smoothstep(0.0, 1.0, vUv.y));
    float pool = exp(-length((vUv - vec2(0.25, 1.05)) * vec2(aspect, 1.0)) * 1.4);
    float reach = depth * (0.7 + 0.5 * pool);

    vec3 light = (uGlow * web + uCore * hot) * travel * uIntensity * reach;

    float slant = vUv.x * aspect + vUv.y * 0.45;
    float shafts = pow(0.5 + 0.5 * sin(slant * 7.0 + t * 0.12), 8.0) * 0.6
                 + pow(0.5 + 0.5 * sin(slant * 12.7 - t * 0.09 + 1.3), 10.0) * 0.4;
    light += uGlow * shafts * smoothstep(0.35, 1.0, vUv.y) * uRays * 0.06;

    float alpha = clamp(max(light.r, max(light.g, light.b)), 0.0, 1.0);
    gl_FragColor = vec4(min(light, vec3(alpha)), alpha);
  }
`
