import * as THREE from 'three';
import { CONFIG } from './config.js';
import { PARAMS as P } from './params.js';

// ───────── 물보라 : 선체에 파도가 부딪혀 튀는 물 ─────────
//
// 예전 구현은 **수면 위에 고정된 점 400개**였다. 마루가 지나갈 때 그 자리의 점이 밝아지는
// 방식이라, 물이 튀는 게 아니라 "물뿌리개로 뿌린 것"처럼 보였다. 방향도 수명도 없었다.
// 게다가 가파름을 **시뮬 높이맵의 기울기만으로** 판정해서, 화면의 큰 파도(해석적 너울)를
// 아예 못 봤다 — 실측으로 화면에 0픽셀이었다. 통째로 다시 썼다.
//
// 지금은 **탄도 입자**다. 선체와 물이 부딪히는 자리에서 위로 튀어올랐다가 중력으로 떨어진다.
//
// ⚠ 트리거는 배의 **속도가 아니라** 물과 선체의 **상대 접근 속도**다. 배가 멈춰 있어도
// 파도는 배를 때린다 — 정지 상태에서 약하게 나오는 것이 물리적으로 맞다.
// 그 값은 boat.js 가 이미 구해 둔 부력 프로브에서 공짜로 나온다 (수면 높이의 변화율).
//
// ⚠ 색은 시간에 따라 간다 : 튀어오르는 동안은 **마루의 백색**, 흩어져 내려오면서 **오로라**로.
// 마루 색 규칙(보라 → 아이스블루 → 백색)과 같은 팔레트를 쓴다. 새 색을 들이지 않는다.
//
// ⚠ 입자를 남발하지 않는다. 흰 종이 위에서 흰 알갱이는 곧 '선을 지우는 것'이다.
// 수명·중력·초기속도는 정점 셰이더가 나이에서 직접 푼다 — CPU 는 태울 때만 값을 쓴다.

const SPRAY_VERT = `
uniform float uTimeQ, uLife, uGrav, uSize, uPR, uFade;
uniform vec3 uApex, uIriA, uIriB;
attribute vec3 aVel;
attribute vec2 aBirth;              // x = 태어난 시각, y = 씨앗(0~1)
varying float vA; varying vec3 vC;
void main(){
  float age = uTimeQ - aBirth.x;
  float k = age / uLife;            // 0 = 갓 태어남, 1 = 수명 끝
  if (age < 0.0 || k > 1.0) {       // 죽은 입자는 화면 밖으로 접는다
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; vA = 0.0; return;
  }
  // 탄도. position 이 태어난 자리, aVel 이 초기 속도다
  vec3 wp = position + aVel * age;
  wp.y -= 0.5 * uGrav * age * age;

  vec4 mv = modelViewMatrix * vec4(wp, 1.0);
  gl_Position = projectionMatrix * mv;
  // 솟을 때 굵고 흩어지며 가늘어진다
  gl_PointSize = uSize * uPR * (1.0 - 0.55 * k) * (12.0 / max(-mv.z, 1.0));

  // 뜨고 지는 알파 — 갑자기 나타나거나 사라지지 않는다
  vA = smoothstep(0.0, 0.08, k) * (1.0 - smoothstep(0.70, 1.0, k))
     * (1.0 - smoothstep(uFade * 0.5, uFade, -mv.z));
  // 색 : 부딪히는 순간 마루의 백색, 흩어지면서 오로라로.
  // ⚠ 백색 구간은 **짧은 섬광**이어야 한다. 이 바다는 종이(246)에 물이 237 이라
  // 흰 알갱이는 사실상 안 보인다 (실측 : 화면 점유 0.001%). 읽히는 것은 오로라 쪽이다
  vec3 aur = mix(uIriA, uIriB, aBirth.y);
  vC = mix(uApex, aur, smoothstep(0.08, 0.40, k));
}`;

const SPRAY_FRAG = `
precision mediump float;
varying float vA; varying vec3 vC;
void main(){
  vec2 d = gl_PointCoord - 0.5;
  float r = 1.0 - smoothstep(0.30, 0.5, length(d));   // 둥근 알갱이
  if (r * vA <= 0.003) discard;
  gl_FragColor = vec4(vC, r * vA);
  #include <colorspace_fragment>
}`;

