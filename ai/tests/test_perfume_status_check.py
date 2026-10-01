"""단종 점검(perfume_status_check.py)이 손으로 대조하며 겪은 함정에 다시 빠지지 않는지 본다.

    python -m unittest discover -s ai/tests

네트워크를 쓰지 않는다 — 가짜 사이트(FakeSite)가 주소마다 정해 둔 응답을 돌려준다.
"""
import gzip
import json
import logging
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import perfume_status_check as psc  # noqa: E402


class FakeSite:
    """주소 -> (상태, 본문). 없는 주소는 404. 몇 번 물었는지 센다."""

    def __init__(self, pages):
        self.pages = pages
        self.calls = []

    def __call__(self, url, headers):
        self.calls.append(url)
        status, body = self.pages.get(url, (404, "not found"))
        return status, url, body if isinstance(body, bytes) else body.encode("utf-8")


def fetcher(pages):
    site = FakeSite(pages)
    return psc.Fetcher(transport=site, delay=0, sleep=lambda s: None), site


def shopify(products):
    return json.dumps({"products": products})


class RobotsTest(unittest.TestCase):

    def test_wildcard_rules_are_read_like_google(self):
        robots = psc.Robots("User-agent: *\nDisallow: /*?*sort=\nDisallow: /search\nAllow: /search/ok$\n")
        self.assertFalse(robots.allowed("https://a.test/c/x?page=2&sort=price"))
        self.assertFalse(robots.allowed("https://a.test/search?q=1"))
        self.assertTrue(robots.allowed("https://a.test/search/ok"))
        self.assertTrue(robots.allowed("https://a.test/products.json?limit=250&page=1"))

    def test_named_group_wins_over_star(self):
        robots = psc.Robots("User-agent: *\nDisallow: /\n\nUser-agent: HyanghaePerfumeStatusCheck\nAllow: /\n")
        self.assertTrue(robots.allowed("https://a.test/anything"))

    def test_disallowed_url_is_not_requested(self):
        f, site = fetcher({"https://a.test/robots.txt": (200, "User-agent: *\nDisallow: /\n")})
        with self.assertRaises(psc.Disallowed):
            f.get("https://a.test/sitemap.xml")
        self.assertEqual(site.calls, ["https://a.test/robots.txt"])


class BlockTest(unittest.TestCase):

    def test_challenge_page_blocks_the_host_for_the_rest_of_the_run(self):
        f, site = fetcher({"https://b.test/a": (200, "<html><title>Just a moment...</title></html>")})
        with self.assertRaises(psc.Blocked):
            f.get("https://b.test/a")
        with self.assertRaises(psc.Blocked):
            f.get("https://b.test/b")
        self.assertNotIn("https://b.test/b", site.calls)

    def test_403_is_blocked_but_404_is_only_an_error(self):
        f, _ = fetcher({"https://c.test/x": (403, "<title>Access Denied</title>")})
        with self.assertRaises(psc.Blocked):
            f.get("https://c.test/x")
        f, _ = fetcher({})
        with self.assertRaises(psc.FetchError):
            f.get("https://d.test/missing")

    def test_recaptcha_script_on_a_normal_page_is_not_a_block(self):
        page = "<title>Shalimar</title><script src='https://www.google.com/recaptcha/api.js'></script>"
        f, _ = fetcher({"https://e.test/p": (200, page)})
        self.assertIn("Shalimar", f.get("https://e.test/p"))


class SitemapTest(unittest.TestCase):

    def test_index_follows_matching_children_including_gzip(self):
        child = gzip.compress(b"<urlset><url><loc><![CDATA[https://z.test/us/en/a-edp-p1.html]]></loc></url></urlset>")
        f, site = fetcher({
            "https://z.test/index.xml": (200, "<sitemapindex><sitemap><loc>https://z.test/product-us.xml.gz</loc></sitemap>"
                                              "<sitemap><loc>https://z.test/product-fr.xml.gz</loc></sitemap></sitemapindex>"),
            "https://z.test/product-us.xml.gz": (200, child),
        })
        self.assertEqual(psc.sitemap_locs(f, "https://z.test/index.xml", child="product-us"),
                         ["https://z.test/us/en/a-edp-p1.html"])
        self.assertNotIn("https://z.test/product-fr.xml.gz", site.calls)


