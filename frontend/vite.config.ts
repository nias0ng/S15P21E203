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
      },
    },
    server: {
      port: 5173,
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
      include: ['src/**/*.test.{ts,tsx}', 'mock/**/*.test.ts'],
    },
  }
})
