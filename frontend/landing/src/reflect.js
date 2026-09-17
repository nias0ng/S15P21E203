import * as THREE from 'three';
import { CONFIG } from './config.js';
import { PARAMS as P } from './params.js';

// ───────── 수면에 비치는 배 (그림을 찍는 쪽) ─────────
// 수면(y = 0)을 거울로 삼아 카메라를 뒤집고, **레이어로 배만** 절반 해상도 타깃에 찍는다.
// 씬 전체를 다시 그리지 않으므로 `Reflector` 와는 비용이 다르다 (종이배는 삼각형 수십 개).
//
// ⚠⚠ **되읽는 좌표는 화면 좌표이되, x 를 뒤집어야 한다** (2026-09-07 재정정).
//
// ⚠⚠⚠ **이 카메라가 만드는 상은 좌우가 뒤집혀 있다.** 아래 up=(0,−1,0) + lookAt 때문이다.
//   three 는 lookAt 을 항상 **우수 직교기저**(det +1)로 만드는데, 참 거울은 det −1 이다.
//   그 차이가 정확히 **x 축 부호 하나**로 나온다 :
//     본 카메라 x = (0.6143, 0, 0.7891)  ·  거울 카메라 x = (−0.6143, 0, −0.7891)
//     y·z 축은 완전히 일치한다 — 그래서 손 방향이 지켜지고 컬링이 안 깨진다 (그게 목적이었다).
//   ⚠ 그러므로 `water.js` 는 `ruv.x = 1.0 − ruv.x` 로 되돌린 뒤 샘플해야 한다. 이 파일의
//     소비자를 새로 만든다면 **그 한 줄을 반드시 같이 가져가라** — 아래 `flipX` 로 선언해 뒀다.
//   ⚠ 이건 임시방편이 아니라 **정확한 역연산**이다 (프러스텀이 대칭이고 setViewOffset·
//     filmOffset·zoom 을 아무도 안 쓴다). 카메라를 어디로 옮겨도 성립한다.
//   ⚠ three 의 Reflector 도 같은 기저를 만든다. 거기서 뒤집기가 없는 이유는 기저가 달라서가
//     아니라, textureMatrix 가 **같은 가상 카메라의** 투영으로 조회 좌표를 만들어 상쇄되기
//     때문이다. 우리는 화면 좌표로 읽으므로 상쇄될 것이 없다.
//
// (아래는 2026-09-06 에 적은 것 — 화면 좌표로 읽는다는 것 자체는 맞다)
// 여기 오랫동안 "화면 좌표로 되읽으면 안 된다. water.js 가 viewProjection 으로 광선을
// 투영한다" 고 적혀 있었는데, **코드는 그렇게 하고 있지 않았다** — water.js 는
// `vProj = gl_Position`(본 카메라 클립 좌표)로 샘플하고, 이 모듈이 매 프레임 계산해 넘기던
// `viewProjection` · `planeN` 은 **셰이더가 한 번도 읽지 않았다.** 죽은 코드였다.
// 그리고 **화면 좌표가 원래 맞는 방법이다** : 거울 카메라는 본 카메라와 fov·aspect 가 같고
// 수면에 대해 대칭이므로, 평면 거울에서는 **같은 화면 픽셀**이 곧 그 점의 반사다.
// 파도에 의한 왜곡은 water.js 가 법선 기울기로 그 좌표를 미는 것(uReflPush)으로 준다.
// ⚠ 문서와 코드가 갈라지면 문서 쪽을 고친다 — 여기서는 코드가 옳았다.
//
// ⚠ `scene.background` 를 떼지 않으면 타깃이 배경색으로 알파 1 이 되어 꽉 찬다.
// 그러면 수면 전체가 반사색으로 덮인다 (실측 : 화면의 56.5%).

const LAYER = 2;   // 반사에 찍힐 것만 켜 두는 레이어. 기본 레이어 0 은 건드리지 않는다

