"""향수 단종 여부를 정기적으로 점검해 **검토용 후보 보고서** 를 씁니다. 단종 목록은 고치지 않습니다.

    python perfume_status_check.py                         # ai/ 에서. 호스트마다 쉬어 가며 30분 남짓
    python perfume_status_check.py --brands Guerlain Armaf # 일부 브랜드만
    python perfume_status_check.py --skip-retailers        # 공식 판매 목록만
    python perfume_status_check.py --out logs/status_check/직접

Jenkins 가 매달 1일 돌립니다(`status-check.Jenkinsfile`). 검토 방법은 README 의 '단종 점검'.
서버 요청을 막는 브랜드는 사람이 브라우저로 목록을 받아 `--listings` 로 넘깁니다
(`status_check_collect.js`).

**왜 스스로 바꾸지 않는가.** 손으로 대조해 보니 이름 대조와 판매처 표기가 자주 틀렸습니다 —
Play 와 Play Intense, Magie 와 Magie Noire, 향수 Parure 와 같은 이름의 파운데이션, Mukhallat 과
공식 표기 Mukhalat, 용량 단위로 'discontinued' 를 붙이는 판매처(2026-10-01). 아직 파는 향수를
추천에서 빼는 쪽이 더 나쁘므로 이 스크립트는 **후보만** 냅니다. 사람이 보고서를 보고
data/perfume_status.csv 를 고쳐 커밋하면 지금의 흐름(적재 · AI 이미지)대로 반영됩니다.

**무엇을 보는가** — 출처는 data/status_check_sources.json 에 있습니다.

    1. 브랜드 공식 판매 목록 (brands)
         평가자 MIN_PEOPLE 명 이상인 향수가 목록에 없음          → 새 추정 후보
         단종 목록의 향수가 목록에 이름 그대로 다시 보임          → 재출시 의심
    2. 단종 판매처 (retailers)
         추정 향수를 두고 판매처가 '그 상품 자신' 에 대해 단종이라 적음 → 확정 후보

**출력** (--out, 기본 logs/status_check/YYYY-MM-DD/)

    report.md                    사람이 읽는 요약 — 막힌 출처, 확정 후보, 재출시 의심
    confirm_candidates.csv       확정 후보와 근거 문장. match 가 exact 이고 후보가 하나뿐인 것만
                                 제안본에 들어갑니다
    new_likely.csv               새 추정 후보 (perfume_status.csv 와 같은 칸)
    reappeared.csv               재출시 의심 — 제안본은 이 줄을 지우지 않습니다. 사람이 봅니다
    sources.csv                  출처마다 상태(ok · blocked · robots · error · too_few)와 개수
    perfume_status.proposed.csv  지금 목록에 확정 후보와 새 추정을 반영한 제안본

**지키는 것.** robots.txt 를 따르고(구글 방식 와일드카드), 정직한 User-Agent 를 쓰고, 호스트마다
DEFAULT_DELAY 초씩 쉬어 갑니다. 봇 확인 페이지(401 · 403 · 429 · 503 · 'Just a moment' ·
'Access Denied' · CAPTCHA)를 만나면 그 호스트는 그 회차에 더 묻지 않고 '막힘' 으로 적습니다 —
브라우저인 척하거나 우회하지 않습니다. 출처가 하나라도 막힌 브랜드는 새 추정을 내지 않습니다
(목록이 비어 보여 전부 없는 것으로 잡히지 않게).

표준 라이브러리만 씁니다 — python:3.12-slim 에서 그대로 돕니다.
"""
import argparse
import csv
import datetime as dt
import gzip
import html
import json
import logging
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path

LOGGER = logging.getLogger("perfume_status_check")

_DIR = Path(__file__).resolve().parent
DEFAULT_PERFUMES = _DIR / "data" / "perfumes_nlr.csv.gz"
DEFAULT_STATUS = _DIR / "data" / "perfume_status.csv"
DEFAULT_SOURCES = _DIR / "data" / "status_check_sources.json"
DEFAULT_OUT_ROOT = _DIR / "logs" / "status_check"

USER_AGENT = "HyanghaePerfumeStatusCheck/1.0 (monthly discontinued-perfume check; obeys robots.txt)"
MIN_PEOPLE = 100            # 손으로 대조할 때와 같은 문턱. 이보다 적으면 다시 찾는 사람이 드뭅니다
DEFAULT_DELAY = 1.5         # 같은 호스트에 다시 묻기 전에 쉬는 초
MAX_CRAWL_DELAY = 30.0      # robots.txt 의 Crawl-delay 를 따르되 이 이상은 기다리지 않습니다
TIMEOUT = 30
MAX_ABSENT_RATIO = 0.85     # 한 브랜드의 이만큼이 '없음' 이면 목록이 깨진 것으로 보고 새 추정을 내지 않습니다
STATUS_COLUMNS = ["fragrantica_id", "brand", "name", "status", "confidence",
                  "source_url", "checked_at", "note"]
NO_SECOND = "두 번째 근거 미확인"

# --------------------------------------------------------------------------------------------
# 가져오기 — robots.txt · 쉬어 가기 · 봇 확인 감지
# --------------------------------------------------------------------------------------------


class Blocked(Exception):
    """봇 확인 페이지나 거절 응답. 우회하지 않고 그 호스트를 회차 끝까지 건너뜁니다."""


class Disallowed(Exception):
    """robots.txt 가 막은 주소."""


class FetchError(Exception):
    """그 밖의 실패 — 404 · 시간 초과 · 연결 오류."""


BLOCK_STATUS = {401, 403, 429, 503}
# 봇 확인 페이지는 제목으로 가립니다. 본문 전체를 보면 평범한 상품 페이지의 reCAPTCHA 스크립트까지
# 걸립니다. 실제로 만난 제목: Cloudflare 'Just a moment...', Akamai 'Access Denied',
# PerimeterX 'Access to this page has been denied', FragranceNet 'CAPTCHA Challenge'.
CHALLENGE_TITLE = re.compile(
    r"just a moment|access denied|has been denied|attention required|captcha|are you a robot|"
    r"security check|request unsuccessful|verify you are human", re.I)
