import * as THREE from 'three';
import { chainShader } from './sunfx.js';

// ───────── 주변 차폐(AO) — 정점에 한 번 굽는다 (2026-09-26, S15P21E203-435 · 역광 '중간안' 3단계) ─────────
// 사용자 : *"배 오브젝트도 … 주인공인데 비해 볼품없는 퀄리티"* · 2026-09-09 의 *"내부 조타 공간의 음영"* (params.boatShadow 주석 — 그때는 AO 가 없어 못 했다).
//   주광이 해 쪽으로 가면서(불변식 35) 카메라를 보는 면은 **하늘빛(반구광 · 환경맵)만** 받는다. 하늘빛은 방향이 없어서
//   난간 밑 · 선실 모서리 · 조타석 안쪽이 탁 트인 선체 옆구리와 같은 밝기로 칠해졌다 — 형태가 평평하게 눌린 까닭이다.
//   그 하늘빛을 '이 점에서 하늘이 얼마나 보이는가' 만큼 줄인다.
//
// ⚠⚠ **GLB 에 AO 가 없다.** boat_v2.glb 는 텍스처가 0장이다 (2026-09-26 확인 — 재질 23개가 전부 색 · 거칠기 값뿐).
//   예전 주석의 'ORM 한 장 · aoMap 은 uv2 가 없어 안 먹는다' 는 첫 GLB 이야기다 (three 0.160 은 aoMap 을 uv 로도 읽는다 — 되살릴 맵이 없을 뿐이다).
//   그래서 **굽는다** : 배를 둘러싼 방향 N 개에서 깊이를 한 장씩 찍고(그림자 맵과 같은 원리),
//   정점마다 '그 방향에서 가려졌는가' 를 법선 코사인으로 가중해 더한다 = 하늘이 보이는 몫.
//   ⭐ (2026-09-27, 최적화 2) 이 함수로 **한 번 구운 값을 GLB 에 실어 둔다** (`_AOFB` · scripts/pack-boat.mjs) — 보통은 불러올 때 굽지 않는다 (boat.js).
//     이 함수는 파일에 차폐가 없을 때(원본 `?boat=src` · 모델을 갈았을 때)만 돈다 — 모델이 바뀌어도 따라오는 길은 그대로 남는다.
//   ⚠ 구운 값은 **자세를 조금 탄다** — 방향 96개가 월드에 고정이라 배를 37° 돌려 구우면 화면 픽셀의 17% 가 2레벨 넘게 달라진다 (2026-09-27 실측).
//     예전에는 불러올 때마다 그 순간의 파도 자세로 구워 미세하게 달랐다 — 파일에 실은 뒤로는 늘 같다.
//
// ⚠ 무엇을 가리는가 : **하늘빛(간접광)만.** three 의 aoMap 과 같은 자리 · 같은 식이다 (aomap_fragment 바로 뒤) —
//   확산 간접광 · 환경 정반사 · 클리어코트 반사. 해 · 앞 채움(직접광)은 안 건드린다 — 그쪽의 가림은 그림자 맵이 이미 한다.
// ⚠ 면의 **양쪽을 따로** 굽는다 (x = 법선 쪽 · y = 반대쪽). 이 배는 양면 재질이라 얇은 벽 하나가 안팎을 다 그린다 —
//   한 값만 두면 선실 벽의 안쪽이 바깥의 밝기를 받는다. 셰이더가 gl_FrontFacing 으로 고른다.
// ⚠ 돛(Veil)은 **가리는 쪽에서 뺀다** — 반투명한 흰 천이라 그 밑이 실제로 어둡지 않다 (해를 등지면 빛나기까지 한다 · sunfx.js).
//   돛 자신의 차폐는 굽는다.
// ⚠ 굽는 것은 (파일에 없을 때) **불러올 때 한 번**이다 (앱의 로딩 커튼 뒤 · 90~280ms). 매 프레임 비용은 정점당 값 둘 · 곱셈 몇 개다.
//   굽고 나면 타깃 · 텍스처 · 재질을 전부 버린다 — 남는 것은 지오메트리의 속성뿐이라 이 모듈이 따로 버릴 것이 없다 (불변식 10).

