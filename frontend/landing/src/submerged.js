import * as THREE from 'three';
import { PARAMS as P } from './params.js';

// ───────── 물에 잠긴 선체 (그림을 찍는 쪽) ─────────
//
// **반사와 근본적으로 다르다.** 반사는 "그 픽셀 뒤에 없는 것" 을 그리는 일이라 화면 좌표로
// 되읽으면 파도 높이와 무관한 도장이 된다 (CLAUDE.md '하지 않는 것'). 투과는 반대다 —
// 물 밑의 선체는 **실제로 그 픽셀 뒤에 있다.** 그래서 화면 좌표가 물리적으로 맞다.
//
// 본 카메라로 배를 한 번 더 찍되, **수면 아래만** 남긴다 (클리핑 평면을 수면 높이에 둔다).
// 물 셰이더가 그것을 화면 좌표로 읽고, 굴절 오프셋과 노이즈를 얹어 섞는다.
//
// ⚠ 노이즈는 '흔들어서 그럴듯하게' 가 아니라 **물리적 이유**가 있다 : 파면이 잘게 기울어
// 광선이 흩어지므로 물 밑의 상은 또렷하게 안 맺힌다. 그래서 오프셋을 파면 기울기로 준다.
//
// ⚠ 규모를 알고 시작한다. 실측으로 잠긴 부분은 선체 실루엣의 2~10%(중앙값 7%),
// 화면의 0.14% 다. 1280×720 에서 500~2,100 픽셀이다. 크게 보이길 원하면 배를 더 잠기게
// 해야 한다 (boat.js 의 boatLift).

const LAYER = 2;   // reflect.js 와 같은 레이어를 쓴다 (배에 이미 켜져 있다)

export function createSubmerged(renderer, scene, boat, lights) {
  const rt = new THREE.WebGLRenderTarget(1, 1, {
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat, depthBuffer: true, generateMipmaps: false
  });

  boat.pivot.traverse(o => o.layers.enable(LAYER));
  lights.forEach(l => l.layers.enable(LAYER));

  // ⚠⚠ three.js 의 클리핑은 **normal·p + constant > 0 인 쪽을 남긴다.**
  // 법선을 (0, 1, 0) 으로 두고 constant 에 −수면 을 넣으면 y > 수면, 즉 **물 위**가 남는다.
  // 그렇게 만들었다가 물 위의 배를 물에 그렸고, 사용자에게 "그림자처럼 옆에 붙어
  // 따라다닌다" 로 보였다. 아래를 남기려면 법선이 **(0, −1, 0)** 이고 constant 가 수면이다
  // (reflect.js 의 slicePlane 과 같은 규칙).
  const plane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
  // ⚠ 표준 재질 대신 전용 셰이더를 쓴다. **알파에 '얕음' 을 싣기 위해서다** —
  // 수면 근처는 1, 깊어질수록 uDeepFade 로 내려간다. 물 셰이더가 그 값으로
  // 깊을수록 옅게 · 더 흩어지게 그린다 (경계가 딱 잘리지 않고 그라데이션이 된다).
  // ⚠ 음영은 버린다. 어차피 조각으로 부서지고 화면의 0.1% 라, 음영보다 **깊이**가 정보다.
  // 색은 물 셰이더에서 uSubTint 로 입힌다
  const mat = new THREE.ShaderMaterial({
    uniforms: { uWaterY: { value: 0 }, uDepthK: { value: 4.0 }, uDeepFade: { value: 0.18 }, uFadeIn: { value: 0.05 } },
    vertexShader: `
varying float vWY;
void main(){
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWY = wp.y;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`,
    fragmentShader: `
uniform float uWaterY, uDepthK, uDeepFade, uFadeIn;
varying float vWY;
void main(){
  float d = uWaterY - vWY;                                   // 수면 아래 깊이 (월드)
  // ⚠ 수면선에서 딱 끊기면 '오려붙인 것' 으로 보인다. 위쪽으로도 서서히 들어오게 한다 —
  // 실제로도 수면 바로 밑은 표면 자체의 굴절에 묻혀 잘 안 보인다
  float inFade = smoothstep(0.0, uFadeIn, d);
  float dep = clamp(d * uDepthK, 0.0, 1.0);                  // 0 = 수면, 1 = 깊다
  gl_FragColor = vec4(1.0, 1.0, 1.0, inFade * mix(1.0, uDeepFade, dep));
}`,
    side: THREE.DoubleSide, clippingPlanes: [plane]
  });
  renderer.localClippingEnabled = true;

  const clear = new THREE.Color();
  const buf = new THREE.Vector2();

  const resize = () => {
    renderer.getDrawingBufferSize(buf);
    rt.setSize(Math.max(1, Math.round(buf.x * 0.5)), Math.max(1, Math.round(buf.y * 0.5)));
  };
  resize();

  return {
    texture: rt.texture,
    target: rt,          // 계측용

    // ⚠ 본 카메라를 그대로 쓴다. 거울 카메라가 아니다 — 투과이기 때문이다.
    // 배와 같은 게이트(8fps)로만 다시 찍는다
    update(cam, stepped) {
      if (!stepped || P.subAmount <= 0) return;
      // 배 밑 수면 높이. boat.js 가 부력 계산 중에 이미 구해 뒀다 (중앙 프로브)
      const wy = boat.probes[0][2] + P.subLift;
      plane.constant = wy;                       // y <= 수면 만 남는다
      mat.uniforms.uWaterY.value = wy;
      mat.uniforms.uDepthK.value = P.subDepthK;
      mat.uniforms.uDeepFade.value = P.subDeepFade;
      mat.uniforms.uFadeIn.value = P.subFadeIn;

      const prevTarget = renderer.getRenderTarget();
      renderer.getClearColor(clear);
      const prevAlpha = renderer.getClearAlpha();
      const prevBg = scene.background;
      scene.background = null;              // ⚠ 안 떼면 타깃이 배경색으로 꽉 찬다

      renderer.setRenderTarget(rt);
      renderer.setClearColor(0x000000, 0);  // 선체가 없는 곳은 알파 0
      renderer.clear(true, true, false);
      scene.overrideMaterial = mat;
      const prevLayers = cam.layers.mask;
      cam.layers.set(LAYER);
      renderer.render(scene, cam);
      cam.layers.mask = prevLayers;
      scene.overrideMaterial = null;

      renderer.setRenderTarget(prevTarget);
      renderer.setClearColor(clear, prevAlpha);
      scene.background = prevBg;
    },

    resize,

    dispose() {
      mat.dispose();
      rt.dispose();
      boat.pivot.traverse(o => o.layers.disable(LAYER));
    }
  };
}