TITLE = re.compile(r"<title[^>]*>(.*?)</title>", re.I | re.S)


def urllib_transport(url, headers, timeout=TIMEOUT):
    """(상태, 최종 주소, 본문 바이트). 4xx · 5xx 도 예외 대신 상태로 돌려줍니다."""
    request = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return response.status, response.geturl(), response.read()
    except urllib.error.HTTPError as error:
        return error.code, url, error.read() if error.fp else b""


def _decode(body):
    if body[:2] == b"\x1f\x8b":      # sitemap.xml.gz · gzip 으로 온 응답
        body = gzip.decompress(body)
    try:
        return body.decode("utf-8")
    except UnicodeDecodeError:
        return body.decode("latin-1")


class Robots:
    """robots.txt 를 구글 방식으로 읽습니다 — `*` · `$` 와일드카드, 가장 긴 규칙이 이기고 같으면 Allow.

    표준 라이브러리 urllib.robotparser 는 와일드카드를 글자 그대로 읽어 Shopify 같은 규칙
    (`Disallow: /*?*oseid=*`)을 놓칩니다.
    """

    def __init__(self, text, user_agent=USER_AGENT):
        groups, current, after_agent = [], None, False
        for raw in text.splitlines():
            line = raw.split("#", 1)[0].strip()
            if ":" not in line:
                continue
            key, value = (part.strip() for part in line.split(":", 1))
            key = key.lower()
            if key == "user-agent":
                if not after_agent:
                    current = {"agents": [], "rules": [], "delay": None}
                    groups.append(current)
                current["agents"].append(value.lower())
                after_agent = True
                continue
            after_agent = False
            if current is None:
                continue
            if key in ("allow", "disallow") and value:
                current["rules"].append((key == "allow", value))
            elif key == "crawl-delay":
                try:
                    current["delay"] = float(value)
                except ValueError:
                    pass
        token = user_agent.split("/", 1)[0].lower()
        mine = [g for g in groups if any(a != "*" and a in token for a in g["agents"])]
        chosen = mine or [g for g in groups if "*" in g["agents"]]
        self.rules = [rule for g in chosen for rule in g["rules"]]
        delays = [g["delay"] for g in chosen if g["delay"] is not None]
        self.delay = max(delays) if delays else None

    def allowed(self, url):
        parts = urllib.parse.urlsplit(url)
        path = (parts.path or "/") + (f"?{parts.query}" if parts.query else "")
        best = None
        for allow, pattern in self.rules:
            if _robots_match(pattern, path):
                if best is None or len(pattern) > best[0] or (len(pattern) == best[0] and allow):
                    best = (len(pattern), allow)
        return True if best is None else best[1]


def _robots_match(pattern, path):
    anchored = pattern.endswith("$")
    body = pattern[:-1] if anchored else pattern
    regex = "^" + ".*".join(re.escape(part) for part in body.split("*")) + ("$" if anchored else "")
    return re.match(regex, path) is not None


class Fetcher:
    """사이트에 예의 있게 묻는 창구. 모든 요청이 여기를 지납니다."""

    def __init__(self, transport=urllib_transport, delay=DEFAULT_DELAY, user_agent=USER_AGENT,
                 sleep=time.sleep, clock=time.monotonic):
        self.transport = transport
        self.delay = delay
        self.user_agent = user_agent
        self.sleep = sleep
        self.clock = clock
        self.blocked = {}       # 호스트 -> 막힌 까닭
        self.requests = 0
        self._robots = {}       # 호스트 -> Robots | None(robots.txt 없음)
        self._last = {}

    def get(self, url):
        host = urllib.parse.urlsplit(url).netloc
        if host in self.blocked:
            raise Blocked(self.blocked[host])
        robots = self._robots_for(url)
        if robots is not None and not robots.allowed(url):
            raise Disallowed(url)
        status, _, body = self._call(url, robots)
        text = _decode(body)
        self._check_block(host, status, text, url)
        if status >= 400:
            raise FetchError(f"{status} {url}")
        return text

    def _robots_for(self, url):
        parts = urllib.parse.urlsplit(url)
        host = parts.netloc
        if host in self._robots:
            return self._robots[host]
        robots_url = f"{parts.scheme}://{host}/robots.txt"
        status, _, body = self._call(robots_url, None)
        text = _decode(body)
        self._check_block(host, status, text, robots_url)
        if status >= 500:
            # 구글도 robots.txt 가 5xx 면 전체 금지로 봅니다
            self.blocked[host] = f"robots.txt {status}"
            raise Blocked(self.blocked[host])
        robots = Robots(text, self.user_agent) if status < 400 else None
        self._robots[host] = robots
        return robots

    def _call(self, url, robots):
        host = urllib.parse.urlsplit(url).netloc
        wait = self.delay
        if robots is not None and robots.delay:
            wait = max(wait, min(robots.delay, MAX_CRAWL_DELAY))
        last = self._last.get(host)
        if last is not None:
            remaining = wait - (self.clock() - last)
            if remaining > 0:
                self.sleep(remaining)
        headers = {"User-Agent": self.user_agent, "Accept-Encoding": "identity"}
        try:
            result = self.transport(url, headers)
        except (urllib.error.URLError, TimeoutError, OSError) as error:
            raise FetchError(f"{url}: {error}") from error
        finally:
            self._last[host] = self.clock()
            self.requests += 1
        return result

    def _check_block(self, host, status, text, url):
        title_match = TITLE.search(text[:5000])
        title = html.unescape(title_match.group(1)).strip() if title_match else ""
        if status in BLOCK_STATUS or CHALLENGE_TITLE.search(title):
            reason = f"{status} {title[:60]}".strip()
            self.blocked[host] = reason
            LOGGER.warning("막힘 %s (%s) — 이 회차에는 더 묻지 않습니다", host, reason)
            raise Blocked(reason)


