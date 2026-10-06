// ───────── 엔진 화면 글자 사전 검사 (2026-09-30) ─────────
// 잡는 것 :
//   · 한국어 사전이 index.html 의 고정 글자와 갈라졌다 — 시작할 때 applyStatic 이 화면 글자를 바꿔 버린다
//   · ko · en 두 벌의 키가 어긋났다 — 빠진 쪽 언어에서 키 이름이나 한국어가 화면에 뜬다
//   · 영어 화면(PB.setLang('en'))에서 고정 글자 · 해역 설명 · 이름 규칙이 영어로 바뀌지 않는다

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CONFIG } from './config.js';
import { PARAMS } from './params.js';
import {
  applyStatic, famWord, isKo, koNames, lang, langFromSearch, MESSAGES, onLang, setLang, t, waters, zoneDesc
} from './i18n.js';

// ⚠ 경로를 변수로 넘긴다 — `new URL('글자', import.meta.url)` 를 그대로 적으면 Vite 가 자산 주소(http://)로 바꿔 버린다 (pack-boat.test.js 와 같은 모양)
const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const HTML = readFileSync(here('../index.html'), 'utf8');
const parse = () => new DOMParser().parseFromString(HTML, 'text/html');

// 객체의 잎 경로 목록 (a.b.c)
const leaves = (o, pre = '') => Object.entries(o).flatMap(([k, v]) =>
  v && typeof v === 'object' ? leaves(v, pre + k + '.') : [pre + k]);
// 영어 복수형(_one)은 영어에만 있어도 된다 — 한국어는 개수로 모양이 안 바뀐다
const base = (keys) => keys.filter((k) => !k.endsWith('_one')).sort();

afterEach(() => { setLang('ko'); });