class OfficialNameTest(unittest.TestCase):
    """공식 목록 대조는 너그럽게 — 놓치면 아직 파는 향수가 추정에 오른다."""

    def on(self, name, slugs, brand="Brand"):
        toks = psc.brand_tokens(brand)
        return psc.Listing(slugs, toks).find(*psc.catalog_cores(name, toks)) is not None

    def test_apostrophes_and_joined_articles(self):
        self.assertTrue(self.on("J'adore", ["jadore-eau-de-parfum"], "Dior"))
        self.assertTrue(self.on("L'Homme Idéal", ["lhomme-ideal-de-guerlain-paris-parfum"], "Guerlain"))
        self.assertTrue(self.on("Chant d'Arômes", ["les-legendaires-chant-daromes---eau-de-toilette"], "Guerlain"))
        self.assertTrue(self.on("Elvira's Zombie", ["elviras-zombie-cologne"], "Demeter"))

    def test_homme_and_men_are_the_same_word(self):
        self.assertTrue(self.on("Devotion Pour Homme", ["devotion-for-men-parfum"], "Dolce&Gabbana"))

    def test_transliteration_wobble(self):
        self.assertTrue(self.on("Qaa'ed", ["qaaed-al-shabaab"], "Lattafa"))

    def test_missing_perfume_is_not_found(self):
        self.assertFalse(self.on("Midnight Poison", ["poison-girl-eau-de-parfum", "hypnotic-poison"], "Dior"))


class ExactMatchTest(unittest.TestCase):
    """판매처 · 재출시 대조는 엄격하게 — 틀리면 아직 파는 향수가 확정 후보로 오른다."""

    def kind(self, a, b, brand="Brand", aliases=(), strict=False):
        toks = psc.brand_tokens(brand, aliases)
        return psc.match_kind(psc.exact_key(a, toks), psc.exact_key(b, toks), strict=strict)

    def test_play_for_her_is_not_play_for_men(self):
        self.assertIsNone(self.kind("Play For Her", "Givenchy Play For Men Eau de Toilette 100 Or 50 ML Spray", "Givenchy"))

    def test_play_intense_is_only_partial_for_play(self):
        self.assertEqual(self.kind("Givenchy Play Intense", "Givenchy Play For Men Eau de Toilette", "Givenchy"), "partial")
        self.assertEqual(self.kind("Givenchy Play Eau de Toilette", "Givenchy Play Eau de Toilette 100 ML", "Givenchy"), "exact")

    def test_gender_on_one_side_only_is_partial_for_confirmation(self):
        # 확정 후보(strict)는 한쪽만 성별을 적으면 사람이 봅니다. 재출시 의심은 너그럽게 exact
        self.assertEqual(self.kind("Raghba For Men", "raghba", "Lattafa", strict=True), "partial")
        self.assertEqual(self.kind("Raghba For Men", "raghba", "Lattafa"), "exact")
        self.assertEqual(self.kind("El Cielo Pour Homme", "EL CIELO MAN", "Armaf", strict=True), "exact")

    def test_numbers_in_names_stay_but_sizes_go(self):
        dior = ("Dior", ["Christian Dior"])
        self.assertEqual(self.kind("Fahrenheit 32", "Christian Dior FAHRENHEIT 32 vaulted eau de toilette 3.4 oz", *dior), "exact")
        self.assertEqual(self.kind("Fahrenheit", "Christian Dior Fahrenheit 32 Eau de Toilette 50 ml", *dior), "partial")

    def test_magie_is_not_magie_noire(self):
        self.assertEqual(self.kind("Magie", "magie-noire-eau-de-toilette", "Lancôme"), "partial")

    def test_concentration_keeps_editions_apart(self):
        # 2026-10-01 점검에서 실제로 잘못 붙던 짝들
        dior = ("Dior", ["Christian Dior"])
        self.assertEqual(self.kind("Midnight Poison Extrait de Parfum",
                                   "Christian Dior MIDNIGHT POISON vintage eau de parfum", *dior), "partial")
        self.assertEqual(self.kind("Midnight Poison Extrait de Parfum",
                                   "Christian Dior MIDNIGHT POISON vintage parfum", *dior), "exact")
        self.assertEqual(self.kind("Manifesto Le Parfum",
                                   "yves saint laurent ysl manifesto eau de parfum 50ml discontinued 2016",
                                   "Yves Saint Laurent", ["YSL"]), "partial")
        self.assertEqual(self.kind("Sikkim Parfum", "Lancôme SIKKIM vintage eau de toilette", "Lancôme"), "partial")

    def test_l_eau_is_part_of_the_name(self):
        # 재출시 의심은 exact 만 셉니다 — 'L'Eau' 가 남아 있으면 같은 향수로 보지 않습니다
        self.assertEqual(self.kind("White Musk For Men", "White Musk® L’Eau Eau De Toilette 30ml", "The Body Shop"),
                         "partial")
        self.assertEqual(self.kind("Guerlain Shalimar Parfum Initial L'Eau",
                                   "guerlain shalimar parfum initial eau de parfum 40ml discontinued", "Guerlain"),
                         "partial")

    def test_line_names_keep_two_editions_apart(self):
        self.assertEqual(self.kind("Organza Indécence",
                                   "givenchy organza indecence edp 100ml 2011 les parfums mythiques discontinued",
                                   "Givenchy"), "partial")


