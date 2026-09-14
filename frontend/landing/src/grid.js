import * as THREE from 'three';
import { CONFIG } from './config.js';
import { PARAMS as P } from './params.js';
import { SWELL } from './swell.js';
import { lineTones } from './util.js';

// ───────── 등고선 그리드 ─────────
// 수면 바로 아래 깔리는 와이어프레임. 화면에 남는 사실상 유일한 표현 수단이다.
// 3단 LOD : 셀 크기가 정확히 2배씩 커져 굵은 선의 격자가 항상 겹친다.
// 준위별 wrap(모듈로)을 따로 걸어도 서로 미끄러지지 않고, 페이드 구간이 넓어 링 경계가 안 보인다.
// 페이드 알파에 sqrt 를 거는 이유 : 겹치는 구간에서 알파가 합쳐지며 묽어지는 것을 보정한다.

const GRID_VERT = SWELL + `
uniform sampler2D uH; uniform float uHScale; uniform float uDomain; uniform float uCenterZ;
uniform float uSteepK;
uniform float uShatter0, uShatter1, uShatterAmt;
varying float vShatter;
uniform vec2 uCam; uniform float uFade0, uFade1;
attribute vec2 aPerp; uniform float uGridCell; uniform vec2 uRes;
varying float vSpace;
uniform vec2 uTexel; uniform float uCell;
varying vec3 vW; varying vec2 vUv; varying float vTrail; varying float vSteep;
varying float vH; varying vec2 vGrad;
varying vec2 vGradW;   // 월드 기울기 (시뮬 + 너울). 빛 전용 — vGrad / vSteep 은 건드리지 않는다
void main(){
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vec2 suv = clamp(vec2(0.5 + wp.x / uDomain, 0.5 - (wp.z - uCenterZ) / uDomain), 0.0, 1.0);
  vec4 hs = texture2D(uH, suv);
  vTrail = clamp(hs.z, 0.0, 1.0);
  vec2 gr = vec2(
    texture2D(uH, suv + vec2(uTexel.x, 0.0)).x - texture2D(uH, suv - vec2(uTexel.x, 0.0)).x,
    texture2D(uH, suv + vec2(0.0, uTexel.y)).x - texture2D(uH, suv - vec2(0.0, uTexel.y)).x
  ) / (2.0 * uCell);
  vGrad = gr;
  // 경사는 월드 기울기 기준 — uHScale 을 포함해야 진폭을 키울 때 반짝임과 부서짐이 함께 따라온다
  vSteep = clamp(length(gr) * uHScale * uSteepK, 0.0, 1.0);
  // 멀어질수록 변위를 접어 원경은 평평하게 — 지평선에 선이 뜨는 걸 막는다
  float fall = 1.0 - smoothstep(uFade0 * 0.55, uFade1, length(wp.xz - uCam));
  // 너울은 감쇠하지 않는다 — 감쇠시키면 그리드가 너울 아래로 깔려 수면에 가려진다
  // ⚠ 군 포락선은 **한 번만** 뜨고 H·G·D 에 같이 넘긴다 (water.js 와 같은 이유)
  vec2 sp = wp.xz + uSwellOff;
  vec4 env = swellEnv(sp);
  // ⚠ 높이와 기울기는 swellHG 로 **한 번에** 받는다 (water.js 와 같다)
  float swH; vec2 swG;
  swellHG(sp, fall, env, swH, swG);
  float wh = hs.x * uHScale * fall + swH;
  wp.y += wh;
  // 빛이 볼 기울기는 실제로 얹은 변위(wh)의 기울기여야 한다 — 너울까지 포함한다.
  // 정지 상태에서는 너울이 시뮬보다 4배 커서, 빼면 멈춰 있을 때 빛이 엉뚱한 데서 온다.
  // vSteep 은 그대로 시뮬만 본다 (마루 부서짐·물보라의 판정 기준을 바꾸지 않기 위해)
  // ⚠ gr.y 의 부호를 뒤집어서 더한다. suv.y = 0.5 - z/domain 이라 텍스처 기울기의 y 성분은
  // -∂h/∂z 인데 swellG 는 +∂h/∂z 를 준다. 원래 코드는 length() 와 atan() 에만 써서 부호가
  // 무의미했지만, 둘을 더하는 순간부터는 맞춰야 한다
  vGradW = vec2(gr.x, -gr.y) * uHScale * fall + swG;
  // Gerstner 횡변위. 매개변수 좌표(변위 전)로 계산해서 정점을 옆으로 민다 —
  // 등고선이 마루에 몰리면서 융기로 읽힌다. 진폭은 하나도 안 올린다
  wp.xz += swellD(sp, fall, env);
  // 명암용 높이는 uHScale 로 정규화 — 진폭을 키워도 매핑이 포화하지 않는다
  vH = wh / max(uHScale, 1e-3);
  vW = wp.xyz;
  // 셀 간격을 화면 픽셀로 환산 — 가로선은 지평선에서 뭉치고 세로선은 벌어진다
  vec3 off = vec3(aPerp.x, 0.0, aPerp.y) * uGridCell;          // 수직 방향 한 셀
  vec3 seg = vec3(aPerp.y, 0.0, aPerp.x) * uGridCell;          // 선분 자기 방향 한 셀
  vec4 c0 = projectionMatrix * viewMatrix * wp;
  vec4 c1 = projectionMatrix * viewMatrix * vec4(wp.xyz + off, 1.0);
  vec4 c2 = projectionMatrix * viewMatrix * vec4(wp.xyz + seg, 1.0);
  vec4 c3 = projectionMatrix * viewMatrix * vec4(wp.xyz + seg + off, 1.0);
  // w 가 0 근처면 카메라 뒤 — 클립될 정점이므로 큰 값으로 밀어둔다
  float sA = (c0.w > 0.02 && c1.w > 0.02)
    ? distance(c0.xy / c0.w * uRes * 0.5, c1.xy / c1.w * uRes * 0.5) : 999.0;
  float sB = (c2.w > 0.02 && c3.w > 0.02)
    ? distance(c2.xy / c2.w * uRes * 0.5, c3.xy / c3.w * uRes * 0.5) : 999.0;
  // 선분 양 끝 중 좀 더 빡빡한 쪽을 취한다 — 정점 보간이 먼 쪽을 과대평가하는 걸 막는다
  vSpace = min(sA, sB);
  // 부서짐은 vSpace 계산 뒤에서만 — 앞에 두면 밀도 페이드가 함께 흔들린다
  // 법선(vGrad / vSteep)은 다시 계산하지 않는다 : 지터는 표시상의 흐트러짐이고,
  // 반짝임과 분광은 원래 파형의 마루에 정확히 남아있어야 한다
  float shatter = smoothstep(uShatter0, uShatter1, vSteep);
  vShatter = shatter;
  // floor 양자화 : 인접 정점이 같은 난수를 공유해 덩어리째 움직인다. 시간은 들어가지 않는다
  float rj = fract(sin(dot(floor(wp.xz * 3.0), vec2(12.9898, 78.233))) * 43758.5453);
  vec3 jp = wp.xyz;
  jp.xz += (vec2(rj, fract(rj * 7.31)) - 0.5) * shatter * uShatterAmt;
  jp.y += (fract(rj * 13.7) - 0.5) * shatter * uShatterAmt * 0.6;
  gl_Position = projectionMatrix * viewMatrix * vec4(jp, 1.0);
}`;