// ⚠ 소비자가 **같은 객체**를 물린다 — 세기는 main.js · boat.js 가 params 에서 한 곳에 싣는다 (sunfx.js 의 SUN_FX 와 같은 규율)
export const VAO = {
  uVaoK: { value: 1 }   // 0 = 차폐 없음 (곱이 정확히 1 이라 예전 화면과 같다) · 1 = 구운 그대로
};

// 방향 — 구 위에 고르게 (피보나치 나선). 법선 쪽 반구에 약 절반이 든다
function sphereDirs(n) {
  const out = [], ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - 2 * (i + 0.5) / n, r = Math.sqrt(Math.max(0, 1 - y * y)), a = i * ga;
    out.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r));
  }
  return out;
}

const QUAD_VERT = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

// 한 방향의 몫을 더한다. 픽셀 하나 = 정점 하나 (tPos · tNrm 의 같은 자리)
const ACC_FRAG = `
uniform sampler2D tPos, tNrm, tDepth;
uniform mat4 uVP;
uniform vec3 uDir;
uniform float uOff, uBias;
varying vec2 vUv;
void main() {
  vec4 p = texture2D(tPos, vUv);
  if (p.w < 0.5) discard;                      // 끝줄의 빈 칸
  vec3 n = texture2D(tNrm, vUv).xyz;
  float c = dot(n, uDir);
  // 이 방향을 보는 쪽 면으로 조금 밀어 낸다 — 자기 자신에게 가려지는 것(그림자 여드름)을 막는다
  vec4 q = uVP * vec4(p.xyz + n * (c >= 0.0 ? uOff : -uOff), 1.0);
  vec3 ndc = q.xyz / q.w;
  vec2 uv = ndc.xy * 0.5 + 0.5;
  float d = ndc.z * 0.5 + 0.5;
  float vis = d <= texture2D(tDepth, uv).x + uBias ? 1.0 : 0.0;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) vis = 1.0;
  float wF = max(c, 0.0), wB = max(-c, 0.0);  // 코사인 가중 — 법선 쪽 · 반대쪽
  gl_FragColor = vec4(vis * wF, wF, vis * wB, wB);
}
`;

// 합을 몫으로 — 8비트로 읽어 올 수 있게 한다 (반정밀 부동소수 되읽기는 기기마다 된다 · 안 된다가 갈린다)
const RESOLVE_FRAG = `
uniform sampler2D tAcc;
varying vec2 vUv;
void main() {
  vec4 a = texture2D(tAcc, vUv);
  float f = a.y > 1e-4 ? a.x / a.y : 1.0;
  float b = a.w > 1e-4 ? a.z / a.w : 1.0;
  gl_FragColor = vec4(f, b, 0.0, 1.0);
}
`;

/**
 * root 아래 메시들의 정점마다 차폐를 굽는다 → geometry 에 `aoFB`(2 성분 · 0~1 · x 법선 쪽 · y 반대쪽)를 단다.
 * @param dirs 방향 개수 · size 깊이 한 장의 한 변 · occluder(mesh) 가리는 쪽에 넣을지 (기본 : 전부) ·
 *        offTx · biasTx 자기 자신에게 가려지지 않게 법선 쪽으로 밀어내는 양 · 깊이 여유 (둘 다 깊이 텍셀 단위)
 *   ⚠ 갑판의 옅은 결(±8% 안팎)은 이 둘 · 방향 수 · 해상도로 안 없어진다 — 가림 오차가 아니라 모델 갑판의 법선 물결이다 (2026-09-26 실측)
 * @returns { ok, ms, verts, dirs } — ok false 면 아무 속성도 안 달았다 (부동소수 렌더 타깃이 없는 기기)
 */