class EvidenceTest(unittest.TestCase):

    def evidence(self, text, title, brand="Brand", require_name=False):
        toks = psc.brand_tokens(brand)
        return psc.text_evidence(text, psc.exact_key(title, toks), toks, require_name=require_name)

    def test_product_sentence_counts(self):
        self.assertTrue(self.evidence("A warm amber. It is now discontinued.", "Guerlain MY INSOLENCE", "Guerlain"))
        self.assertTrue(self.evidence("My Insolence is now discontinued.", "Guerlain MY INSOLENCE vaulted", "Guerlain"))

    def test_formula_size_and_replacement_do_not_count(self):
        self.assertIsNone(self.evidence("It is now discontinued in this older formula.", "Opium Poesie de Chine", "YSL"))
        self.assertIsNone(self.evidence("Opium Secret de Parfum was later discontinued and substituted by a reformulation.",
                                        "Opium Secret de Parfum", "YSL"))
        self.assertIsNone(self.evidence("Launched in 2018, a companion to the discontinued Individuel.", "Individual Tonic"))
        self.assertIsNone(psc.title_evidence("Dior Poison Eau de Toilette 30ml Discontinued Size"))
        self.assertIsNone(psc.title_evidence("Guerlain L'Heure Bleue EDP - 2021 Current Version - Now Discontinued"))

    def test_related_product_sentence_on_another_page_does_not_count(self):
        # Coucou 의 Aqva Amara 페이지 관련 상품 칸에 실제로 있던 문장
        page = "Bvlgari Aqva Amara EDT 50ml. Christian Dior Fahrenheit Absolute EDT 50ml Christian Dior Fahrenheit Absolute is a discontinued fragrance."
        self.assertIsNone(self.evidence(page, "Bvlgari Aqva Amara EDT 50ml", "Bvlgari", require_name=True))

    def test_own_named_sentence_counts(self):
        page = "Description Specifications Reviews Avon Casbah is a discontinued fragrance. Notes of amber."
        self.assertTrue(self.evidence(page, "Avon Casbah EDT 50ml", "Avon", require_name=True))