# --------------------------------------------------------------------------------------------
# 목록 읽기 — 사이트맵 · Shopify · HTML 링크
# --------------------------------------------------------------------------------------------

LOC = re.compile(r"<loc>\s*(?:<!\[CDATA\[)?\s*([^<\]\s]+)", re.I)


def sitemap_locs(fetcher, url, child=None, _depth=0):
    """사이트맵의 주소. 인덱스면 child 정규식에 맞는 하위 사이트맵만 따라갑니다."""
    text = fetcher.get(url)
    locs = [html.unescape(u) for u in LOC.findall(text)]
    if "<sitemapindex" not in text[:3000].lower() or _depth >= 2:
        return locs
    found = []
    for sub in locs:
        if child and not re.search(child, sub):
            continue
        try:
            found.extend(sitemap_locs(fetcher, sub, None, _depth + 1))
        except FetchError as error:
            LOGGER.warning("하위 사이트맵을 못 읽었습니다: %s", error)
    return found


def shopify_products(fetcher, base, max_pages=80):
    """Shopify 공개 상품 목록(/products.json). 제목 · 손잡이 · 판매자 · 설명."""
    products = []
    for page in range(1, max_pages + 1):
        items = json.loads(fetcher.get(f"{base}/products.json?limit=250&page={page}")).get("products", [])
        if not items:
            break
        products.extend({"title": p.get("title") or "", "handle": p.get("handle") or "",
                         "vendor": p.get("vendor") or "", "body": p.get("body_html") or ""}
                        for p in items)
    return products


def page_text(markup):
    """HTML 에서 스크립트 · 스타일을 빼고 글만."""
    markup = re.sub(r"<(script|style)\b.*?</\1>", " ", markup, flags=re.I | re.S)
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", markup))).strip()


def heading(markup):
    match = re.search(r"<h1[^>]*>(.*?)</h1>", markup, re.I | re.S)
    return page_text(match.group(1)) if match else ""


def official_names(fetcher, source):
    """공식 출처 하나에서 상품 이름(또는 주소의 이름 부분) 목록."""
    kind = source["kind"]
    if kind == "shopify":
        names = []
        for p in shopify_products(fetcher, source["base"]):
            names.extend([p["title"], p["handle"]])
        return names
    if kind == "sitemap":
        urls = [u for start in source["urls"] for u in sitemap_locs(fetcher, start, source.get("child"))]
    elif kind == "html":
        urls = [html.unescape(m) for start in source["urls"]
                for m in re.findall(source["link"], fetcher.get(start))]
    else:
        raise ValueError(f"모르는 출처 종류: {kind}")
    return names_from_urls(urls, source)


def names_from_urls(urls, source, collected=False):
    """주소 목록을 include · exclude 로 거르고 name 정규식으로 이름 부분만, strip 을 지워서.
    collected 면 손으로 받은 전체 주소입니다 — html 출처는 link 대신 collected_name 으로 이름을 뽑습니다."""
    if collected and source["kind"] == "html":
        source = {**source, "name": source.get("collected_name", r"([^/?#]+?)/?(?:[?#].*)?$")}
    include = re.compile(source["include"]) if source.get("include") else None
    exclude = re.compile(source["exclude"]) if source.get("exclude") else None
    pick = re.compile(source.get("name", r"([^/?#]+?)/?(?:[?#].*)?$"))
    strip = re.compile(source["strip"]) if source.get("strip") else None
    names = []
    for url in urls:
        if (include and not include.search(url)) or (exclude and exclude.search(url)):
            continue
        match = pick.search(url)
        if not match:
            continue
        name = urllib.parse.unquote(match.group(1))
        names.append(strip.sub("", name) if strip else name)
    return names


# --------------------------------------------------------------------------------------------
# 이름 대조
# --------------------------------------------------------------------------------------------

APOSTROPHE = re.compile(r"['’`´ʼ]")
STOP = set("eau de du d la le les l parfum parfums perfume toilette cologne edp edt edc extrait "
           "spray ml oz fl for her him pour the and et set elixir intense collection".split())
YEAR = re.compile(r"(19|20)\d\d")
SYNONYMS = {"homme": "men", "men": "homme"}


def raw_tokens(text, apostrophe=" "):
    """악센트를 걷고 소문자로, 영숫자 덩어리로 자릅니다. 아포스트로피는 띄어 읽고(L'Homme -> l homme),
    소유격 s 는 버리고(Elvira's -> elvira), 한 글자 j 는 뒤에 붙입니다(J'adore -> jadore).
    apostrophe="" 면 붙여 읽습니다(Qaa'ed -> qaaed)."""
    text = unicodedata.normalize("NFKD", str(text)).replace("ł", "l").replace("&", " and ")
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    tokens = re.findall(r"[a-z0-9]+", APOSTROPHE.sub(apostrophe, text.lower()))
    merged = []
    skip = False
    for i, t in enumerate(tokens):
        if skip:
            skip = False
            continue
        if t == "s" and merged:
            continue
        if t == "j" and i + 1 < len(tokens):
            merged.append(t + tokens[i + 1])
            skip = True
            continue
        merged.append(t)
    return merged


def brand_tokens(brand, aliases=()):
    return {t for name in (brand, *aliases) for t in raw_tokens(name)}


def catalog_core(name, brand_toks, apostrophe=" "):
    """공식 목록 대조에 쓰는 이름의 핵심 낱말. 농도 · 성별 표기 · 브랜드 · 연도를 뺍니다."""
    return [t for t in raw_tokens(name, apostrophe)
            if t not in STOP and t not in brand_toks and not YEAR.fullmatch(t)]


def catalog_cores(name, brand_toks):
    """아포스트로피를 띄어 읽은 것과 붙여 읽은 것 — 사이트마다 달리 적습니다(l-homme · qaaed)."""
    cores = []
    for apostrophe in (" ", ""):
        core = catalog_core(name, brand_toks, apostrophe)
        if core and core not in cores:
            cores.append(core)
    return cores


