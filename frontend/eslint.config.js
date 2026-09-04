import js from '@eslint/js'
import query from '@tanstack/eslint-plugin-query'
import prettier from 'eslint-config-prettier/flat'
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript'
import importX from 'eslint-plugin-import-x'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config([
  { ignores: ['dist', 'node_modules', 'coverage'] },

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

  // Prettier 와 충돌하는 포맷 규칙 비활성화 (반드시 마지막)
  prettier,
])
