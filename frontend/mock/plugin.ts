/**
 * `npm run dev:mock` — 백엔드(Docker) 없이 목데이터로 개발 서버를 띄웁니다.
 *
 * `/api/v1` 요청 가운데 목데이터가 아는 경로(`api.ts`)만 여기서 답하고, 나머지는 원래대로
 * 백엔드 프록시로 넘깁니다. 개발 서버에만 붙고(`apply: 'serve'`) 빌드에는 들어가지 않습니다.
 *
 * 병 사진은 `src/assets/bottles/`(로컬 전용 · gitignore)에 여백을 잘라 둔 종이 질감 사진이
 * 있으면 그것을, 없으면 서버의 종이 질감 주소를 줍니다. 서버 사진은 여백을 안 잘라 병이 작게 섭니다.
 */

import { Buffer } from 'node:buffer'
import { existsSync, readdirSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import path from 'node:path'
import type { Plugin } from 'vite'

import {
  createMockApi,
  paperTextureImageUrl,
  type MockResponse,
} from './api.ts'

const BOTTLES_DIR = 'src/assets/bottles'

/** 로컬 사진 — 파일 이름 앞 번호(한국 선정 순위) → 개발 서버가 내주는 주소 */
function readLocalBottles(root: string): Map<number, string> {
  const bottles = new Map<number, string>()
  const dir = path.join(root, BOTTLES_DIR)
  if (!existsSync(dir)) return bottles

  for (const file of readdirSync(dir)) {
    const match = /^(\d+)_.+\.(png|webp)$/i.exec(file)
    if (match !== null) {
      bottles.set(
        Number(match[1]),
        `/${BOTTLES_DIR}/${encodeURIComponent(file)}`,
      )
    }
  }
  return bottles
}

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    request.on('data', (chunk: Buffer) => chunks.push(chunk))
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    request.on('error', reject)
  })
}

function send(response: ServerResponse, result: MockResponse): void {
  response.statusCode = result.status
  if (result.body === undefined) {
    response.end()
    return
  }
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.end(JSON.stringify(result.body))
}

/** @param basePath 앱의 `VITE_API_BASE_URL` (`/api/v1`) */
export function mockApiPlugin(basePath = '/api/v1'): Plugin {
  return {
    name: 'hyanghae-mock-api',
    apply: 'serve',

    configureServer(server) {
      const bottles = readLocalBottles(server.config.root)
      const api = createMockApi({
        shelfImageUrl: (perfume) =>
          bottles.get(perfume.rank) ?? paperTextureImageUrl(perfume.perfumeId),
      })

      server.config.logger.info(
        `\n  목데이터 모드 — ${basePath} 의 로그인 · 진열대 · 컬렉션 · 향해 일지 · 향수 검색을 대신 답합니다` +
          ` (병 사진: ${bottles.size > 0 ? `로컬 ${bottles.size}장` : '서버 종이 질감'})`,
      )

      // configureServer 에서 바로 붙인 미들웨어는 Vite 내부 미들웨어(프록시 포함)보다 먼저 돕니다
      server.middlewares.use((request, response, next) => {
        const url = new URL(request.url ?? '/', 'http://localhost')
        if (!url.pathname.startsWith(`${basePath}/`)) return next()

        const route = api.find(
          request.method ?? 'GET',
          url.pathname.slice(basePath.length),
        )
        // 목데이터에 없는 경로 — 본문을 읽기 전에 넘겨야 프록시가 본문을 그대로 보냅니다
        if (route === null) return next()

        readBody(request).then((raw) => {
          let body: unknown
          if (raw.trim() !== '') {
            try {
              body = JSON.parse(raw)
            } catch {
              send(response, {
                status: 400,
                body: {
                  code: 'INVALID_REQUEST',
                  message: '본문이 JSON 이 아닙니다.',
                },
              })
              return
            }
          }

          send(
            response,
            route({
              query: url.searchParams,
              body,
              loggedIn: /^Bearer\s+\S+/i.test(
                request.headers.authorization ?? '',
              ),
            }),
          )
        }, next)
      })
    },
  }
}