describe('언어 고르기', () => {
  it('주소의 ?lang= 은 ko · en 만 받고 나머지는 ko 다', () => {
    expect(langFromSearch('?lang=en')).toBe('en');
    expect(langFromSearch('?quality=high&lang=ko')).toBe('ko');
    expect(langFromSearch('?lang=fr')).toBe('ko');
    expect(langFromSearch('')).toBe('ko');
  });

  it('모르는 언어로 바꾸면 한국어다', () => {
    expect(setLang('en')).toBe('en');
    expect(setLang('jp')).toBe('ko');
    expect(isKo()).toBe(true);
  });

  it('언어가 바뀔 때만 듣는 쪽을 부르고, 끊으면 안 부른다', () => {
    const fn = vi.fn();
    const off = onLang(fn);
    setLang('ko');
    expect(fn).not.toHaveBeenCalled();
    setLang('en');
    expect(fn).toHaveBeenCalledWith('en');
    off();
    setLang('ko');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('사전', () => {
  it('ko · en 두 벌의 키가 같다', () => {
    expect(base(leaves(MESSAGES.en))).toEqual(base(leaves(MESSAGES.ko)));
  });

  it('영어 사전에는 한글이 없다', () => {
    const hangul = leaves(MESSAGES.en).filter((k) => /[가-힣]/.test(k.split('.').reduce((o, p) => o[p], MESSAGES.en)));
    expect(hangul).toEqual([]);
  });

  it('치환과 영어 단수형', () => {
    expect(t('chart.count', { n: 200 })).toBe('향수 200');
    setLang('en');
    expect(t('chart.count', { n: 200 })).toBe('200 perfumes');
    expect(t('chart.count', { n: 1 })).toBe('1 perfume');
    expect(t('mini.explored', { pct: 34 })).toBe('34% seen');
  });

  it('없는 키는 키 이름 그대로 (화면이 비지 않게)', () => {
    expect(t('nope.key')).toBe('nope.key');
  });
});

describe('index.html 고정 글자', () => {
  it('한국어 사전은 index.html 의 글자와 같다 (시작할 때 applyStatic 이 아무것도 안 바꾼다)', () => {
    const doc = parse();
    const els = [...doc.querySelectorAll('[data-i18n]')];
    expect(els.length).toBeGreaterThanOrEqual(10);
    for (const el of els) expect(el.textContent, el.getAttribute('data-i18n')).toBe(t(el.getAttribute('data-i18n')));
    for (const el of doc.querySelectorAll('[data-i18n-html]')) expect(el.innerHTML).toBe(t(el.getAttribute('data-i18n-html')));
    for (const el of doc.querySelectorAll('[data-i18n-attr]')) {
      for (const pair of el.getAttribute('data-i18n-attr').split(';')) {
        const [attr, key] = pair.split(':');
        expect(el.getAttribute(attr), key).toBe(t(key));
      }
    }
  });

  it('영어로 바꾸면 카드 단추 · 해도 패널 · 떠다니기 안내가 영어가 된다', () => {
    const doc = parse();
    setLang('en');
    applyStatic(doc);
    const q = (sel) => doc.querySelector(sel);
    expect(q('[data-act="detail"]').textContent).toBe('View details');
    expect(q('[data-act="save"]').textContent).toBe('Save to Shelf');
    expect(q('#scent-sail-label').textContent).toBe('Sail to its waters');
    expect(q('#scent-close').getAttribute('aria-label')).toBe('Close');
    expect(q('#minimap-zoom').getAttribute('title')).toBe('Open chart');
    expect(q('#chart-reset').textContent).toBe('Reset zoom');
    expect(q('#chart-close').getAttribute('title')).toBe('Close (Esc)');
    expect(q('#search-input').getAttribute('placeholder')).toBe('What scent are you looking for?');
    expect(q('#drift-help').textContent).toContain('to steer');
    expect(q('[data-i18n="chart.title"]').textContent).toBe('Hyanghae Chart');
    expect(q('[data-i18n="header.logo"]').textContent).toBe('Hyanghae');
    // 단추 안의 물결 겹은 글자를 바꿔도 남는다 (글자는 제 칸 #scent-sail-label 에만 쓴다)
    expect(q('#scent-sail').querySelectorAll('[data-wave]').length).toBe(2);
    // 고정 글자 가운데 한글이 남은 것이 없다 (자리표시 헤더의 로고 '향해' 도 사전에 있다)
    const left = [...doc.querySelectorAll('[data-i18n],[data-i18n-html]')].filter((el) => /[가-힣]/.test(el.textContent));
    expect(left).toEqual([]);
  });

  it('문서 언어와 제목도 따라간다', () => {
    setLang('en');
    expect(document.documentElement.lang).toBe('en');
    expect(document.title).toBe(t('doc.title'));
    setLang('ko');
    expect(document.documentElement.lang).toBe('ko');
  });
});

describe('다음에 그리는 글자', () => {
  const floral = CONFIG.families.find((f) => f.key === 'FLORAL');

  it('해역 이름 · 설명 · 범례 둘째 줄', () => {
    expect(waters('FLORAL')).toBe('FLORAL 해역');
    expect(zoneDesc(floral)).toEqual(floral.desc);
    expect(famWord(floral)).toBe('플로럴');
    setLang('en');
    expect(lang()).toBe('en');
    expect(waters('FLORAL')).toBe('Floral waters');
    expect(zoneDesc(floral).join(' ')).not.toMatch(/[가-힣]/);
    // 영어 범례는 둘째 줄이 없다 — 첫 줄의 향조 이름을 되풀이할 뿐이다 (FLORAL / floral)
    expect(famWord(floral)).toBe('');
    expect(famWord(CONFIG.families.find((f) => f.key === 'MUSK'))).toBe('');
  });

  it('해도의 영어 머리말 · 안내', () => {
    setLang('en');
    expect(t('chart.explored', { pct: 34 })).toBe(' · 34% seen');
    expect(t('chart.unexplored')).toBe(' · not yet seen');
    expect(t('chart.tail').split('\n')[0]).toBe('Click any waters to sail there');
    expect(t('sea.outSub')).toBe("You can't sail beyond this point");
  });

  it('해역 아홉과 예전 존 넷 모두 영어 설명이 두 줄로 있다', () => {
    setLang('en');
    for (const z of [...CONFIG.families, ...CONFIG.areas]) {
      const d = zoneDesc(z);
      expect(d, z.key).toHaveLength(2);
      expect(d.join(' '), z.key).not.toMatch(/[가-힣]/);
    }
  });

  it('품질 단계 이름', () => {
    expect(t('quality.low')).toBe('낮음');
    setLang('en');
    expect(['high', 'mid', 'low'].map((k) => t('quality.' + k))).toEqual(['High', 'Medium', 'Low']);
  });

  it('향수 이름 — 영어 화면이면 한글 이름을 안 쓴다 (markNameKo 와 상관없이)', () => {
    const keep = PARAMS.markNameKo;
    try {
      PARAMS.markNameKo = 1;
      expect(koNames()).toBe(true);
      PARAMS.markNameKo = 0;
      expect(koNames()).toBe(false);
      PARAMS.markNameKo = 1;
      setLang('en');
      expect(koNames()).toBe(false);
    } finally { PARAMS.markNameKo = keep; }
  });

  it('영어 검색어로도 해역을 찾는다 (config kw)', () => {
    const find = (q) => CONFIG.families.find((a) => (a.kw || []).some((k) => q.includes(k)));
    expect(find('ocean breeze').key).toBe('AQUATIC');
    expect(find('warm incense').key).toBe('AMBER');
    expect(find('peach').key).toBe('FRUITY');
  });
});
