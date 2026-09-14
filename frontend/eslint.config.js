import js from '@eslint/js'
import query from '@tanstack/eslint-plugin-query'
import vitest from '@vitest/eslint-plugin'
import prettier from 'eslint-config-prettier/flat'
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript'
import importX from 'eslint-plugin-import-x'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import tseslint from 'typescript-eslint'

/**
 * features/ 아래 도메인 슬라이스 목록.
 * 새 도메인 폴더를 만들면 여기에도 추가해야 교차 import 검사가 걸립니다.
 */
const FEATURE_DOMAINS = [
  'auth',
  'map',
  'perfume',
  'recommend',
  'collection',
  'shelf',
  'community',
  'brand',
  'note',
]

export default tseslint.config([
  { ignores: ['dist', 'node_modules', 'coverage', 'landing'] },

  js.configs.recommended,
  tseslint.configs.recommended,
  reactHooks.configs.flat.recommended,
  reactRefresh.configs.vite,
  query.configs['flat/recommended'],
  importX.flatConfigs.recommended,
  importX.flatConfigs.typescript,

  {
    settings: {
      // '@/...' alias 와 node_modules 를 tsconfig 기준으로 해석합니다.
      'import-x/resolver-next': [
        createTypeScriptImportResolver({
          project: ['./tsconfig.app.json', './tsconfig.node.json'],
          noWarnOnMultipleProjects: true,
        }),
      ],
    },
    rules: {
      // import 순서 자동 정렬: 외부 -> 내부(@/) -> 상대경로
      // `npm run lint:fix` 로 자동 정리됩니다.
      'import-x/order': [
        'error',
        {
          groups: [
            ['builtin', 'external'],
            'internal',
            'parent',
            'sibling',
            'index',
          ],
          pathGroups: [{ pattern: '@/**', group: 'internal' }],
          pathGroupsExcludedImportTypes: ['builtin'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
      // default export 이름 관련 경고는 노이즈가 많아 끕니다.
      'import-x/no-named-as-default': 'off',
      'import-x/no-named-as-default-member': 'off',

      /**
       * 레이어 경계 강제.
       * 지금까지 docs/프론트엔드-초기-설정-가이드.md 에 글로만 적혀 있던 규칙을
       * lint 에러로 만듭니다. 의존 방향은 app -> pages -> features -> shared 한 방향입니다.
       */
      'import-x/no-restricted-paths': [
        'error',
        {
          basePath: import.meta.dirname,
          zones: [
            // shared 는 도메인/화면을 몰라야 합니다. 알게 되면 공용이 아닙니다.
            {
              target: './src/shared',
              from: './src/features',
              message:
                'shared 는 features 를 import 할 수 없습니다. 이 코드는 공용이 아니라 해당 도메인 소속입니다.',
            },
            {
              target: './src/shared',
              from: './src/pages',
              message: 'shared 는 pages 를 import 할 수 없습니다.',
            },
            {
              target: './src/shared',
              from: './src/app',
              message: 'shared 는 app 을 import 할 수 없습니다.',
            },

            // features 는 화면 조립부를 몰라야 합니다.
            {
              target: './src/features',
              from: './src/pages',
              message:
                'features 는 pages 를 import 할 수 없습니다. 화면 조립은 pages 쪽에서 합니다.',
            },
            {
              target: './src/features',
              from: './src/app',
              message: 'features 는 app 을 import 할 수 없습니다.',
            },

            // 도메인 간 교차 import 금지 (가이드의 핵심 규칙).
            // 두 도메인이 함께 필요하면 공통 부분을 shared 로 올리거나 pages 에서 조합합니다.
            ...FEATURE_DOMAINS.map((domain) => ({
              target: `./src/features/${domain}`,
              from: './src/features',
              except: [`./${domain}`],
              message:
                'features 끼리 서로 import 하지 않습니다. 공통 부분은 shared 로 올리거나 pages 에서 조합하세요.',
            })),
          ],
        },
      ],
    },
  },

  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
    },
    rules: {
      // 사용하지 않는 변수는 에러, 단 _ 로 시작하면 의도적 무시로 허용
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      // 타입 import 는 `import type` 으로 강제 (번들 크기/순환참조에 유리)
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },

  // 설정 파일 / 라우터는 컴포넌트 모듈이 아니므로 Fast Refresh 규칙 제외
  {
    files: ['*.config.{js,ts}', 'src/app/router/**'],
    languageOptions: { globals: globals.node },
    rules: { 'react-refresh/only-export-components': 'off' },
  },

  // 테스트 파일: vitest 권장 규칙 + 테스트에서만 허용할 예외
  {
    files: ['**/*.test.{ts,tsx}', 'src/test/**/*.{ts,tsx}'],
    ...vitest.configs.recommended,
    rules: {
      ...vitest.configs.recommended.rules,
      // 테스트에서는 결과 확인용 console 을 허용합니다
      'no-console': 'off',
    },
  },

  // Prettier 와 충돌하는 포맷 규칙 비활성화 (반드시 마지막)
  prettier,
])