const GRID_FRAG = `
uniform float uOpacity, uFade0, uFade1; uniform vec2 uCam;
uniform float uCrest, uTrailK, uIn0, uIn1, uOut0, uOut1;
uniform vec3 uLineDark, uLineLight;
uniform vec3 uIriA, uIriB;
uniform float uIriAmt, uGlintAmt, uGlintNScale;
uniform float uTime;   // 양자화하지 않은 실시간 — 형태는 멈춰도 빛만 계속 흐른다
uniform vec2 uLightXZ;     // 광원의 방위 방향 (단위벡터). main.js 의 dirLight 와 같은 곳이다
uniform float uLightAz;    // 같은 방향의 각. 분광의 기준축
uniform float uLightAmt, uReflect;
uniform float uSteepK;     // 정점 셰이더와 같은 값 — 월드 경사를 0..1 로 접는 상수
varying vec3 vW; varying vec2 vUv; varying float vTrail; varying float vSteep;
varying float vSpace; varying float vH; varying vec2 vGrad;
varying float vShatter;
varying vec2 vGradW;
void main(){
  vec2 d = abs(vUv - 0.5) * 2.0;
  float dist = length(vW.xz - uCam);
  // 준위마다 자기 가시 구간을 갖고, 안쪽은 페이드 인 · 바깥쪽은 페이드 아웃으로 서로 겹친다
  float ring = smoothstep(uIn0, uIn1, dist) * (1.0 - smoothstep(uOut0, uOut1, dist));
  // sqrt : 겹치는 구간에서 알파가 합쳐지며 묽어지는 걸 보정 — 밀도가 일정하게 유지된다
  ring = sqrt(clamp(ring, 0.0, 1.0));
  float a = uOpacity * ring * (1.0 + vTrail * 2.2 * uTrailK + vSteep * 2.4 * uCrest)
    * (1.0 - smoothstep(0.84, 0.995, max(d.x, d.y)))
    * (1.0 - smoothstep(uFade0, uFade1, dist));
  a *= smoothstep(3.0, 12.0, vSpace);   // 한 픽셀에 선이 모이기 시작하는 지점부터 지운다
  // ── 빛. 수면 메시에는 조명이 닿지 않으므로 빛은 전부 선 위에서만 일어난다.
  //
  // 물리적 내적 dot(N, L) 은 쓰지 않는다. 이 바다는 월드 단위로 거의 평평해서 (|∇h| ≈ 0.1)
  // 법선이 수직에서 6도밖에 안 기울고, 내적이 0.61~0.69 사이에서만 움직인다 — 진폭 0.08 짜리
  // 신호는 화면에 아무것도 안 남긴다. 그래서 경사의 '방향'과 '세기'를 갈라서 쓴다.
  float slope = length(vGradW);
  vec2 sdir = vGradW / max(slope, 1e-5);        // 오르막이 향하는 쪽
  // ∇h 가 광원 반대쪽을 가리킬 때 그 면이 빛을 향해 서 있다 (법선이 ∇h 의 반대라서)
  float facing = -dot(sdir, uLightXZ);
  // 완만한 데서는 빛도 약해야 한다. 경사 → 0..1 변환은 vSteep 과 같은 uSteepK 를 쓴다 —
  // 실측한 너울 기울기가 중앙값 0.036 이라 이 상수(31)에서 딱 포화한다.
  // 진폭을 키우면 vSteep 과 함께 따라오므로 빛만 따로 다시 맞출 일이 없다
  float lit = facing * clamp(slope * uSteepK, 0.0, 1.0);   // -1 = 등진 면, +1 = 받는 면

  // 골은 짙게, 마루는 배경 쪽으로 옅게 — 선만으로 명암이 생긴다
  vec3 col = mix(uLineDark, uLineLight, clamp(0.5 + vH * 2.6, 0.0, 1.0));

  // ⚠ 빛을 높이와 같은 clamp 안에 더하면 안 된다 — vH * 2.6 만으로 이미 -0.27~1.27 을 넘나들어
  // 대부분의 면이 포화 상태라, 더한 빛이 통째로 잘린다.
  //
  // 그리고 방향을 대칭으로 주면 안 된다. 이건 흰 종이 위의 잉크 그림이라, 빛을 '더 하얗게'
  // 만드는 것은 곧 선을 지우는 것이다 — 절반의 선이 옅어지면 방향감이 생기는 게 아니라
  // 그림이 성기어진다 (실측 : 대칭으로 주면 원본보다 흐려진다).
  // 그래서 빛이 아니라 그늘을 그린다. 등진 면에만 잉크를 얹고, 받는 면은 그냥 둔다
  float shade = max(-lit, 0.0);        // 빛을 등진 정도 0..1
  col = mix(col, uLineDark, uLightAmt * shade * 0.6);

  // 반사도 같은 원리로 재정의한다 — 진짜로 비추지 않는다 (하늘이 없어 비출 대상이 없고,
  // 씬을 한 번 더 그리면 19.5만 정점이 2배가 된다). 그늘진 면에서 등고선이 짙어지는 국소 변화다
  a *= 1.0 + uReflect * shade * 1.6;

  // 경사면이 향한 방향에 따라 아주 옅게 색이 갈린다 — 물보라와 완전히 같은 색 체계.
  // 기준축을 광원의 방위각으로 잡는다. 그래야 좌표 기준의 무늬가 아니라 '빛에 갈리는 색'이 된다
  // atan(0,0) 은 GLSL 에서 정의되지 않는다 — 정지한 원경은 vGrad 가 정확히 0 이라 NaN 이 색을 먹는다
  float ang = atan(vGrad.y, vGrad.x + 1e-6) - uLightAz * uLightAmt;
  float drift = sin(vW.x * 0.09 + vW.z * 0.07 + ang * 0.5 + uTime * 0.35) * 0.5 + 0.5;
  col = mix(col, mix(uIriA, uIriB, drift), uIriAmt * vSteep * 0.45);
  // 반짝임 : 마루 경사에서만 선이 끊기며 흰 공간으로 튄다. 빛을 받는 면에서만 튀게 한다
  // 셀 번호를 mod 로 접어 둔다 — 원경의 큰 좌표가 sin 정밀도를 넘겨 줄무늬가 되는 걸 막는다
  vec3 gp = mod(floor(vec3(vW.xz, vH * 9.0) * uGlintNScale), 512.0);
  float n = fract(sin(dot(gp, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
  float face = mix(1.0, smoothstep(-0.15, 0.55, lit), uLightAmt);
  a *= 1.0 - 0.85 * smoothstep(0.82, 1.0, n) * vSteep * uGlintAmt * face;
  a *= 1.0 - vShatter * 0.45;   // 깨진 곳에서는 선도 끊긴다
  if (a < 0.004) discard;
  gl_FragColor = vec4(col, a);
  #include <colorspace_fragment>
}`;

