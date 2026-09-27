import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

import { mockApiPlugin } from './mock/plugin.ts'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')

  return {
    plugins: [
      // landing/ 는 React 가 아닌 3D 엔진(순수 JS)이라 React Refresh 변환에서 뺍니다.
      // exclude 를 주면 기본값(node_modules)이 사라지므로 같이 적습니다
      react({ exclude: [/\/node_modules\//, /\/landing\//] }),
      tailwindcss(),
      // `npm run dev:mock` — 백엔드 없이 목데이터로 (mock/plugin.ts)
      mode === 'mock' && mockApiPlugin(env.VITE_API_BASE_URL),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        /*
         * 3D 엔진이 들고 있는 **생성 데이터**를 앱에서도 읽습니다 (지도 향수 200개).
         *
         * 엔진은 iframe 이라 앱과 메모리를 나눠 쓰지 않습니다. 메인의 일반 검색이
         * "지도에 있는 향수" 를 찾으려면 같은 목록이 앱 쪽에도 있어야 하는데,
         * 200줄을 복사해 두면 CSV 가 갱신될 때 한쪽만 낡습니다.
         *
         * ⚠️ 엔진 코드(`landing/src/*.js`)를 앱이 import 하는 **유일한 자리**입니다.
         * 순수 데이터라 엔진의 three.js · DOM 에 딸려오는 것이 없습니다. 동작 코드는
         * 이 길로 가져오지 마세요 — 엔진은 iframe 안에서만 돕니다.
         */
        '@landing': fileURLToPath(new URL('./landing/src', import.meta.url)),
      },
    },
    server: {
      /*
       * 기본은 5173 그대로입니다. `PORT` 를 주면 그 포트로 뜹니다 — 워크트리를 여러 개
       * 두고 같은 저장소를 동시에 띄울 때 5173 하나를 두고 다투지 않게 하려는 것입니다.
       * (`PORT=5180 npm run dev`)
       */
      port: Number(process.env.PORT) || 5173,
      // 로컬 개발 시 /api 요청을 백엔드(Spring Boot)로 프록시합니다.
      // 프록시를 쓰면 브라우저 기준 same-origin 이라 CORS 설정 없이 개발할 수 있습니다.
      proxy: {
        '/api': {
          target: env.VITE_API_PROXY_TARGET || 'http://localhost:8080',
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: mode !== 'production',
      rolldownOptions: {
        // 두 번째 입구 — 메인(/)이 iframe 으로 띄우는 3D 향 지도 엔진 (landing/ · ScentScene)
        input: {
          main: fileURLToPath(new URL('./index.html', import.meta.url)),
          landing: fileURLToPath(
            new URL('./landing/index.html', import.meta.url),
          ),
        },
      },
    },

    test: {
      // 브라우저 API(document 등)를 쓰는 컴포넌트 테스트용 가상 DOM
      environment: 'jsdom',
      // 매 테스트 파일마다 실행되는 준비 코드 (DOM 정리, jest-dom matcher 등록)
      setupFiles: ['./src/test/setup.ts'],
      // describe/it/expect 를 전역으로 뿌리지 않습니다.
      // 'vitest' 에서 명시적으로 import 하면 어디서 온 함수인지 보이고 타입도 정확합니다.
      globals: false,
      css: true,
      // landing: 3D 엔진의 생성물 검사 — 커밋된 배 GLB 가 원본과 짝이 맞는지 (landing/scripts/pack-boat.test.js)
      include: [
        'src/**/*.test.{ts,tsx}',
        'mock/**/*.test.ts',
        'landing/**/*.test.js',
      ],
    },
  }
})