export function createReflect(renderer, scene, boat, lights) {
  const rt = new THREE.WebGLRenderTarget(1, 1, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
    // ⚠⚠⚠ **HDR 이어야 한다** (2026-09-09, 사용자 : *"markGlow 올렸을 땐 왜 빛이 뿌옇게 밝게
    //   빛나는 표현이 반사값에는 같이 적용이안됨?"*).
    //   `type` 을 안 주면 기본이 `UnsignedByteType` = 8비트라 **1.0 에서 잘린다.** 부표 본체는
    //   HalfFloat 컴포저(bloom.js)를 타서 휘도 1.95 가 그대로 남는데, 반사는 이 타깃을 거치며
    //   1.0 으로 깎여 물색과 섞이니 블룸 문턱(1.40) 근처도 못 갔다.
    //   ⚠ 실측 (타깃 픽셀 직접 읽기, markGlow 를 올리며) :
    //       1.0 → 포화 22,130px · 1.5 → 23,318 · 3.0 → 24,994 · **6.0 → 24,994 · 12.0 → 24,994**
    //     3.0 이상은 **12배를 올려도 한 톨도 안 변했다.** 값이 전달 자체가 안 된 것이다.
    //   ⚠ 대가 : 타깃 메모리가 2배다 (1440×784 기준 4.5MB → 9MB). 대역폭도 2배.
    type: THREE.HalfFloatType,
    depthBuffer: true,
    generateMipmaps: false
  });

  const cam = new THREE.PerspectiveCamera();
  cam.layers.set(LAYER);
  lights.forEach(l => l.layers.enable(LAYER));   // ⚠ 광원도 레이어 검사를 받는다. 빼면 배가 새까맣다

  // 이 패스에 참여시킬 것을 등록한다. ⚠ **물과 그리드는 넣지 않는다** — 넣으면 거울이
  //   거울을 비춘다. 등록은 레이어 비트라 런타임 비용이 0 이고, 카메라가 레이어로 거른다
  const members = [];
  const add = (obj) => {
    if (!obj || members.indexOf(obj) >= 0) return;
    members.push(obj);
    // ⚠ `userData.noReflect` 는 건너뛴다 (2026-09-11 오후) — 부표의 **발광 쌍둥이**(bloom.js 의 레이어 3)가
    //   marks.group 안에 있어서, 안 거르면 반사 패스에 순색 구로 찍혀 물에 원판이 뜬다
    obj.traverse(o => { if (!o.userData.noReflect) o.layers.enable(LAYER); });
  };
  add(boat.pivot);

  // ⚠ 이 빛이 '반사'와 '그림자'를 가른다.
  // 거울 카메라는 배의 **밑면**을 찍는데 그 면은 씬 광원(위쪽)을 등지고 있어 어둡다
  // (실측 : 렌더타깃 평균 195, 주변 물 237). 어두운 덩어리는 종이 위에서 그림자로 읽힌다.
  // 물에 비친 배는 배의 종이 톤을 지녀야 반사로 읽히므로, **반사 렌더에만** 아래에서
  // 채우는 빛을 하나 둔다. 레이어 2 에만 켜 두므로 본 렌더의 배는 전혀 건드리지 않는다
  const fill = new THREE.DirectionalLight(0xffffff, 1.0);
  fill.position.set(2.0, -4.0, 3.0);
  fill.layers.set(LAYER);
  scene.add(fill);

  // ⚠ 물체 전체가 비치지 않는다. 스치는 각도에서 물에 남는 것은 **아랫도리뿐**이고,
  // 높은 부분의 상은 훨씬 멀리 맺혀 파면에 흩어져 사라진다. 그래서 일정 높이 위를 잘라낸다.
  //
  // ⚠⚠ **overrideMaterial 을 걷어냈다** (2026-09-06). 예전에는 클리핑 평면을 전용 흰 재질에
  //   박아 씌웠는데, 그러면 **씬의 모든 것이 같은 흰색**이 된다. 배 하나일 때는 배가 흰색이라
  //   티가 안 났지만, 부표·향 영역처럼 색이 있는 것이 들어오면 전부 색을 잃는다.
  //
  // ⚠⚠ **그럼 왜 예전에 renderer.clippingPlanes 를 안 썼나** — 파일에 이유가 적혀 있었다 :
  //   *"프레임마다 켰다 껐다 하면 클리핑 **개수가 셰이더 define** 이라 프로그램을 다시
  //   컴파일한다."* 맞는 경고다. 해법은 끄지 않는 것이다 :
  //   **개수를 1로 영구 고정**해 두고 **평면의 상수만** 움직인다. 개수가 안 변하면 define 이
  //   안 변하고, 따라서 재컴파일도 없다. 본 패스에서는 상수를 하늘까지 밀어 무효화한다.
  // ⚠ 대가는 모든 재질이 프래그먼트당 평면 검사 하나(내적 하나)를 상시로 내는 것이다.
  const NO_CLIP = 1e6;                                   // 이 값이면 아무것도 안 잘린다
  const slicePlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), NO_CLIP);
  renderer.clippingPlanes = [slicePlane];                // ⚠ 개수 1로 **영구 고정**

  // ⚠ 예전에는 `CONFIG.cam.look` 을 **고정으로** 봤다. 본 카메라가 늘 그 점을 보고 있었기에
  // 맞았을 뿐이고, 카메라를 옮기는 순간(자유 시점·Top View·도착 샷) 거울 카메라만 엉뚱한
  // 데를 봐서 배 반사가 어긋난다. 이제 **본 카메라의 실제 시선**에서 목표를 만든다.
  // 거리 L 은 아무 값이나 된다 — 거울 방향이 L 에 무관하다 (L·(dx, −dy, dz))
  const look = new THREE.Vector3();
  const fwd = new THREE.Vector3();
  const clear = new THREE.Color();
  const buf = new THREE.Vector2();

  const resize = () => {
    renderer.getDrawingBufferSize(buf);
    rt.setSize(Math.max(1, Math.round(buf.x * 0.5)), Math.max(1, Math.round(buf.y * 0.5)));
  };
  resize();

  return {
    texture: rt.texture,
    target: rt,                 // 계측용
    add,                        // 이 패스에 참여시킬 오브젝트를 등록한다
    // ⚠⚠ **이 타깃은 좌우가 뒤집혀 있다.** 소비자는 조회 전에 u 를 뒤집어야 한다
    //   (water.js 가 `ruv.x = 1.0 - ruv.x` 로 그렇게 한다). 파일 첫머리 주석 참고.
    //   생산자가 사실을 **선언**해 두는 것이 새 소비자가 빠뜨리지 않는 유일한 방법이다.
    flipX: true,
    members,

    // 배와 같은 게이트(8fps)로만 다시 찍는다. 반사만 60fps 로 매끄러우면
    // 배는 끊기는데 그림자만 부드러운 부조화가 생긴다
    update(mainCam, boatPos, stepped) {
      if (!stepped) return;
      // ⚠ boatReflect = 0 이면 렌더타깃 패스 자체가 안 돈다 (비트 단위 롤백).
      // ⚠ 2026-09-07 : 여기 오랫동안 "기본으로 꺼져 있다 (boatReflect = 0)" 고 적혀 있었는데
      //   **거짓이었다** — params.js 는 1.30 이고 패스는 돌고 있다. 같은 파일에 거짓 진술이
      //   둘 있었다 (다른 하나는 위의 '같은 화면 픽셀이 곧 반사다').
      if (P.boatReflect <= 0) return;
      // ⚠⚠ **직교 카메라면 빠진다** (2026-09-07). 항공뷰(topView)의 topCam 은
      //   OrthographicCamera 라 `fov` 가 **undefined** 다. 그걸 아래에서 복사하면
      //   투영 행렬이 NaN 이 되고, 실측으로 항공뷰에서 반사 타깃에 찍힌 픽셀이 **0개**였다.
      //   ⚠ 항공뷰는 방향을 재는 개발용 시점이라 반사가 필요 없다. 조용히 빠지는 것이 맞다 —
      //     타깃은 알파 0 인 채로 남으므로 물은 그냥 반사 없이 그려진다.
      if (!mainCam.isPerspectiveCamera) return;

      // 수면(y = 0)을 거울로 : 눈과 보는 점의 y 를 뒤집는다.
      // up 을 (0,-1,0) 에서 시작해 lookAt 하는 이유는 좌우 손 방향을 지키기 위해서다 —
      // 행렬을 직접 뒤집으면 삼각형 감김이 반대가 되어 배가 컬링된다
      cam.fov = mainCam.fov;
      cam.aspect = mainCam.aspect;
      cam.near = mainCam.near;
      cam.far = mainCam.far;
      cam.position.set(mainCam.position.x, -mainCam.position.y, mainCam.position.z);
      cam.up.set(0, -1, 0);
      mainCam.getWorldDirection(fwd);
      look.copy(mainCam.position).addScaledVector(fwd, 10);
      cam.lookAt(look.x, -look.y, look.z);
      cam.updateProjectionMatrix();
      cam.updateMatrixWorld(true);
      fill.intensity = P.reflectFill;
      // ⚠⚠ **수면 기준이다** (2026-09-06). 예전에는 boatPos.y + slice 라 **배가 파도에 오르내리면
      //   모든 물체의 절단면이 같이 움직였다.** 배 하나일 때만 말이 되는 식이었다.
      //   거울면이 y = 0 이므로 자르는 높이도 거기서 잰다
      slicePlane.constant = P.reflectSlice;


      const prevTarget = renderer.getRenderTarget();
      renderer.getClearColor(clear);
      const prevAlpha = renderer.getClearAlpha();
      const prevBg = scene.background;
      scene.background = null;

      renderer.setRenderTarget(rt);
      renderer.setClearColor(0x000000, 0);       // 배가 없는 곳은 알파 0 — 수면이 그대로 보인다
      renderer.clear(true, true, false);
      renderer.render(scene, cam);          // ⚠ 각자의 재질 그대로 (색이 산다)

      renderer.setRenderTarget(prevTarget);
      renderer.setClearColor(clear, prevAlpha);
      scene.background = prevBg;
      slicePlane.constant = NO_CLIP;        // ⚠ 본 패스는 안 잘린다. 개수는 그대로 1이다
    },

    resize,

    dispose() {
      scene.remove(fill);
      rt.dispose();
      renderer.clippingPlanes = [];
      members.forEach(m => m.traverse(o => o.layers.disable(LAYER)));
      lights.forEach(l => l.layers.disable(LAYER));
    }
  };
}
