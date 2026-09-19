/**
 * 3D 엔진의 잠수 값 중 **앱과 같아야 하는 것**의 타입 선언.
 *
 * 실체는 `landing/src/params.js` 입니다. 엔진은 순수 JS 라 타입이 없어서, 앱이 읽는 것만
 * 여기에 적습니다 — `features/map/engine-perfumes.d.ts` 와 같은 자리, 같은 규율입니다.
 * 경로 별칭 `@landing` 은 `vite.config.ts` 의 `resolve.alias` 에 있습니다.
 *
 * ⚠️ **앱이 쓰는 것은 `diveDeep` 하나뿐입니다.** PARAMS 에는 값이 수백 개 더 있지만 앱이
 *    안 쓰므로 선언하지 않습니다. 앱이 이것을 읽는 자리도 `diveTrack.test.ts` 한 곳입니다 —
 *    화면에 쓰려고가 아니라, 엔진과 앱의 색이 갈라지지 않았는지 **검사하려고** 읽습니다.
 * ⚠️ tsconfig 의 `include` 는 `src` 뿐이라 엔진 파일 자체는 타입 검사 대상이 아닙니다.
 *    이 선언과 실제 값이 어긋나도 컴파일러는 모릅니다.
 */
declare module '@landing/params' {
  export const PARAMS: {
    /**
     * 잠수 끝에서 물이 도달하는 색 (`#RRGGBB`).
     * ⚠️ 앱의 `--color-navy` 와 **같은 값**이어야 합니다 — 갈라지면 화면이 다 덮인 그 프레임에
     *    색이 한 번 튑니다. `diveTrack.test.ts` 가 이 둘을 견줍니다.
     */
    diveDeep: string
  }
}
