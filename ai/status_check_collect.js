// 단종 점검 — 자동으로 막힌 브랜드의 공식 목록을 **사람이 브라우저로** 받아 오는 조각입니다.
//
// 많은 브랜드 사이트가 서버에서 오는 요청을 막습니다(2026-10-01: Zara · Guerlain · Dior · YSL ·
// Lancôme 등 403). 점검 스크립트는 그것을 우회하지 않습니다. 대신 사람이 평소처럼 그 사이트를
// 브라우저로 열고, 공개된 사이트맵 · 목록 페이지를 받아 파일로 넘깁니다.
//
// 쓰는 법
//   1. 보고서의 sources.csv 에서 blocked 인 브랜드를 고릅니다.
//   2. 그 브랜드 사이트(예: https://www.zara.com)를 브라우저로 열고 개발자 도구 콘솔에 이 파일 전체를
//      붙여 넣습니다.
//   3. 맨 아래 collect(...) 의 세 값을 data/status_check_sources.json 의 그 브랜드 출처대로 바꿔
//      실행합니다 — urls · child 를 그대로, 파일 이름은 보고서가 알려 준 <브랜드>.txt.
//   4. 받은 파일을 한 폴더에 모아 `python perfume_status_check.py --listings 그폴더` 로 돌립니다.
//      첫 줄의 날짜가 45일보다 오래되면 쓰지 않습니다.
//
// 사이트맵(.xml · .xml.gz)이면 <loc> 을, 그 밖의 페이지면 링크(href)를 모읍니다. 같은 사이트 안의
// 주소만 받을 수 있습니다(브라우저의 출처 규칙).

async function collect(urls, child, file) {
  const text = async (url) => {
    const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
    if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
      return new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
    }
    return new TextDecoder().decode(bytes);
  };
  // child 는 첫 인덱스에서만 고릅니다 — perfume_status_check.py 의 sitemap_locs 와 같게
  const locs = async (url, depth = 0) => {
    const body = await text(url);
    const found = [...body.matchAll(/<loc>\s*(?:<!\[CDATA\[)?\s*([^<\]\s]+)/gi)].map((m) => m[1].replace(/&amp;/g, '&'));
    if (!/<sitemapindex/i.test(body.slice(0, 3000)) || depth >= 2) return found;
    let all = [];
    for (const sub of found) {
      if (depth === 0 && child && !new RegExp(child).test(sub)) continue;
      all = all.concat(await locs(sub, depth + 1));
    }
    return all;
  };
  let all = [];
  for (const url of urls) {
    if (/sitemap|\.xml/i.test(url)) {
      all = all.concat(await locs(url));
    } else {
      const body = await text(url);
      all = all.concat([...body.matchAll(/href="([^"]+)"/g)].map((m) => new URL(m[1].replace(/&amp;/g, '&'), url).href));
    }
  }
  const unique = [...new Set(all)];
  const lines = [`# collected ${new Date().toISOString().slice(0, 10)} ${location.origin}`, ...unique];
  if (!file) return lines;           // 파일 이름 없이 부르면 내려받지 않고 줄만 돌려줍니다 (시험용)
  const link = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/plain' })),
    download: file,
  });
  link.click();
  console.log(`${file}: 주소 ${unique.length}개`);
  return lines;
}

// 예) Zara — 바꿔서 실행하십시오
collect(['https://www.zara.com/sitemaps/sitemap-index.xml.gz'], 'sitemap-product-us-en', 'zara.txt');