def _squash(text):
    """음역 흔들림을 눌러 둡니다 — Qaa'ed / Qaaed, Badee / Bade."""
    return text.replace("aa", "a").replace("ee", "e")


class Listing:
    """한 브랜드 공식 목록. '이 향수가 목록에 있는가' 를 너그럽게 봅니다 — 놓치면 아직 파는 향수가
    추정에 올라가니, 헷갈리면 '있음' 쪽으로 기웁니다."""

    def __init__(self, names, brand_toks):
        self.entries = []
        for name in names:
            raw = raw_tokens(name)
            words = [t for t in raw if t not in STOP and t not in brand_toks]
            variants = set(words)
            variants |= {a + b for a, b in zip(raw, raw[1:])}          # chant d aromes -> chantdaromes
            variants |= {t[1:] for t in raw if len(t) > 2 and t[0] in "ld"}   # daromes -> aromes
            variants |= {t[:-1] for t in raw if len(t) > 3 and t.endswith("s")}  # elviras -> elvira
            variants |= {SYNONYMS[t] for t in list(variants) if t in SYNONYMS}
            self.entries.append((name, variants, _squash("".join(words))))

    def find(self, *cores):
        """목록에서 이 핵심 낱말을 모두 품은 이름. 여러 읽기(catalog_cores) 중 하나만 맞아도 됩니다."""
        for core in cores:
            if not core:
                continue
            joined = _squash("".join(core))
            for name, variants, squashed in self.entries:
                if all(t in variants for t in core):
                    return name
                if len(joined) >= 6 and joined in squashed:
                    return name
        return None


# 판매처 상품 · 재출시 대조는 엄격하게 봅니다 — 여기서 틀리면 아직 파는 향수를 확정 후보로 올립니다.
NOISE = set("eau de du d la le les l parfum parfums perfume toilette cologne edp edt edc extrait "
            "spray splash ml oz fl g the and et a by for pour vintage vaulted discontinued "
            "rare very sealed new box no unboxed tester decant decants sample samples retro "
            "natural vaporisateur vapo mini travel refill last call".split())
FEMALE = {"her", "women", "woman", "femme", "donna", "ladies", "w"}
MALE = {"him", "men", "man", "homme", "uomo", "m"}
UNITS = {"ml", "oz", "fl", "g"}


CONC_TRAILING = NOISE | UNITS | {"intense"}


def concentration(tokens):
    """적힌 농도 — 'P'(엑스트레 · 퓨어 퍼퓸 · 이름 끝의 Parfum) · 'EDP' · 'EDT' · 'EDC' · None.
    이름 가운데의 Parfum(Shalimar Parfum Initial)은 농도로 보지 않습니다."""
    text = " ".join(tokens)
    if "extrait" in tokens or "pure parfum" in text:
        return "P"
    if "eau de parfum" in text or "edp" in tokens:
        return "EDP"
    if "eau de toilette" in text or "edt" in tokens:
        return "EDT"
    if "eau de cologne" in text or "edc" in tokens:
        return "EDC"
    meaningful = [t for t in tokens if t not in CONC_TRAILING - {"parfum"} and not re.fullmatch(r"\d+(ml|oz|g)?", t)]
    if meaningful and meaningful[-1] == "parfum":
        return "P"
    return None


def exact_key(text, brand_toks):
    """(핵심 낱말 집합, 성별, 농도). 용량(100 ml · 3.4 oz) · 연도 · 판매처 꼬리말 · 농도 낱말을 뺍니다.
    성별과 농도는 따로 들고 갑니다 — 'Play For Her' 와 'Play For Men', Extrait 와 EDP 를 가르려고."""
    tokens = raw_tokens(text)
    core, genders = [], set()
    skip = False
    for i, t in enumerate(tokens):
        if skip:
            skip = False
            continue
        nxt = tokens[i + 1] if i + 1 < len(tokens) else ""
        nxt2 = tokens[i + 2] if i + 2 < len(tokens) else ""
        if t == "l" and nxt == "eau":          # L'Eau 는 농도가 아니라 이름입니다 (White Musk L'Eau)
            core.append("leau")
            skip = True
            continue
        if t in FEMALE:
            genders.add("F")
            continue
        if t in MALE:
            genders.add("M")
            continue
        if t.isdigit() and (nxt in UNITS or (nxt.isdigit() and nxt2 in UNITS)):
            continue
        if re.fullmatch(r"\d+(ml|oz|g)", t) or YEAR.fullmatch(t):
            continue
        if t in NOISE or t in brand_toks:
            continue
        core.append(t)
    gender = genders.pop() if len(genders) == 1 else None
    return frozenset(core), gender, concentration(tokens)


def _strip_article(core):
    return frozenset(t[1:] if len(t) > 3 and t[0] in "ld" else t for t in core)


def match_kind(a, b, strict=False):
    """두 exact_key 가 같은 상품인가 — 'exact' · 'partial'(한쪽이 다른 쪽을 품거나 농도가 다름) · None.

    strict 면 한쪽만 성별을 적은 것도 partial 입니다(Raghba 와 Raghba For Men). 확정 후보는 틀리면
    아직 파는 향수를 추천에서 빼니 strict 로, 재출시 의심은 사람이 보고 넘기면 그만이라 너그럽게 봅니다."""
    (core_a, gender_a, conc_a), (core_b, gender_b, conc_b) = a, b
    if not core_a or not core_b:
        return None
    if gender_a and gender_b and gender_a != gender_b:
        return None
    if core_a == core_b or _strip_article(core_a) == _strip_article(core_b):
        # 둘 다 농도를 적었는데 다르면 같은 이름의 다른 판입니다 (Midnight Poison Extrait 와 EDP)
        if conc_a and conc_b and conc_a != conc_b:
            return "partial"
        if strict and (gender_a is None) != (gender_b is None):
            return "partial"
        return "exact"
    if core_a < core_b or core_b < core_a:
        return "partial"
    return None


# --------------------------------------------------------------------------------------------
# 판매처의 단종 표기 — '그 상품 자신' 에 대한 문장만
# --------------------------------------------------------------------------------------------

