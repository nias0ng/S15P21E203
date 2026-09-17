import * as THREE from 'three';
import { PARAMS as P } from './params.js';
import { CONFIG } from './config.js';
import { SKY_GLSL, SKY_UNIFORMS } from './sky.js';
import { timeNow, timeKey } from './times.js';

// 하늘 판의 바탕색 (stageAmount 가 1 아래일 때 하늘과 섞인다). 시간대가 켜져 있으면 그 표의 bg
const bgNow = () => { const T = timeNow(); return T ? T.bg : CONFIG.color.bg; };
let _tk = '';

// ───────── 무대 : 하늘 ─────────
// 2026-09-09 부터 이 바다에는 **수평선이 있다** (`docs/무대와-존-연출.md` §12).
// `camPitch` 를 23.1 → 15.4 로 내려 수평선을 화면 상단 15% 로 들였고, 그 위 15% 가
// 흰 여백으로 남았다. 이 파일이 그 자리를 채운다.
//
// ⚠⚠ **`README.md` 첫 줄의 선언을 뒤집는 층이다** — *"하늘도 지평선도 없고, 물은 배경색으로
//   흩어져 사라진다."* 그건 버그가 아니라 8개월치 아트 디렉션이었다. 되돌리는 값은 하나다 :
//   **`params.stageAmount = 0` 이면 메시를 안 그린다** (`bloom.js` 와 같은 패턴).
//
// ⚠⚠⚠ **하늘 색은 여기 없다.** 전부 `sky.js` 의 `SKY` 표에서 온다 —
//   그 파일이 `SKY_GLSL`(물이 반사에 쓰는 함수)과 `skyColorCPU`(환경맵을 굽는 함수)를
//   한 표에서 생성하고, 이 파일은 **그 GLSL 을 글자 그대로 그대로 가져다 쓴다.**
//   화면의 하늘과 물에 비친 하늘이 갈라질 방법이 없어야 한다 (`swell.js` 의 BANDS 와 같은 규율).
//
// ⚠⚠ **태양은 `water.js` 의 유니폼 객체를 그대로 공유한다** (복사하지 않는다).
//   2026-09-09 실측으로 태양이 **세 곳에서 갈라져 있는 것**을 찾았다 :
//     물 (uLightDir3, sunRot −84 반영)  [ 0.866,  0.249, −0.433]
//     환경맵 (CONFIG.sun, sunRot 모름)  [−0.340,  0.249, −0.907]   ← 물과 **80.8°**
//     조명 (dirLight.position)          [−0.634,  0.634,  0.444]   ← 물과 **125.7°**
//   `sunRot` 이 들어오면서(2026-09-07~08) 나머지 둘이 따라가지 않았다. 하늘까지 자기 태양을
//   들면 넷이 된다 — 그래서 **참조를 공유해** 물과는 구조적으로 같게 만든다.
//   ⚠ 환경맵·조명은 이 파일이 손대지 않는다 (배 밝기가 걸려 있다 — 불변식 0-4).
//     남은 불일치는 `docs/무대와-존-연출.md` §14 에 적어 뒀다.

// 반지름. ⚠ 카메라 far 가 400 이라 그 안에 있어야 한다. 매 프레임 카메라 위치로 옮기므로
//   "카메라에서 이만큼" 이 되고, 물 메시(반경 55)를 넉넉히 감싼다
const R = 300;

const VERT = `
varying vec3 vDir;
void main(){
  // ⚠ 로컬 좌표가 곧 방향이다 (구가 로컬 원점 중심). 월드로 바꾸지 않는다 —
  //   메시를 카메라 위치로 옮기기만 하고 **회전은 안 시키므로** 로컬 축이 곧 월드 축이다
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FRAG = SKY_GLSL + `
uniform vec3 uSunDir;
uniform vec3 uBg;
uniform float uAmount;
varying vec3 vDir;
void main(){
  vec3 sky = skyColor(normalize(vDir), uSunDir);
  // ⚠ uAmount 0 = 예전 배경색 그대로 (비트 단위 롤백). 1 = sky.js 의 하늘 그대로
  gl_FragColor = vec4(mix(uBg, sky, uAmount), 1.0);
  #include <colorspace_fragment>
}`;

// sunUniform : water.js 의 `uni.uLightDir3` 를 **그대로** 넘긴다 (복사본이 아니라 참조)
export function createStage(scene, sunUniform) {
  const uni = {
    // ⚠ water.js 와 **같은 value 객체**를 가져온다. 복사하면 하늘이 둘로 갈라진다
    ...SKY_UNIFORMS,
    uSunDir: sunUniform,
    uBg: { value: new THREE.Color(CONFIG.color.bg) },
    uAmount: { value: P.stageAmount === undefined ? 1 : P.stageAmount }
  };

  const geo = new THREE.SphereGeometry(R, 32, 16);
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: uni,
    side: THREE.BackSide,     // 안쪽에서 본다
    depthWrite: false,        // ⚠ 깊이를 안 남긴다 — 뒤에 그려질 물·배가 가려지면 안 된다
    fog: false
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = -1000;   // 무조건 맨 먼저
  mesh.frustumCulled = false; // 카메라가 항상 안에 있다. 컬링 계산이 무의미하다
  // ⚠ 레이어 0 만 둔다. 레이어 2(reflect.js)에 넣으면 **하늘이 두 번 반사된다** —
  //   물은 이미 `skyColor()` 를 직접 호출해 하늘을 반사하고 있다 (water.js:746)
  scene.add(mesh);

  return {
    mesh,
    uni,

    // ⚠ 카메라를 따라다닌다. 회전은 시키지 않는다 (VERT 주석 참고)
    update(cam) {
      const on = P.stageAmount > 0;
      mesh.visible = on;
      if (!on) return;
      uni.uAmount.value = P.stageAmount;
      mesh.position.copy(cam.position);
      // 시간대가 바뀌면 바탕색도 (콘솔에서 sceneTime 만 바꾸고 apply 를 안 불러도 따라온다)
      if (timeKey() !== _tk) { _tk = timeKey(); uni.uBg.value.set(bgNow()); }
    },

    // 색·세기 값이 바뀌었을 때 (PB.apply())
    apply() {
      _tk = timeKey();
      uni.uBg.value.set(bgNow());
      uni.uAmount.value = P.stageAmount;
    },

    dispose() {
      scene.remove(mesh);
      geo.dispose();
      mat.dispose();
    }
  };
}