// 축 정렬 선분만 만든다 — 쿼드 대각선 없음. 파를 타야 하므로 셀 단위로 분할한다
function buildLines(size, div) {
  const step = size / div, h = size / 2;
  const pos = [], uv = [], perp = [];
  const push = (x0, z0, x1, z1, px, pz) => {
    pos.push(x0, 0, z0, x1, 0, z1);
    uv.push((x0 + h) / size, (z0 + h) / size, (x1 + h) / size, (z1 + h) / size);
    perp.push(px, pz, px, pz);
  };
  for (let i = 0; i <= div; i++) {
    const a = -h + i * step;
    for (let j = 0; j < div; j++) {
      const b0 = -h + j * step, b1 = b0 + step;
      push(a, b0, a, b1, 1, 0);              // Z 방향 선분 → 수직은 X축
      push(b0, a, b1, a, 0, 1);              // X 방향 선분 → 수직은 Z축
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('aPerp', new THREE.Float32BufferAttribute(perp, 2));
  return g;
}

export function createGrids(scene, tex) {
  const S = CONFIG.sim, G = CONFIG.grid;

  const mkGrid = (L) => {
    const tones = lineTones(P.lineContrast);
    const uni = {
      uH: { value: tex },
      uHScale: { value: S.height * P.gridWave },
      uDomain: { value: S.domain }, uCenterZ: { value: S.centerZ },
      uTexel: { value: new THREE.Vector2(1 / S.res, 1 / S.res) },
      uCell: { value: S.domain / S.res },
      uSteepK: { value: G.steepK },
      uShatter0: { value: CONFIG.shatter.s0 }, uShatter1: { value: CONFIG.shatter.s1 },
      uShatterAmt: { value: P.shatterAmount },
      uIriA: { value: new THREE.Color(CONFIG.line.iriA) },
      uIriB: { value: new THREE.Color(CONFIG.line.iriB) },
      uLineDark: { value: tones.dark }, uLineLight: { value: tones.light },
      uIriAmt: { value: P.iriAmount },
      uGlintAmt: { value: P.glintAmount },
      uGlintNScale: { value: P.glintScatter },
      uLightXZ: { value: new THREE.Vector2(1, 0) },   // setLight() 가 채운다
      uLightAz: { value: 0 },
      uLightAmt: { value: P.lightAmount },
      uReflect: { value: P.reflect },
      uTime: { value: 0 }, uTimeQ: { value: 0 },
      uSwellA: { value: P.oceanSwell },
      uCrossA: { value: P.oceanSwell * P.crossAmount },
      uRippleA: { value: P.ripple },
      uGerstner: { value: P.gerstner },
      // ── 군 포락선 (2026-09-06). water.js · sim.js 와 **같이** 밀어야 한다 (불변식 2)
      uEnvAmt:   { value: P.envAmount }, uEnvLo:    { value: P.envLo },
      uEnvHi:    { value: P.envHi },     uEnvRLo:   { value: P.envRLo },
      uEnvRHi:   { value: P.envRHi },    uEnvBeta:  { value: P.envBeta },
      uEnvGerst: { value: P.envGerst },  uEnvSpeed: { value: P.envSpeed },
      uWaveSpeed: { value: P.waveSpeed },
      uSwellOff: { value: new THREE.Vector2() },
      uOpacity: { value: P.lineOpacity },
      uCrest: { value: P.crest },
      uTrailK: { value: P.trailEmphasis },
      uIn0: { value: L.in0 }, uIn1: { value: L.in1 },
      uOut0: { value: L.out0 }, uOut1: { value: L.out1 },
      uGridCell: { value: L.size / L.div },   // 준위마다 값이 다른 게 정상
      uRes: { value: new THREE.Vector2() },
      uFade0: { value: G.fade0 }, uFade1: { value: G.fade1 },
      uCam: { value: new THREE.Vector2(0, CONFIG.cam.zNear) }
    };
    const mesh = new THREE.LineSegments(
      buildLines(L.size, L.div),
      new THREE.ShaderMaterial({
        uniforms: uni, vertexShader: GRID_VERT, fragmentShader: GRID_FRAG,
        transparent: true, depthWrite: false
      })
    );
    mesh.position.y = G.y;   // buildLines 가 이미 XZ 평면으로 생성 — 회전 불필요
    mesh.frustumCulled = false;
    mesh.visible = P.showGrid;
    scene.add(mesh);
    return { mesh, uni, cell: L.size / L.div, base: L.base };
  };

  const list = CONFIG.gridLods.map(mkGrid);

  return {
    list,
    // 픽셀 밀도 페이드가 쓸 실제 버퍼 해상도. 드라이버가 clamp 할 수 있으니 getSize 기준
    setRes(w, h) { list.forEach(g => g.uni.uRes.value.set(w, h)); },

    // 광원 방향(수면 → 광원, 단위벡터). main.js 의 dirLight 와 같은 벡터를 넘겨야
    // 배와 물이 처음으로 같은 곳에서 빛을 받는다. spray 에도 같은 값을 넘긴다
    setLight(dir) {
      const az = Math.atan2(dir.z, dir.x);
      const cx = Math.cos(az), cz = Math.sin(az);   // 방위 성분만 — 셰이더는 평면 방향만 본다
      list.forEach(g => { g.uni.uLightXZ.value.set(cx, cz); g.uni.uLightAz.value = az; });
    },

    update(sim, t, cam, scroll) {
      list.forEach(g => {
        g.uni.uH.value = sim.texture;
        g.uni.uTimeQ.value = sim.qT;
        g.uni.uTime.value = t;              // 빛의 흐름만 60fps
        g.uni.uSwellA.value = P.oceanSwell;
        g.uni.uCrossA.value = P.oceanSwell * P.crossAmount;
        g.uni.uRippleA.value = P.ripple;
        g.uni.uGerstner.value = P.gerstner;
        g.uni.uEnvAmt.value = P.envAmount;   g.uni.uEnvLo.value = P.envLo;
        g.uni.uEnvHi.value = P.envHi;        g.uni.uEnvRLo.value = P.envRLo;
        g.uni.uEnvRHi.value = P.envRHi;      g.uni.uEnvBeta.value = P.envBeta;
        g.uni.uEnvGerst.value = P.envGerst;  g.uni.uEnvSpeed.value = P.envSpeed;
        g.uni.uWaveSpeed.value = P.waveSpeed;
        g.uni.uSwellOff.value.set(sim.qScroll.x, -sim.qScroll.z);
        // 거리 페이드·변위 접기의 원점은 카메라의 실제 월드 XZ 다 (water.js 와 같은 이유).
        // x 를 0 으로 굳히면 카메라를 옮기는 순간 반대쪽 지평선에 선이 뜬다
        g.uni.uCam.value.set(cam.position.x, cam.position.z);
        // 링마다 자기 셀 크기로 wrap — 준위가 달라도 서로 미끄러지지 않는다
        g.mesh.position.x = -(((scroll.x % g.cell) + g.cell) % g.cell);
        g.mesh.position.z = g.base + (((scroll.z % g.cell) + g.cell) % g.cell);
      });
    },

    apply() {
      const tn = lineTones(P.lineContrast);
      list.forEach(g => {
        g.mesh.visible = P.showGrid;
        g.uni.uLineDark.value.copy(tn.dark);
        g.uni.uLineLight.value.copy(tn.light);
        g.uni.uIriAmt.value = P.iriAmount;
        g.uni.uGlintAmt.value = P.glintAmount;
        g.uni.uGlintNScale.value = P.glintScatter;
        g.uni.uOpacity.value = P.lineOpacity;
        g.uni.uTrailK.value = P.trailEmphasis;
        g.uni.uHScale.value = CONFIG.sim.height * P.gridWave;
        g.uni.uCrest.value = P.crest;
        g.uni.uShatterAmt.value = P.shatterAmount;
        g.uni.uLightAmt.value = P.lightAmount;
        g.uni.uReflect.value = P.reflect;
      });
    },

    dispose() {
      list.forEach(g => {
        scene.remove(g.mesh);
        g.mesh.geometry.dispose();
        g.mesh.material.dispose();
      });
    }
  };
}