export function bakeVertexAO(renderer, root, { dirs = 96, size = 1024, occluder = () => true, offTx = 1.5, biasTx = 1.5 } = {}) {
  const t0 = performance.now();
  const ext = renderer.extensions;
  if (!(ext.has('EXT_color_buffer_float') || ext.has('EXT_color_buffer_half_float'))) {
    return { ok: false, ms: 0, verts: 0, dirs: 0 };
  }
  // ── 1. 정점을 월드 좌표로 모은다. 모든 조각이 같이 움직이므로(한 배) 굽는 순간의 자세 그대로 써도 된다
  root.updateWorldMatrix(true, true);
  const meshes = [];
  root.traverse(o => { if (o.isMesh && o.geometry && o.geometry.attributes.position && o.geometry.attributes.normal) meshes.push(o); });
  let N = 0;
  for (const m of meshes) N += m.geometry.attributes.position.count;
  if (!N) return { ok: false, ms: 0, verts: 0, dirs: 0 };
  const TW = 1024, TH = Math.ceil(N / TW);
  const pos = new Float32Array(TW * TH * 4), nrm = new Float32Array(TW * TH * 4);
  const v = new THREE.Vector3(), nm = new THREE.Matrix3(), box = new THREE.Box3();
  let off = 0;
  for (const m of meshes) {
    const P = m.geometry.attributes.position, Nn = m.geometry.attributes.normal;
    nm.getNormalMatrix(m.matrixWorld);
    for (let i = 0; i < P.count; i++) {
      const k = (off + i) * 4;
      v.fromBufferAttribute(P, i).applyMatrix4(m.matrixWorld);
      pos[k] = v.x; pos[k + 1] = v.y; pos[k + 2] = v.z; pos[k + 3] = 1;
      box.expandByPoint(v);
      v.fromBufferAttribute(Nn, i).applyMatrix3(nm).normalize();
      nrm[k] = v.x; nrm[k + 1] = v.y; nrm[k + 2] = v.z; nrm[k + 3] = 0;
    }
    off += P.count;
  }
  const center = box.getCenter(new THREE.Vector3());
  const R = box.getSize(new THREE.Vector3()).length() * 0.5 * 1.02;
  const texel = (2 * R) / size;   // 깊이 한 텍셀의 월드 폭 (이 배 : 약 1cm)

  const dataTex = (arr) => {
    const t = new THREE.DataTexture(arr, TW, TH, THREE.RGBAFormat, THREE.FloatType);
    t.minFilter = t.magFilter = THREE.NearestFilter;
    t.needsUpdate = true;
    return t;
  };
  const tPos = dataTex(pos), tNrm = dataTex(nrm);

  // ── 2. 가리는 쪽 — 원본 지오메트리를 그대로 빌려 깊이만 찍는다 (양면 · 색 안 씀)
  const depthScene = new THREE.Scene();
  const depthMat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, colorWrite: false });
  for (const m of meshes) {
    if (!occluder(m)) continue;
    const p = new THREE.Mesh(m.geometry, depthMat);
    p.matrixAutoUpdate = false;
    p.matrix.copy(m.matrixWorld);
    p.frustumCulled = false;
    depthScene.add(p);
  }
  const depthTex = new THREE.DepthTexture(size, size, THREE.UnsignedIntType);
  const depthRT = new THREE.WebGLRenderTarget(size, size, { depthTexture: depthTex, depthBuffer: true });
  const cam = new THREE.OrthographicCamera(-R, R, R, -R, 0.01, 2 * R + 0.02);

  // ── 3. 정점마다 더할 타깃 (반정밀 부동소수 — 더하기 섞기가 확장 없이 된다) · 몫을 옮겨 담을 8비트 타깃
  const accRT = new THREE.WebGLRenderTarget(TW, TH, { type: THREE.HalfFloatType, depthBuffer: false,
    minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
  const outRT = new THREE.WebGLRenderTarget(TW, TH, { depthBuffer: false,
    minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
  const accMat = new THREE.ShaderMaterial({
    uniforms: { tPos: { value: tPos }, tNrm: { value: tNrm }, tDepth: { value: depthTex },
      uVP: { value: new THREE.Matrix4() }, uDir: { value: new THREE.Vector3() },
      uOff: { value: offTx * texel }, uBias: { value: (biasTx * texel) / (2 * R) } },
    vertexShader: QUAD_VERT, fragmentShader: ACC_FRAG,
    depthTest: false, depthWrite: false,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
    blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneFactor
  });
  const resMat = new THREE.ShaderMaterial({
    uniforms: { tAcc: { value: accRT.texture } },
    vertexShader: QUAD_VERT, fragmentShader: RESOLVE_FRAG, depthTest: false, depthWrite: false
  });
  const quadGeo = new THREE.PlaneGeometry(2, 2);
  const quad = new THREE.Mesh(quadGeo, accMat);
  quad.frustumCulled = false;
  const quadScene = new THREE.Scene();
  quadScene.add(quad);

  // ⚠ 렌더러 상태를 빌려 쓰고 돌려준다 — 타깃 · 지움 · 지움 색
  const prevRT = renderer.getRenderTarget(), prevAuto = renderer.autoClear;
  const prevCol = renderer.getClearColor(new THREE.Color()), prevA = renderer.getClearAlpha();
  const out = new Uint8Array(TW * TH * 4);
  try {
    renderer.autoClear = false;
    renderer.setClearColor(0x000000, 0);
    renderer.setRenderTarget(accRT);
    renderer.clear(true, false, false);
    const up = new THREE.Vector3();
    for (const d of sphereDirs(dirs)) {
      cam.position.copy(center).addScaledVector(d, R + 0.01);
      up.set(0, 1, 0);
      if (Math.abs(d.y) > 0.99) up.set(1, 0, 0);
      cam.up.copy(up);
      cam.lookAt(center);
      cam.updateMatrixWorld(true);
      renderer.setRenderTarget(depthRT);
      renderer.clear(true, true, false);
      renderer.render(depthScene, cam);
      accMat.uniforms.uVP.value.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
      accMat.uniforms.uDir.value.copy(d);
      quad.material = accMat;
      renderer.setRenderTarget(accRT);
      renderer.render(quadScene, cam);
    }
    quad.material = resMat;
    renderer.setRenderTarget(outRT);
    renderer.clear(true, false, false);
    renderer.render(quadScene, cam);
    renderer.readRenderTargetPixels(outRT, 0, 0, TW, TH, out);
  } finally {
    renderer.setRenderTarget(prevRT);
    renderer.autoClear = prevAuto;
    renderer.setClearColor(prevCol, prevA);
    [tPos, tNrm, depthTex, depthRT, accRT, outRT, depthMat, accMat, resMat, quadGeo].forEach(x => x.dispose());
  }

  // ── 4. 메시마다 제 몫을 잘라 속성으로 단다
  off = 0;
  for (const m of meshes) {
    const n = m.geometry.attributes.position.count;
    const a = new Uint8Array(n * 2);
    for (let i = 0; i < n; i++) { a[i * 2] = out[(off + i) * 4]; a[i * 2 + 1] = out[(off + i) * 4 + 1]; }
    m.geometry.setAttribute('aoFB', new THREE.BufferAttribute(a, 2, true));
    off += n;
  }
  return { ok: true, ms: performance.now() - t0, verts: N, dirs };
}

// 재질에 덧대는 GLSL — three 의 aomap_fragment 와 같은 세 줄 (간접 확산 · 클리어코트 · 환경 정반사)
const AO_FRAG = `
{
  float vao = mix(1.0, gl_FrontFacing ? vAoFB.x : vAoFB.y, uVaoK);
  reflectedLight.indirectDiffuse *= vao;
  #if defined( USE_CLEARCOAT )
    clearcoatSpecularIndirect *= vao;
  #endif
  #if defined( USE_SHEEN )
    sheenSpecularIndirect *= vao;
  #endif
  #if defined( USE_ENVMAP ) && defined( STANDARD )
    reflectedLight.indirectSpecular *= computeSpecularOcclusion( saturate( dot( geometryNormal, geometryViewDir ) ), vao, material.roughness );
  #endif
}
`;

/**
 * 재질이 구운 차폐를 읽게 한다. ⚠ 이 재질을 쓰는 **모든 지오메트리에 aoFB 가 있어야 한다** —
 * 없는 지오메트리에서는 속성이 0 으로 읽혀 하늘빛이 통째로 꺼진다 (까맣게 된다).
 * ⚠ MeshStandardMaterial · MeshPhysicalMaterial 만.
 */
export function ensureVertexAO(m) {
  if (!m || !(m.isMeshStandardMaterial || m.isMeshPhysicalMaterial)) return;
  chainShader(m, 'vao', (sh) => {
    sh.uniforms.uVaoK = VAO.uVaoK;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
attribute vec2 aoFB;
varying vec2 vAoFB;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vAoFB = aoFB;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec2 vAoFB;
uniform float uVaoK;`)
      .replace('#include <aomap_fragment>', `#include <aomap_fragment>
` + AO_FRAG);
  });
}
