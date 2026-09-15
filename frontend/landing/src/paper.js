import * as THREE from 'three';

// ───────── 종이 질감 ─────────
// 사용자 요청 (2026-09-09) : *"mast, closed off 같은 철재 표현을 제외하고 나머지에
// 종이 질감표현을 넣고싶은데"*.
//
// ⚠⚠ **파일이 아니라 함수다.** `sky.js` 와 같은 규율이다 — 이 리포지토리에는 텍스처가
//   한 장도 없고(거품도 worley, 하늘도 함수), 종이만 예외로 두지 않는다.
//   512² 두 장을 **한 번만** 굽는다 (약 50ms). 번들이 0바이트 늘어난다.
//
// ⚠⚠ **시드가 고정이다.** `Math.random()` 을 쓰지 않는다 — 새로고침할 때마다 결이 달라지면
//   A/B 를 할 수 없다 (`marks.js` 의 '난수로 고르지 않는다' 와 같은 이유).
//
// 종이의 결은 세 겹이다. 하나만 쓰면 노이즈로 읽히고, 셋을 겹쳐야 종이가 된다 :
//   ① 섬유  — 고주파. 손끝에 걸리는 거칢
//   ② 뭉침  — 중주파. 뜬 자리마다 두께가 다르다
//   ③ 결    — 저주파에 **약한 방향성**. 종이는 뜰 때 섬유가 한 방향으로 눕는다

// 정수 격자 해시 → [0,1). ⚠ 시드를 섞어 옥타브마다 다른 격자를 쓴다
function hash2(x, y, seed) {
  let h = x * 374761393 + y * 668265263 + seed * 1442695040888963407;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967296;
}

// 값 노이즈 (bilinear + smoothstep). ⚠ 타일이 이어지도록 격자를 size 로 감는다
function valueNoise(x, y, freq, seed, size) {
  const g = Math.max(1, Math.round(freq));
  const fx = x * g / size, fy = y * g / size;
  const x0 = Math.floor(fx), y0 = Math.floor(fy);
  const tx = fx - x0, ty = fy - y0;
  const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
  const w = (ix, iy) => hash2(((ix % g) + g) % g, ((iy % g) + g) % g, seed);
  const a = w(x0, y0), b = w(x0 + 1, y0), c = w(x0, y0 + 1), d = w(x0 + 1, y0 + 1);
  return (a + (b - a) * sx) + ((c + (d - c) * sx) - (a + (b - a) * sx)) * sy;
}

// ⚠ 두 장을 **같은 높이맵**에서 만든다. 따로 만들면 요철과 광택이 어긋나 젖은 돌처럼 보인다
function heightField(size) {
  const h = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // ① 섬유 : 가장 높은 주파수. 진폭이 제일 크다 — 종이는 결보다 섬유가 먼저 읽힌다
      let v = valueNoise(x, y, 256, 11, size) * 0.55;
      // ② 뭉침
      v += valueNoise(x, y, 64, 23, size) * 0.28;
      // ③ 결 : x 를 눌러 **가로로 늘인 격자**를 쓴다. 그게 방향성이다
      v += valueNoise(x * 0.25, y, 32, 37, size) * 0.17;
      h[y * size + x] = v;
    }
  }
  return h;
}