# 단종이 향이 아니라 용량 · 포장 · 처방에 걸린 문장 (alinjazperfumes 의 '75ml discontinued',
# 'discontinued in this older formula', 'later discontinued and substituted by a reformulation')
REJECT = re.compile(r"\b(size|sizes|formula|formulation|reformulat\w*|version|bottle|packaging|"
                    r"substitut\w*|replac\w*|renamed|companion)\b", re.I)
PRONOUN = re.compile(r"^\W*(it|this|these|sadly|unfortunately|now|the (fragrance|scent|perfume))\b", re.I)
NAMED = re.compile(r"(.{2,120}?)\s+(?:is|was|has been)\s+(?:a\s+|now\s+|now\s+a\s+)?discontinued", re.I)


def title_evidence(title):
    """상품명에 붙은 단종 표기. 용량 · 판(version) 단위면 버립니다."""
    if not re.search(r"discontinu", title, re.I) or REJECT.search(title):
        return None
    return title.strip()


def text_evidence(text, product_key, brand_toks, require_name=False):
    """설명 글에서 그 상품의 단종을 밝힌 첫 문장. require_name 이면 '<이름> is a discontinued' 의
    이름이 그 상품과 정확히 같아야 합니다 — Coucou 는 관련 상품 칸에도 같은 문장이 있습니다."""
    for sentence in re.split(r"(?<=[.!?])\s+", text):
        if not re.search(r"discontinu", sentence, re.I) or REJECT.search(sentence):
            continue
        if require_name:
            named = NAMED.search(sentence)
            # 주어 앞에 'Description Reviews' 같은 화면 글자가 붙어 오므로 뒤에서부터 낱말을 늘려 봅니다
            words = named.group(1).split() if named else []
            if any(match_kind(exact_key(" ".join(words[-k:]), brand_toks), product_key) == "exact"
                   for k in range(1, len(words) + 1)):
                return sentence.strip()
            continue
        words = set(raw_tokens(sentence))
        if PRONOUN.search(sentence) or (product_key[0] and product_key[0] <= words):
            return sentence.strip()
    return None


@dataclass
class RetailItem:
    retailer: str
    label: str
    where: str          # '상품명' · '상품 설명'
    title: str
    url: str
    evidence: str
    brand: str


class BrandIndex:
    """판매처 상품이 어느 브랜드인지. 별칭이 긴 것부터 봅니다(Christian Dior 를 Dior 보다 먼저)."""

    def __init__(self, brand_aliases):
        self.aliases = sorted(((brand, raw_tokens(alias)) for brand, names in brand_aliases.items()
                               for alias in names if raw_tokens(alias)),
                              key=lambda pair: -len(pair[1]))
        self.tokens = {brand: brand_tokens(brand, names) for brand, names in brand_aliases.items()}

    def which(self, text):
        words = set(raw_tokens(text))
        for brand, alias in self.aliases:
            if set(alias) <= words:
                return brand
        return None


def retailer_items(fetcher, retailer, brands):
    """판매처 하나에서, 우리 브랜드 상품 가운데 단종 표기가 있는 것."""
    kind, label = retailer["kind"], retailer["label"]
    items = []

    def keep(title, url, evidence, where, brand):
        if evidence:
            items.append(RetailItem(retailer["name"], label, where, title.strip(), url, evidence, brand))

    if kind == "shopify":
        base = retailer["base"]
        for p in shopify_products(fetcher, base, retailer.get("max_pages", 80)):
            brand = brands.which(f"{p['vendor']} {p['title']}")
            if not brand:
                continue
            url = f"{base}/products/{p['handle']}"
            if retailer["evidence"] == "title":
                keep(p["title"], url, title_evidence(p["title"]), "상품명", brand)
            else:
                key = exact_key(p["title"], brands.tokens[brand])
                keep(p["title"], url, text_evidence(page_text(p["body"]), key, brands.tokens[brand]),
                     "상품 설명", brand)
    elif kind == "sitemap":
        include = re.compile(retailer.get("include", "."))
        for url in (u for start in retailer["urls"] for u in sitemap_locs(fetcher, start, retailer.get("child"))):
            if not include.search(url):
                continue
            title = urllib.parse.unquote(url.rstrip("/").rsplit("/", 1)[-1]).replace("-", " ")
            brand = brands.which(title)
            if brand:
                keep(title, url, title_evidence(title), "상품명", brand)
    elif kind == "pages":
        seen, links = set(), []
        for page in range(1, retailer.get("max_pages", 40) + 1):
            try:
                found = re.findall(retailer["link"], fetcher.get(retailer["list_url"].format(page=page)))
            except FetchError:
                break
            fresh = [u for u in found if u not in seen]
            if not fresh:
                break
            seen.update(fresh)
            links.extend(fresh)
        for url in links:
            slug = url.rstrip("/").rsplit("/", 1)[-1].rsplit(".", 1)[0].replace("-", " ")
            brand = brands.which(slug)
            if not brand:
                continue                 # 우리 브랜드가 아닌 상품 페이지는 열지 않습니다
            try:
                markup = fetcher.get(url)
            except FetchError as error:
                LOGGER.warning("%s 상품을 못 읽었습니다: %s", label, error)
                continue
            title = heading(markup) or slug
            key = exact_key(title, brands.tokens[brand])
            keep(title, url, text_evidence(page_text(markup), key, brands.tokens[brand],
                                           require_name=retailer.get("require_name", False)),
                 "상품 설명", brand)
    else:
        raise ValueError(f"모르는 판매처 종류: {kind}")
    return items


# --------------------------------------------------------------------------------------------
# 점검
# --------------------------------------------------------------------------------------------


@dataclass
class Result:
    sources: list = field(default_factory=list)        # 출처 상태
    new_likely: list = field(default_factory=list)     # STATUS_COLUMNS 행 + people
    reappeared: list = field(default_factory=list)
    confirm: list = field(default_factory=list)
    unsupported: list = field(default_factory=list)
    excluded: list = field(default_factory=list)
    requests: int = 0