class RunTest(unittest.TestCase):
    """가짜 브랜드 하나 · 판매처 하나로 처음부터 끝까지."""

    CATALOG = {
        1: ("Moonlight", "Acme", 900.0),        # 공식 목록에 있음
        2: ("Old Rose", "Acme", 800.0),         # 공식 목록에 없음 -> 새 추정
        3: ("Tiny Batch", "Acme", 10.0),        # 평가자가 적어 보지 않음
        4: ("Amber Night", "Acme", 700.0),      # 이미 추정 -> 판매처 근거로 확정 후보
        5: ("Velvet", "Acme", 600.0),           # 이미 확정인데 공식 목록에 다시 보임
    }
    STATUS = [
        {"fragrantica_id": "4", "brand": "Acme", "name": "Amber Night", "status": "DISCONTINUED", "confidence": "LIKELY",
         "source_url": "https://acme.test/", "checked_at": "2026-10-01", "note": "공식 목록에 없음. 두 번째 근거 미확인"},
        {"fragrantica_id": "5", "brand": "Acme", "name": "Velvet", "status": "DISCONTINUED", "confidence": "CONFIRMED",
         "source_url": "https://shop.test/x", "checked_at": "2026-10-01", "note": "판매처 표기"},
    ]
    CONFIG = {
        "brands": [{"brand": "Acme", "source_url": "https://acme.test/", "note": "공식 목록에 없음",
                    "sources": [{"kind": "shopify", "base": "https://acme.test", "min": 2}]}],
        "retailers": [{"name": "vault", "label": "Vault", "kind": "shopify", "base": "https://vault.test",
                       "evidence": "description"}],
        "excluded": [{"name": "Parfumo", "reason": "믿을 수 없음"}],
    }

    def pages(self, official_status=200):
        return {
            "https://acme.test/robots.txt": (404, ""),
            "https://acme.test/products.json?limit=250&page=1": (
                official_status, shopify([{"title": "Moonlight Eau de Parfum", "handle": "moonlight"},
                                          {"title": "Velvet Eau de Toilette", "handle": "velvet"}])),
            "https://acme.test/products.json?limit=250&page=2": (200, shopify([])),
            "https://vault.test/robots.txt": (200, "User-agent: *\nDisallow: /cart\n"),
            "https://vault.test/products.json?limit=250&page=1": (200, shopify([
                {"title": "Acme AMBER NIGHT vaulted eau de parfum", "handle": "acme-amber-night", "vendor": "eBay",
                 "body_html": "<p>A smoky amber. It is now discontinued.</p>"},
                {"title": "Acme OLD ROSE eau de toilette", "handle": "acme-old-rose", "vendor": "eBay",
                 "body_html": "<p>Old Rose is a discontinued size.</p>"}])),
            "https://vault.test/products.json?limit=250&page=2": (200, shopify([])),
        }

    def run_check(self, pages):
        f, site = fetcher(pages)
        return psc.run(self.CONFIG, self.CATALOG, [dict(r) for r in self.STATUS], f, "2026-11-01"), site

    def test_end_to_end(self):
        result, _ = self.run_check(self.pages())
        self.assertEqual([r["fragrantica_id"] for r in result.new_likely], ["2"])
        self.assertEqual([(c["fragrantica_id"], c["match"]) for c in result.confirm], [("4", "exact")])
        self.assertEqual([r["fragrantica_id"] for r in result.reappeared], ["5"])

        with tempfile.TemporaryDirectory() as tmp:
            out = psc.write_outputs(result, self.STATUS, tmp, *(psc.dt.datetime(2026, 11, 1, 4),) * 2)
            for name in ("report.md", "confirm_candidates.csv", "new_likely.csv", "reappeared.csv",
                         "sources.csv", "perfume_status.proposed.csv"):
                self.assertTrue((out / name).exists(), name)
            proposed = {r["fragrantica_id"]: r for r in psc.load_status(out / "perfume_status.proposed.csv")}
        # 추정은 확정으로, 새 추정은 덧붙고, 재출시 의심 줄은 지우지 않는다
        self.assertEqual(proposed["4"]["confidence"], "CONFIRMED")
        self.assertEqual(proposed["4"]["source_url"], "https://vault.test/products/acme-amber-night")
        self.assertNotIn("두 번째 근거 미확인", proposed["4"]["note"])
        self.assertIn("Acme AMBER NIGHT vaulted eau de parfum", proposed["4"]["note"])   # 주소가 바뀌어도 근거를 알게
        self.assertEqual(proposed["2"]["confidence"], "LIKELY")
        self.assertEqual(proposed["5"]["confidence"], "CONFIRMED")

    def test_blocked_brand_gives_no_new_likely(self):
        result, _ = self.run_check(self.pages(official_status=403))
        self.assertEqual(result.new_likely, [])
        self.assertEqual(result.sources[0]["status"], "blocked")

    def test_almost_everything_missing_means_the_listing_broke(self):
        pages = self.pages()
        pages["https://acme.test/products.json?limit=250&page=1"] = (200, shopify(
            [{"title": "Gift Card", "handle": "gift-card"}, {"title": "Tote Bag", "handle": "tote"}]))
        result, _ = self.run_check(pages)
        self.assertEqual(result.new_likely, [])
        self.assertTrue(any(s["status"] == "too_few" for s in result.sources))

    def collected_config(self):
        config = json.loads(json.dumps(self.CONFIG))
        config["brands"][0]["sources"] = [{"kind": "sitemap", "urls": ["https://acme.test/sitemap.xml"],
                                           "include": "/p/", "name": "/p/([^/]+?)-\\d+\\.html", "min": 2}]
        return config

    def run_with_listing(self, header):
        pages = self.pages()
        pages["https://acme.test/sitemap.xml"] = (403, "<title>Access Denied</title>")
        with tempfile.TemporaryDirectory() as tmp:
            Path(tmp, "acme.txt").write_text(
                f"{header}\nhttps://acme.test/p/moonlight-eau-de-parfum-11.html\n"
                "https://acme.test/p/velvet-eau-de-toilette-12.html\nhttps://acme.test/about\n", encoding="utf-8")
            f, _ = fetcher(pages)
            return psc.run(self.collected_config(), self.CATALOG, [dict(r) for r in self.STATUS], f,
                           "2026-11-01", skip_retailers=True, listings_dir=tmp)

    def test_blocked_source_is_filled_from_a_fresh_browser_listing(self):
        result = self.run_with_listing("# collected 2026-10-20 https://acme.test")
        self.assertEqual(result.sources[0]["status"], "collected")
        self.assertEqual([r["fragrantica_id"] for r in result.new_likely], ["2"])
        self.assertEqual([r["fragrantica_id"] for r in result.reappeared], ["5"])

    def test_stale_browser_listing_is_not_used(self):
        result = self.run_with_listing("# collected 2026-08-01 https://acme.test")
        self.assertEqual(result.sources[0]["status"], "blocked")
        self.assertIn("일 전 목록", result.sources[0]["detail"])
        self.assertEqual(result.new_likely, [])

    def test_shipped_config_is_well_formed(self):
        config = json.loads(psc.DEFAULT_SOURCES.read_text(encoding="utf-8"))
        for entry in config["brands"]:
            self.assertIn("brand", entry)
            if entry.get("unsupported"):
                continue
            self.assertTrue(entry["source_url"].startswith("https://"), entry["brand"])
            self.assertTrue(entry["note"], entry["brand"])
            for source in entry["sources"]:
                self.assertIn(source["kind"], {"sitemap", "shopify", "html"}, entry["brand"])
        for retailer in config["retailers"]:
            self.assertIn(retailer["kind"], {"sitemap", "shopify", "pages"}, retailer["name"])


if __name__ == "__main__":
    logging.disable(logging.WARNING)
    unittest.main()