export function createSpray(scene) {
  const S = CONFIG.spray;
  const N = S.count;
  const pos = new Float32Array(N * 3);
  const vel = new Float32Array(N * 3);
  const birth = new Float32Array(N * 2);
  for (let i = 0; i < N; i++) birth[i * 2] = -999;   // 전부 죽은 채로 시작

  const geo = new THREE.BufferGeometry();
  const aPos = new THREE.BufferAttribute(pos, 3);
  const aVel = new THREE.BufferAttribute(vel, 3);
  const aBirth = new THREE.BufferAttribute(birth, 2);
  aPos.setUsage(THREE.DynamicDrawUsage);
  aVel.setUsage(THREE.DynamicDrawUsage);
  aBirth.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', aPos);
  geo.setAttribute('aVel', aVel);
  geo.setAttribute('aBirth', aBirth);
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);   // 정점이 움직이므로 컬링을 끈다

  const uni = {
    uTimeQ: { value: 0 },
    uLife: { value: P.sprayLife },
    uGrav: { value: P.sprayGrav },
    uSize: { value: S.size },
    uPR: { value: 1 },
    uFade: { value: P.sprayFade },
    uApex: { value: new THREE.Color(CONFIG.color.crestApex) },
    uIriA: { value: new THREE.Color(CONFIG.color.crestViolet) },
    uIriB: { value: new THREE.Color(CONFIG.color.crestBlue) }
  };

  const points = new THREE.Points(geo, new THREE.ShaderMaterial({
    uniforms: uni, vertexShader: SPRAY_VERT, fragmentShader: SPRAY_FRAG,
    transparent: true, depthWrite: false
  }));
  points.frustumCulled = false;
  scene.add(points);

  let cursor = 0;                 // 다음에 태울 입자
  const prevGap = new Float32Array(5).fill(NaN);
  let prevQT = -1;

  // 입자 하나를 태운다. 원점은 선체와 물이 만나는 자리, 속도는 위로 + 옆으로 조금
  const emit = (x, y, z, power, flow, now) => {
    const i = cursor; cursor = (cursor + 1) % N;
    // ⚠ 수면 메시는 정점 사이를 직선으로 잇는다. 그래서 그려지는 면이 샘플 높이보다
    // 조금 위에 있고, 샘플 높이 그대로 태우면 깊이 테스트에 가려 안 보인다.
    // 옛 구현에도 같은 보정이 있었는데 다시 쓰면서 빠뜨렸다 (실측 : 점유 0.001%)
    pos[i * 3] = x; pos[i * 3 + 1] = y + P.sprayLift; pos[i * 3 + 2] = z;
    const a = Math.random() * Math.PI * 2;
    const spread = P.spraySpread * (0.4 + 0.6 * Math.random());
    // ⚠ 수직이 주다. 옆으로 퍼지는 성분은 거들 뿐 — 옆으로 세면 다시 '물뿌리개'가 된다
    vel[i * 3]     = Math.cos(a) * spread;
    // ⚠ 초기 속도에 바닥과 천장을 둘 다 둔다.
    //   바닥이 없으면 약하게 태워진 알갱이가 수면을 못 벗어나 물에 묻힌 채 끝난다
    //   (실측 : 살아 있는데 화면 점유 0%, 최고 높이 0.02).
    //   천장이 없으면 접근 속도가 튀는 순간 power 가 폭주해 3.25 까지 솟는다 — 선체가 0.58 인데
    //   물기둥이 서 버린다. 최고 높이는 v²/2g 라 속도가 조금만 커져도 급히 커진다
    vel[i * 3 + 1] = P.sprayLaunch * (0.5 + 0.5 * Math.min(power, 1.0)) * (0.75 + 0.4 * Math.random());
    vel[i * 3 + 2] = Math.sin(a) * spread + flow;   // 물살에 실려 뒤로 흘러간다
    birth[i * 2] = now;
    birth[i * 2 + 1] = Math.random();
  };

  return {
    points,
    setPixelRatio(pr) { uni.uPR.value = pr; },
    setLight() { /* 색을 팔레트에서 직접 쓰므로 광원이 필요 없다 */ },

    // ⚠ boat 를 받는다. 물보라의 트리거가 선체–수면의 상대 접근 속도이기 때문이다
    update(sim, t, boat) {
      uni.uTimeQ.value = sim.qT;
      uni.uLife.value = P.sprayLife;
      uni.uGrav.value = P.sprayGrav;
      uni.uFade.value = P.sprayFade;

      // 꺼져 있으면 아무것도 하지 않는다 (기본값. 코드는 남겨 둔다)
      if (P.sprayAmount <= 0) return;
      // 배와 같은 게이트에서만 태운다 (프로브가 그 리듬으로 갱신되므로 더 자주 볼 이유가 없다)
      if (!boat || !boat.stepped || sim.qT === prevQT) return;
      const dt = prevQT < 0 ? 1 / 8 : Math.max(1e-3, sim.qT - prevQT);
      prevQT = sim.qT;

      const pv = boat.pivot;
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(pv.quaternion);
      const ny = Math.abs(up.y) < 1e-3 ? 1e-3 : up.y;
      const flow = P.driftSpeed + CONFIG.move.scrollBoost * 0;   // 물살은 표류 속도만큼 뒤로

      for (let i = 0; i < 5; i++) {
        const [dx, dz, wh] = boat.probes[i];
        const hull = pv.position.y - (up.x * dx + up.z * dz) / ny;
        const gap = hull - wh;                       // 음수 = 그 자리가 잠겨 있다
        const prev = prevGap[i];
        prevGap[i] = gap;
        if (!isFinite(prev)) continue;

        // 접근 속도 : 수면이 선체 쪽으로 얼마나 빨리 올라왔는가. 배가 멈춰 있어도 0 이 아니다
        const close = (prev - gap) / dt;
        const power = Math.max(0, close - P.sprayHit) / Math.max(0.05, P.sprayHit);
        if (power <= 0) continue;

        // ⚠ 남발하지 않는다. 세기가 커도 한 번에 몇 알만 태운다
        const n = Math.min(3, 1 + Math.floor(power * P.sprayAmount * 2));
        for (let k = 0; k < n; k++)
          emit(pv.position.x + dx, wh, pv.position.z + dz, Math.min(2.2, power), flow, sim.qT);
      }
      aPos.needsUpdate = true; aVel.needsUpdate = true; aBirth.needsUpdate = true;
    },

    apply() {},

    dispose() {
      scene.remove(points);
      geo.dispose();
      points.material.dispose();
    }
  };
}