def load_catalog(path):
    """fragrantica_id -> (이름, 브랜드, 평가자 수)."""
    catalog = {}
    with gzip.open(path, "rt", encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f):
            try:
                people = float(row.get("people") or 0)
            except ValueError:
                people = 0.0
            catalog[int(row["id"])] = (row["name"].strip(), row["brand"].strip(), people)
    return catalog


def load_status(path):
    with open(path, encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def _source_status(fetcher, brand, source):
    """(이름 목록 | None, 상태 행)."""
    label = source.get("label") or source.get("base") or source["urls"][0]
    row = {"kind": "official", "brand": brand, "source": label, "status": "ok", "count": 0, "detail": ""}
    try:
        names = official_names(fetcher, source)
    except Blocked as error:
        row.update(status="blocked", detail=str(error))
        return None, row
    except Disallowed as error:
        row.update(status="robots", detail=str(error))
        return None, row
    except (FetchError, ValueError, json.JSONDecodeError) as error:
        row.update(status="error", detail=str(error)[:200])
        return None, row
    row["count"] = len(names)
    if len(names) < source.get("min", 1):
        row.update(status="too_few", detail=f"{source.get('min', 1)}개 미만 — 목록 모양이 바뀌었을 수 있습니다")
        return None, row
    return names, row


COLLECTED_HEADER = re.compile(r"#\s*collected\s+(\d{4}-\d{2}-\d{2})")
COLLECTED_MAX_AGE = 45      # 손으로 받은 목록이 이보다 오래되면 쓰지 않습니다 — 묵은 목록은 재출시 · 단종을 놓칩니다


def brand_slug(brand):
    return "-".join(raw_tokens(brand)) or "brand"


def load_collected(listings_dir, brand, today):
    """브라우저에서 사람이 받은 공식 목록(listings_dir/<브랜드>.txt). 없거나 오래되면 (None, 까닭)."""
    if not listings_dir:
        return None, ""
    path = Path(listings_dir) / f"{brand_slug(brand)}.txt"
    if not path.exists():
        return None, ""
    lines = path.read_text(encoding="utf-8").splitlines()
    header = COLLECTED_HEADER.search(lines[0]) if lines else None
    if not header:
        return None, f"{path.name} 첫 줄에 '# collected YYYY-MM-DD' 가 없음"
    age = (dt.date.fromisoformat(today) - dt.date.fromisoformat(header.group(1))).days
    if age > COLLECTED_MAX_AGE:
        return None, f"{path.name} 이 {age}일 전 목록이라 쓰지 않음"
    return [line for line in lines[1:] if line.strip() and not line.startswith("#")], f"{path.name} ({header.group(1)})"


def check_official(fetcher, config, catalog, status_rows, today, result, only=None, min_people=MIN_PEOPLE,
                   listings_dir=None):
    listed = {int(r["fragrantica_id"]) for r in status_rows}
    by_brand = defaultdict(list)
    for fid, (name, brand, people) in catalog.items():
        by_brand[brand].append((fid, name, people))
    status_by_brand = defaultdict(list)
    for r in status_rows:
        status_by_brand[r["brand"]].append(r)

    for entry in config["brands"]:
        brand = entry["brand"]
        if only and brand not in only:
            continue
        if entry.get("unsupported"):
            result.unsupported.append({"brand": brand, "reason": entry["unsupported"]})
            continue
        toks = brand_tokens(brand, entry.get("aliases", []))
        collected, collected_label = load_collected(listings_dir, brand, today)
        names, ok = [], True
        for source in entry["sources"]:
            got, row = _source_status(fetcher, brand, source)
            if got is None and collected is not None and source["kind"] != "shopify":
                # 자동으로 못 읽은 출처만 손으로 받은 목록으로 채웁니다
                filled = names_from_urls(collected, source, collected=True)
                if len(filled) >= source.get("min", 1):
                    row.update(status="collected", count=len(filled),
                               detail=f"{collected_label} 손으로 받은 목록 · 자동 결과 {row['status']}")
                    got = filled
            elif got is None and collected_label:
                row["detail"] = f"{row['detail']} · {collected_label}".strip(" ·")
            result.sources.append(row)
            if got is None:
                ok = False
            else:
                names.extend(got)
        if not ok:
            LOGGER.info("%s: 출처가 막히거나 실패해 이 브랜드는 건너뜁니다", brand)
            continue

        listing = Listing(names, toks)
        exact_names = [(n, exact_key(n, toks)) for n in names]
        popular = [(fid, name, people) for fid, name, people in by_brand.get(brand, []) if people >= min_people]
        absent = []
        for fid, name, people in popular:
            cores = catalog_cores(name, toks)
            if cores and listing.find(*cores) is None:      # 이름이 브랜드뿐이면 판단하지 않습니다
                absent.append((fid, name, people))
        if popular and len(absent) / len(popular) > MAX_ABSENT_RATIO:
            result.sources.append({"kind": "official", "brand": brand, "source": "(전체)", "status": "too_few",
                                   "count": len(names),
                                   "detail": f"평가자 {min_people:g}명 이상 {len(popular)}개 중 {len(absent)}개가 없음 — "
                                             "목록이 깨졌을 수 있어 새 추정을 내지 않습니다"})
            continue
        for fid, name, people in absent:
            if fid in listed:
                continue
            result.new_likely.append({"fragrantica_id": str(fid), "brand": brand, "name": name,
                                      "status": "DISCONTINUED", "confidence": "LIKELY",
                                      "source_url": entry["source_url"], "checked_at": today,
                                      "note": f"{entry['note']}. {NO_SECOND}", "people": people})

        # 재출시 의심 — 단종 목록의 향수가 공식 목록에 이름 그대로 보이면
        for r in status_by_brand.get(brand, []):
            key = exact_key(r["name"], toks)
            for official, official_key in exact_names:
                if match_kind(key, official_key) == "exact":
                    result.reappeared.append({"fragrantica_id": r["fragrantica_id"], "brand": brand,
                                              "name": r["name"], "confidence": r["confidence"],
                                              "official_name": official, "source": entry["source_url"]})
                    break


def check_retailers(fetcher, config, catalog, status_rows, result):
    candidates = [r for r in status_rows if r["confidence"] == "LIKELY"]
    candidates += [{k: v for k, v in r.items() if k != "people"} for r in result.new_likely]
    if not candidates:
        return
    aliases = {e["brand"]: e.get("aliases", []) for e in config["brands"]}
    for r in candidates:
        aliases.setdefault(r["brand"], [])
    brands = BrandIndex({b: [b, *a] for b, a in aliases.items()})
    by_brand = defaultdict(list)
    for r in candidates:
        by_brand[r["brand"]].append((r, exact_key(r["name"], brands.tokens[r["brand"]])))

    for retailer in config.get("retailers", []):
        row = {"kind": "retailer", "brand": "", "source": retailer["label"], "status": "ok", "count": 0, "detail": ""}
        try:
            items = retailer_items(fetcher, retailer, brands)
        except Blocked as error:
            row.update(status="blocked", detail=str(error))
            items = []
        except Disallowed as error:
            row.update(status="robots", detail=str(error))
            items = []
        except (FetchError, ValueError, json.JSONDecodeError) as error:
            row.update(status="error", detail=str(error)[:200])
            items = []
        row["count"] = len(items)
        result.sources.append(row)
        for item in items:
            item_key = exact_key(item.title, brands.tokens[item.brand])
            hits = [(r, kind) for r, key in by_brand.get(item.brand, [])
                    if (kind := match_kind(key, item_key, strict=True))]
            exact = [r for r, kind in hits if kind == "exact"]
            for r, kind in hits:
                if kind == "exact" and len(exact) > 1:
                    kind = "ambiguous"
                fid = int(r["fragrantica_id"])
                result.confirm.append({
                    "fragrantica_id": r["fragrantica_id"], "brand": r["brand"], "name": r["name"],
                    "people": catalog.get(fid, ("", "", 0))[2], "current": r["confidence"],
                    "match": kind, "retailer": item.label, "where": item.where,
                    "retailer_title": item.title, "evidence": item.evidence[:300], "url": item.url})
    result.excluded = config.get("excluded", [])


def run(config, catalog, status_rows, fetcher, today, only=None, skip_official=False,
        skip_retailers=False, min_people=MIN_PEOPLE, listings_dir=None):
    result = Result()
    if not skip_official:
        check_official(fetcher, config, catalog, status_rows, today, result, only, min_people, listings_dir)
    if not skip_retailers:
        check_retailers(fetcher, config, catalog, status_rows, result)
    result.requests = fetcher.requests
    return result


# --------------------------------------------------------------------------------------------
# 쓰기
# --------------------------------------------------------------------------------------------


def confirmed_note(candidate, official_note):
    """확정 줄의 근거 문구. 판매처 상품명을 함께 적습니다 — Fragrance Vault 처럼 옛 상품 주소를 다른
    상품에 다시 쓰는 판매처가 있어, 주소만으로는 나중에 무엇을 근거로 삼았는지 알 수 없습니다."""
    base = official_note.replace(f". {NO_SECOND}", "").replace(NO_SECOND, "").strip(". ")
    title = candidate["retailer_title"][:80].replace("'", "’")
    return f"판매처({candidate['retailer']}) {candidate['where']}에 단종 명시('{title}'). {base}"


def proposal(status_rows, result):
    """지금 목록 + exact 확정 후보(후보가 하나뿐인 것) + 새 추정. 지우는 줄은 없습니다."""
    chosen = {}
    for c in result.confirm:
        if c["match"] == "exact" and c["fragrantica_id"] not in chosen:
            chosen[c["fragrantica_id"]] = c
    rows = []
    for r in status_rows:
        r = dict(r)
        c = chosen.get(r["fragrantica_id"])
        if c and r["confidence"] == "LIKELY":
            r.update(confidence="CONFIRMED", source_url=c["url"], note=confirmed_note(c, r["note"]))
        rows.append(r)
    for n in result.new_likely:
        r = {k: n[k] for k in STATUS_COLUMNS}
        c = chosen.get(r["fragrantica_id"])
        if c:
            r.update(confidence="CONFIRMED", source_url=c["url"], note=confirmed_note(c, r["note"]))
        rows.append(r)
    return rows


def _write_csv(path, rows, columns):
    with open(path, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=columns, extrasaction="ignore", lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


def write_outputs(result, status_rows, out_dir, started, finished):
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    new_likely = sorted(result.new_likely, key=lambda r: -r["people"])
    confirm = sorted(result.confirm, key=lambda r: (r["match"] != "exact", -float(r["people"] or 0)))
    _write_csv(out_dir / "sources.csv", result.sources, ["kind", "brand", "source", "status", "count", "detail"])
    _write_csv(out_dir / "new_likely.csv", new_likely, STATUS_COLUMNS)
    _write_csv(out_dir / "reappeared.csv", result.reappeared,
               ["fragrantica_id", "brand", "name", "confidence", "official_name", "source"])
    _write_csv(out_dir / "confirm_candidates.csv", confirm,
               ["fragrantica_id", "brand", "name", "people", "current", "match", "retailer", "where",
                "retailer_title", "evidence", "url"])
    _write_csv(out_dir / "perfume_status.proposed.csv", proposal(status_rows, result), STATUS_COLUMNS)
    (out_dir / "report.md").write_text(report_markdown(result, new_likely, confirm, started, finished),
                                       encoding="utf-8")
    return out_dir


def _cell(text):
    return str(text).replace("|", "\\|").replace("\n", " ")


def report_markdown(result, new_likely, confirm, started, finished):
    lines = [f"# 단종 점검 보고서 {started:%Y-%m-%d}", "",
             f"실행 {started:%Y-%m-%d %H:%M} ~ {finished:%H:%M} · 요청 {result.requests}건. "
             "이 보고서는 후보만 냅니다 — `ai/data/perfume_status.csv` 는 바뀌지 않았습니다.", ""]
    exact = [c for c in confirm if c["match"] == "exact"]
    lines += ["## 요약", "",
              f"- 확정 후보(이름 정확 일치) **{len(exact)}개** — 제안본에 반영",
              f"- 확정 후보(부분 일치 · 여러 향수와 겹침) {len(confirm) - len(exact)}개 — 사람이 직접 판단",
              f"- 새 추정 후보 {len(new_likely)}개",
              f"- 재출시 의심 {len(result.reappeared)}개",
              f"- 막히거나 실패한 출처 {sum(1 for s in result.sources if s['status'] != 'ok')}곳", ""]
    lines += ["## 출처 상태", "", "| 종류 | 브랜드 | 출처 | 상태 | 개수 | 비고 |", "|---|---|---|---|---|---|"]
    lines += [f"| {s['kind']} | {_cell(s['brand'])} | {_cell(s['source'])} | {s['status']} | {s['count']} | {_cell(s['detail'])} |"
              for s in result.sources]
    if result.unsupported:
        lines += ["", "자동으로 대조하지 않는 브랜드:", ""]
        lines += [f"- {u['brand']} — {u['reason']}" for u in result.unsupported]
    if result.excluded:
        lines += ["", "근거로 쓰지 않는 출처:", ""]
        lines += [f"- {e['name']} — {e['reason']}" for e in result.excluded]
    lines += ["", "## 확정 후보", "", "근거 문장이 **그 상품** 이야기인지, 이름이 같은 다른 판(농도 · 연도)이 아닌지 보십시오.", "",
              "| 번호 | 향수 | 평가자 | 일치 | 판매처 | 판매처 상품 | 근거 |", "|---|---|---|---|---|---|---|"]
    lines += [f"| {c['fragrantica_id']} | {_cell(c['brand'])} {_cell(c['name'])} | {int(float(c['people'] or 0))} | {c['match']} | "
              f"{_cell(c['retailer'])} | [{_cell(c['retailer_title'][:60])}]({c['url']}) | {_cell(c['evidence'][:120])} |"
              for c in confirm[:200]]
    lines += ["", "## 재출시 의심", "", "공식 목록에 이름 그대로 다시 보입니다. 정말 같은 향수면 단종 목록에서 그 줄을 지웁니다.", "",
              "| 번호 | 향수 | 지금 | 공식 목록의 이름 |", "|---|---|---|---|"]
    lines += [f"| {r['fragrantica_id']} | {_cell(r['brand'])} {_cell(r['name'])} | {r['confidence']} | {_cell(r['official_name'])} |"
              for r in result.reappeared]
    lines += ["", "## 새 추정 후보 (평가자 많은 순 50개)", "", "| 번호 | 향수 | 평가자 |", "|---|---|---|"]
    lines += [f"| {r['fragrantica_id']} | {_cell(r['brand'])} {_cell(r['name'])} | {int(r['people'])} |"
              for r in new_likely[:50]]
    lines += ["", "## 검토 방법", "",
              "1. 확정 후보의 근거 링크를 열어 문장을 직접 확인합니다.",
              "2. `perfume_status.proposed.csv` 를 `ai/data/perfume_status.csv` 에 덮어쓰고 `git add -p` 로 맞는 줄만 고릅니다.",
              "3. 재출시 의심은 공식 페이지를 열어 보고 맞으면 그 줄을 지웁니다.",
              "4. `backend/db/seed/load_perfume_status.sh` 로 이름 대조를 통과하는지 본 뒤 커밋합니다.", ""]
    return "\n".join(lines)


def main(argv=None):
    parser = argparse.ArgumentParser(description="향수 단종 점검 — 후보 보고서만 씁니다")
    parser.add_argument("--perfumes", type=Path, default=DEFAULT_PERFUMES)
    parser.add_argument("--status", type=Path, default=DEFAULT_STATUS)
    parser.add_argument("--sources", type=Path, default=DEFAULT_SOURCES)
    parser.add_argument("--out", type=Path, default=None, help="보고서 폴더 (기본 logs/status_check/오늘)")
    parser.add_argument("--brands", nargs="*", default=None, help="이 브랜드만 공식 목록을 봅니다")
    parser.add_argument("--listings", type=Path, default=None,
                        help="브라우저에서 받은 공식 목록 폴더(<브랜드>.txt). 자동으로 막힌 출처만 이것으로 채웁니다")
    parser.add_argument("--skip-official", action="store_true")
    parser.add_argument("--skip-retailers", action="store_true")
    parser.add_argument("--delay", type=float, default=DEFAULT_DELAY)
    parser.add_argument("--min-people", type=float, default=MIN_PEOPLE)
    parser.add_argument("-v", "--verbose", action="store_true")
    args = parser.parse_args(argv)
    logging.basicConfig(level=logging.DEBUG if args.verbose else logging.INFO,
                        format="%(asctime)s %(levelname)s %(message)s")

    started = dt.datetime.now()
    today = started.date().isoformat()
    config = json.loads(args.sources.read_text(encoding="utf-8"))
    catalog = load_catalog(args.perfumes)
    status_rows = load_status(args.status)
    fetcher = Fetcher(delay=args.delay)
    result = run(config, catalog, status_rows, fetcher, today, only=set(args.brands) if args.brands else None,
                 skip_official=args.skip_official, skip_retailers=args.skip_retailers,
                 min_people=args.min_people, listings_dir=args.listings)
    out = write_outputs(result, status_rows, args.out or DEFAULT_OUT_ROOT / today, started, dt.datetime.now())
    LOGGER.info("보고서 %s — 확정 후보 %d · 새 추정 %d · 재출시 의심 %d · 막힌 출처 %d",
                out, sum(1 for c in result.confirm if c["match"] == "exact"), len(result.new_likely),
                len(result.reappeared), sum(1 for s in result.sources if s["status"] != "ok"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
