import { CONFIG } from './config.js';
import { PARAMS as P } from './params.js';

// ───────── 시간대 표 (2026-09-11 밤 — 시안) ─────────
// `params.sceneTime` — 0 낮(종이, 지금 화면) · 1 저녁 · 2 밤. 값은 전부 `CONFIG.times` 한 표에 있다.
//
// ⚠⚠ 시간대를 읽는 곳은 **전부 여기서 받는다** — sky.js(하늘) · water.js(물 팔레트 · 반짝임 색 · 원경색) ·
//   stage.js(하늘 판의 바탕) · main.js(조명 · 배경 · <html data-time>) · title.js(글자색) · gate.js(암석 색조).
//   표를 모듈마다 따로 읽으면 한 층만 낮에 남는다 — 흰 글자가 흰 하늘에 뜨거나, 낮의 암석이 밤바다에 선다.
// ⚠ **낮은 null 이다.** 소비자는 null 이면 원래 값을 쓴다 — 그래서 sceneTime 0 은 비트 단위로 예전 화면이다.

export function timeNow() {
  const i = Math.round(P.sceneTime || 0);
  if (i <= 0) return null;
  const T = CONFIG.times && CONFIG.times[i];
  return T && T.sky ? T : null;   // 표에 없는 번호는 낮으로 떨어진다
}

// 값이 바뀌었는지 가릴 열쇠 (하늘 환경맵 · 물 팔레트가 바뀔 때만 다시 굽는다)
export const timeKey = () => String(Math.round(P.sceneTime || 0));
