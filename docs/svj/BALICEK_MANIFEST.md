# Manifest předávacího balíčku

Verze 1.0, 7. 11. 2026. Balíček obsahuje 19 souborů Markdown v jednom adresáři. Samotný tento manifest je z výpočtu níže vynechán, aby nevznikla kruhová závislost kontrolního otisku.

## Provedené kontroly dokumentace

- Všech 18 obsahových souborů má neprázdný obsah a uzavřené bloky kódu.
- Lokální Markdown odkazy mezi obsahovými soubory vedou na existující soubory.
- Backlog obsahuje 32 unikátních karet a odpovídá etapám SEC/DOC/TEC/REQ/AI/FIN/MTG/VOT.
- Inventář a importní očekávání byly porovnány s přečtenými řádky Excelu: 25 ID, 21 pojmenovaných prvků, 4 rezervy, 21 explicitních unknown a 0 akcí oprav.
- SHA-256 původního Excelu byl před sestavením ZIP znovu ověřen beze změny.
- ZIP byl po vytvoření zkontrolován na integritu a bajtovou shodu obsahu s těmito soubory.

Tyto kontroly ověřují dokumentaci a archiv. Nebyly spouštěny testy aplikace, migrace, živý web, produkční oprávnění ani právní posouzení. Návrhy v dokumentech nejsou provedené implementace.

## Obsah a SHA-256

| Relativní cesta | Bajtů | SHA-256 |
|---|---|---|
| [00_STAV_A_ZDROJE.md](00_STAV_A_ZDROJE.md) | 9765 | `7825e72c17352f421d8d7641fb663d5e07cffc112441da0f48803b28f731d5f4` |
| [01_PRD.md](01_PRD.md) | 5869 | `7d6e3d06015040cef567293dda4a8a1cb7cc8a62b17e3a30cfc7f8da811a5439` |
| [02_ROADMAPA.md](02_ROADMAPA.md) | 3984 | `fd47d7f116a61ceb3c4f71b433f10371a02cd92c5a1a5dcc40dc911ed0b792d4` |
| [03_ARCHITEKTURA.md](03_ARCHITEKTURA.md) | 7218 | `f2e31d60306d3d912c85a374f1143f91482d237ff6df287843c22d5dbcb0326e` |
| [04_DATOVY_MODEL.md](04_DATOVY_MODEL.md) | 11979 | `78acd11b5f304a027e9c58b1a281e430be5bc9b33047c96a55e5625e218486cb` |
| [05_SPECIFIKACE_MODULU.md](05_SPECIFIKACE_MODULU.md) | 10682 | `d9c5d8743e4d5c873f5f063116fca34c79b8d031328c6269190f30850ed38ebf` |
| [06_BACKLOG_A_AKCEPTACE.md](06_BACKLOG_A_AKCEPTACE.md) | 14096 | `63e3478253f374b08a12dc3a999ba36efa0136e1b3524aa58292fca7a405fd09` |
| [07_BEZPECNOST_A_OPRAVNENI.md](07_BEZPECNOST_A_OPRAVNENI.md) | 7577 | `efcd7c302c50d433f75ae5de52a67d164c6b0c1c136d251b87227e17e05c00bb` |
| [08_AI_A_RAG.md](08_AI_A_RAG.md) | 6703 | `0adbfd5f62fba8cfc4a21d8456036f9a41c2c9dd543d2b698f039f5bf3f94315` |
| [09_IMPORT_TECHNICKEHO_EXCELU.md](09_IMPORT_TECHNICKEHO_EXCELU.md) | 12482 | `630b654dd5dc90dc88a8e64f55edf6aee76432e2bc05b13db2cd5a2bc3391f19` |
| [10_TESTOVANI_A_RELEASE.md](10_TESTOVANI_A_RELEASE.md) | 7153 | `534d1db2b85a178ad133f5ad337c1cfadb758f58b0ea5e4659ef1034061412fb` |
| [11_ROZHODNUTI_A_OTAZKY.md](11_ROZHODNUTI_A_OTAZKY.md) | 4743 | `8ffc9cc68f0586060737a5b0165a034a91ab65b55db64580db6115fc30852116` |
| [12_PRVNI_IMPLEMENTACNI_BALIK.md](12_PRVNI_IMPLEMENTACNI_BALIK.md) | 3176 | `42c65b2c011dc632805e00983294727e07b7d7eea6f954180bce131ac41d6b2d` |
| [AGENTS.proposed.md](AGENTS.proposed.md) | 3944 | `0dbf8a62c2eb757a5dfe440092e0eb3f115d1ad65bbf232340d855e4a5087e91` |
| [README.md](README.md) | 5560 | `d102d3454f34b3bbbd23ca082920c62461c179ea89a73964d66d7bc19ddce2aa` |
| [prilohy/EXCEL_INVENTAR.md](prilohy/EXCEL_INVENTAR.md) | 7831 | `294420fb4898f5f9ac92cbcd8138745569fc1ef469fc7e2ad8bd379a30334bff` |
| [prilohy/REPO_INVENTAR.md](prilohy/REPO_INVENTAR.md) | 13018 | `cd7e3e7f1784ab0b9adb770077d649907e085e3fc60c4c7f7f10c8870a5457c0` |
| [prilohy/SCENARE_PILOTU.md](prilohy/SCENARE_PILOTU.md) | 3561 | `2b2748464850d422c881aa349741da5239a5bc27420d3f20920f34372ccfe895` |

## Rozsah distribuce

Obsahuje pouze dokumentaci. Neobsahuje původní Excel, zdrojový kód aplikace, konfiguraci `.env`, přístupové údaje, fotografie, osobní PDF ani jiné soubory pracovního adresáře. Nepřepisuje existující projektové README ani AGENTS.md. Doporučené převzetí je do `docs/svj/` po rozbalení a kontrole.
