import * as THREE from 'three';
import { PARAMS as P } from './params.js';

// ───────── 부력 프로브 시각화 (개발 전용) ─────────
// main.js 가 import.meta.env.DEV 일 때만 붙인다. 프로덕션 번들에는 들어가지 않는다.
// 레퍼런스(threejswaterpro.com)의 "Buoyancy Probes" 토글과 같은 목적이다.
//
// **왜 이게 필요한가.** 이 프로젝트에서 배는 GPU 가 그리는 수면을 보지 않는다 —
// `swellCPU`(해석적 너울의 CPU 사본)와 `sim.sampler()`(높이맵 리드백)로 **따로 계산한** 수면을
// 본다. 둘이 갈라지면 배가 파도와 어긋난 자리에 뜨거나 잠기는데, 화면만 봐서는
// "좀 이상한데" 이상으로 판정할 수가 없다. 여기서 그 둘을 나란히 놓는다.
//
// 프로브 하나당 두 가지를 그린다.
//   · 가로 원반 — 배가 **읽었다고 믿는** 수면 높이. GPU 가 그린 파면과 어긋나 있으면
//     원반이 물에 뜨거나 잠긴 채로 보인다. 그게 CPU/GPU 가 갈라졌다는 신호다
//   · 세로 막대 — 그 수면에서 **선체 바닥까지의 간격**. 배가 파도를 얼마나 버티고 있는지가
//     이 막대들의 길이 차이로 드러난다 (전부 같은 길이면 파도에 그대로 누운 것이다)
//
// ⚠ 프로브 값은 boat.js 가 부력 계산 중에 이미 구해 둔 것을 그대로 읽는다. 여기서 다시
// 재면 `sim.sampler()` 의 동기 GPU 리드백을 한 번 더 하게 되어 프레임이 멈춘다.

const N = 5;                       // 중앙 + 팔 4개
const WATER = 0x2E7D9A;            // 수면을 읽은 자리 — 차가운 청록
const GAP_HIGH = 0x8A93A0;         // 선체 바닥이 수면 위 — 이 프로브는 물에 안 닿는다
const GAP_OK = 0x6B8E5A;           // 정상 흘수 (조금 잠겨 있다)
const GAP_DEEP = 0xC0553F;         // 너무 깊다. 선체 높이(0.58)의 절반을 넘겼다
const DEEP = 0.29;                 // 선체 높이의 절반

export function createProbes(scene, boat) {
  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);

  const discGeo = new THREE.CircleGeometry(0.16, 20);
  const barGeo = new THREE.CylinderGeometry(0.018, 0.018, 1, 6);
  const discs = [], bars = [];

  for (let i = 0; i < N; i++) {
    const d = new THREE.Mesh(discGeo, new THREE.MeshBasicMaterial({
      color: WATER, transparent: true, opacity: 0.55, depthTest: false
    }));
    d.rotation.x = -Math.PI / 2;
    d.renderOrder = 10;
    const b = new THREE.Mesh(barGeo, new THREE.MeshBasicMaterial({
      color: GAP_OK, transparent: true, opacity: 0.8, depthTest: false
    }));
    b.renderOrder = 11;
    group.add(d, b);
    discs.push(d); bars.push(b);
  }

  const up = new THREE.Vector3();

  return {
    group,

    update() {
      group.visible = !!P.showProbes;
      if (!group.visible) return;

      const pv = boat.pivot;
      // 선체 평면 : pivot 을 지나고 배의 up 벡터를 법선으로 하는 평면.
      // 수평으로 (dx, dz) 만큼 떨어진 곳의 선체 높이는 그 평면 위의 값이다
      up.set(0, 1, 0).applyQuaternion(pv.quaternion);
      const ny = Math.abs(up.y) < 1e-3 ? 1e-3 : up.y;

      for (let i = 0; i < N; i++) {
        const [dx, dz, wh] = boat.probes[i];
        const x = pv.position.x + dx, z = pv.position.z + dz;
        const hull = pv.position.y - (up.x * dx + up.z * dz) / ny;

        discs[i].position.set(x, wh, z);

        // 막대는 수면과 선체 사이를 잇는다. 길이가 0 에 가까우면 그 프로브는 수면에 닿아 있다
        const gap = hull - wh;
        const len = Math.max(0.001, Math.abs(gap));
        bars[i].position.set(x, wh + gap * 0.5, z);
        bars[i].scale.set(1, len, 1);
        // 배는 조금 잠겨 있는 것이 정상이다 (boatLift 가 음수). 그래서 '음수 = 경고' 가 아니라
        // '너무 깊다'만 경고한다. 수면 위로 뜬 프로브는 회색 — 그 자리는 물에 안 닿는다
        bars[i].material.color.setHex(gap > 0 ? GAP_HIGH : (gap < -DEEP ? GAP_DEEP : GAP_OK));
      }
    },

    dispose() {
      scene.remove(group);
      discGeo.dispose(); barGeo.dispose();
      discs.forEach(m => m.material.dispose());
      bars.forEach(m => m.material.dispose());
    }
  };
}