// ⚠ 높이맵 → 접선공간 노멀 (중앙차분). z 는 세기 손잡이가 아니라 **기울기 스케일**이다 —
//   세기는 재질의 `normalScale`(= params.boatNormal)이 쥔다. 여기서 두 번 곱하지 않는다
function bakeNormal(h, size) {
  const data = new Uint8Array(size * size * 4);
  const at = (x, y) => h[(((y % size) + size) % size) * size + (((x % size) + size) % size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * 0.5;
      const dy = (at(x, y + 1) - at(x, y - 1)) * 0.5;
      // 기울기 → 노멀. 상수 6.0 은 종이의 요철이 '보이되 도드라지지 않는' 자리다
      let nx = -dx * 6.0, ny = -dy * 6.0, nz = 1.0;
      const l = Math.hypot(nx, ny, nz);
      nx /= l; ny /= l; nz /= l;
      const i = (y * size + x) * 4;
      data[i]     = Math.round((nx * 0.5 + 0.5) * 255);
      data[i + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      data[i + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      data[i + 3] = 255;
    }
  }
  return data;
}

// ⚠ 러프니스는 **높은 곳이 매끄럽다** (누른 자리가 반질해지는 종이의 성질). 폭은 좁게 —
//   넓게 흔들면 젖은 자국처럼 보인다
function bakeRough(h, size) {
  const data = new Uint8Array(size * size * 4);
  for (let i = 0, n = size * size; i < n; i++) {
    const v = Math.max(0, Math.min(1, 0.5 + (h[i] - 0.5) * -0.55));
    const b = Math.round(v * 255);
    data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = b;
    data[i * 4 + 3] = 255;
  }
  return data;
}

let _cache = null;

// ⚠ 한 번만 굽고 캐시한다. 모든 재질이 **같은 텍스처 객체**를 공유하므로 VRAM 은 두 장뿐이다
//   (재질마다 구우면 26장이 된다). 반복 횟수만 재질별로 다르게 줄 수는 없지만,
//   지금은 배 전체가 한 결이어야 맞다 — 한 장의 종이로 접은 배다
export function paperMaps(size = 512) {
  if (_cache) return _cache;
  const h = heightField(size);

  const nrm = new THREE.DataTexture(bakeNormal(h, size), size, size, THREE.RGBAFormat);
  nrm.wrapS = nrm.wrapT = THREE.RepeatWrapping;
  nrm.minFilter = THREE.LinearMipmapLinearFilter;
  nrm.magFilter = THREE.LinearFilter;
  nrm.generateMipmaps = true;
  nrm.needsUpdate = true;
  // ⚠ 노멀맵은 **선형**이다. sRGB 로 표시하면 요철이 한쪽으로 치우친다

  const rgh = new THREE.DataTexture(bakeRough(h, size), size, size, THREE.RGBAFormat);
  rgh.wrapS = rgh.wrapT = THREE.RepeatWrapping;
  rgh.minFilter = THREE.LinearMipmapLinearFilter;
  rgh.magFilter = THREE.LinearFilter;
  rgh.generateMipmaps = true;
  rgh.needsUpdate = true;

  _cache = { normalMap: nrm, roughnessMap: rgh };
  return _cache;
}

export function disposePaper() {
  if (!_cache) return;
  _cache.normalMap.dispose();
  _cache.roughnessMap.dispose();
  _cache = null;
}

// ⚠⚠ **재질마다 다른 결을 주되 텍스처는 늘리지 않는다.**
//   `Texture.clone()` 은 `source`(GPU 에 올라간 이미지)를 **공유**하고 repeat·rotation·offset
//   같은 변환만 독립으로 갖는다 — 재질 26개가 각자 clone 을 들어도 **VRAM 은 두 장 그대로**다.
//   (텍스처를 재질 수만큼 구우면 26장이 된다. 그건 안 한다.)
//
// ⚠ 난수는 **이름 해시**다. `Math.random()` 이 아니다 —
//   같은 재질은 언제나 같은 결이어야 A/B 가 되고, 새로고침해도 화면이 안 흔들린다.
function nameSeed(name) {
  let h = 2166136261;
  const s = String(name || '');
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
const rnd = (seed, k) => {
  let h = Math.imul(seed ^ (k * 2654435761), 2246822519);
  h = (h ^ (h >>> 13)) >>> 0;
  return h / 4294967296;
};

// 재질 하나가 쓸 변환을 만든다. vary 0 이면 **전부 같은 결**(예전 동작), 1 이면 최대로 흩어진다.
//   ⚠ 노멀과 러프니스는 **같은 변환**을 써야 한다 — 어긋나면 요철과 광택이 따로 놀아
//     '젖은 돌' 로 보인다 (두 장을 같은 높이맵에서 만든 이유와 같은 규율).
export function paperVariant(name, scale, vary) {
  const base = paperMaps();
  const s = nameSeed(name);
  const v = Math.max(0, vary);
  // ⚠ 배율은 **곱셈으로** 흩는다 (덧셈이면 큰 스케일에서만 티가 난다).
  //   0.55~1.8 배 — 이보다 넓히면 어떤 면은 결이 안 보이고 어떤 면은 사포가 된다
  const kx = 1 + (rnd(s, 1) * 1.25 - 0.45) * v;
  const ky = 1 + (rnd(s, 2) * 1.25 - 0.45) * v;
  const out = {};
  for (const key of ['normalMap', 'roughnessMap']) {
    const t = base[key].clone();
    t.needsUpdate = true;                 // ⚠ clone 은 이걸 안 켜 주면 업로드가 안 된다
    t.center.set(0.5, 0.5);               // ⚠ rotation 은 center 를 안 잡으면 모서리를 축으로 돈다
    t.rotation = rnd(s, 3) * Math.PI;     // 결의 방향. 종이는 뜰 때마다 결이 다르다
    t.repeat.set(scale * kx, scale * ky);
    t.offset.set(rnd(s, 4), rnd(s, 5));   // 이음매 자리를 흩는다
    out[key] = t;
  }
  // ⚠ 배율을 같이 돌려준다 — 호출한 쪽이 **텍스처를 다시 만들지 않고** repeat 만 갱신할 수 있다.
  //   paperScale 슬라이더를 드래그할 때마다 clone 을 새로 만들면 그게 곧 누수다
  out.kx = kx; out.ky = ky;
  return out;
}

// scale 만 바꾼다 (clone 재사용). ⚠ 노멀·러프니스에 **같은 값**을 준다
export function paperRescale(v, scale) {
  v.normalMap.repeat.set(scale * v.kx, scale * v.ky);
  v.roughnessMap.repeat.set(scale * v.kx, scale * v.ky);
}
