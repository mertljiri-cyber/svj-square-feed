# SVJ Square Feed – předávací balíček

Verze 1.0 • 7. 11. 2026 • pracovní návrh pro vývoj a schválení vlastníkem produktu.

Repozitář: [mertljiri-cyber/svj-square-feed](https://github.com/mertljiri-cyber/svj-square-feed). Ověřená větev `main`, commit `d9e67ec92fda83c2fef627f17f2d8e1690bb894c` z 28. 12. 2025, 14:57:01 UTC. Kontrola byla pouze pro čtení. Tento balíček neobsahuje změny aplikace, spustitelné migrace ani provedený import.

## Co předáváme

Zadání rozvoje informačního systému SVJ, které zachovává Lovable, React/TypeScript a Supabase. První dodávka: zabezpečení a role → dokumentový archiv → technický registr a plán oprav → požadavky a komunikace. Poté AI, hospodaření a režim fyzického shromáždění. Oficiální per rollam je poslední, samostatně podmíněná etapa.

## Jak dokumentaci použít

1. Rozbalte ZIP mimo existující checkout a začněte auditem a PRD.
2. Do lokálního projektu lze později převzít celý tento adresář například jako `docs/svj/`. Původní README projektu nepřepisujte.
3. Soubor `AGENTS.proposed.md` je návrh instrukcí: slučte jej s případným existujícím `AGENTS.md`, až zadáte implementaci. Nyní nic automaticky neaktivuje.
4. Coding agent nejprve porovná aktuální HEAD s auditovaným commitem. Rozdíly zanese do nového auditu před implementací.
5. Jako první zadání použijte prompt v `12_PRVNI_IMPLEMENTACNI_BALIK.md`. Vývoj, aplikace migrací, GitHub push a publikace jsou samostatné operace. Tento balíček je neprovádí.

## Mapa souborů

| Soubor | Účel |
|---|---|
| [00_STAV_A_ZDROJE.md](00_STAV_A_ZDROJE.md) | Ověřený kód, bezpečnostní nálezy, hranice ověření a zdroje |
| [01_PRD.md](01_PRD.md) | Cíle, uživatelé, rozsah a měřitelné cíle pilotu |
| [02_ROADMAPA.md](02_ROADMAPA.md) | Pořadí dodávek, závislosti a brány dokončení |
| [03_ARCHITEKTURA.md](03_ARCHITEKTURA.md) | Cílová architektura a přechod ze současného řešení |
| [04_DATOVY_MODEL.md](04_DATOVY_MODEL.md) | Tabulky, vazby, invarianty a transakční hranice |
| [05_SPECIFIKACE_MODULU.md](05_SPECIFIKACE_MODULU.md) | Obrazovky, pracovní postupy, stavy a pravidla modulů |
| [06_BACKLOG_A_AKCEPTACE.md](06_BACKLOG_A_AKCEPTACE.md) | Implementační balíky s ID, závislostmi a akceptací |
| [07_BEZPECNOST_A_OPRAVNENI.md](07_BEZPECNOST_A_OPRAVNENI.md) | Matice přístupů, RLS, soubory, audit a provoz |
| [08_AI_A_RAG.md](08_AI_A_RAG.md) | Ingest, oprávněné vyhledávání, citace a hodnocení AI |
| [09_IMPORT_TECHNICKEHO_EXCELU.md](09_IMPORT_TECHNICKEHO_EXCELU.md) | Úplné mapování skutečného sešitu a importní kontrakt |
| [10_TESTOVANI_A_RELEASE.md](10_TESTOVANI_A_RELEASE.md) | Scénáře ověření, pilot a návrat po chybě |
| [11_ROZHODNUTI_A_OTAZKY.md](11_ROZHODNUTI_A_OTAZKY.md) | Návrhová rozhodnutí, neznámé vstupy a odpovědnosti |
| [12_PRVNI_IMPLEMENTACNI_BALIK.md](12_PRVNI_IMPLEMENTACNI_BALIK.md) | Konkrétní první zadání pro coding agenta |
| [AGENTS.proposed.md](AGENTS.proposed.md) | Instrukce pro další implementaci |
| [prilohy/EXCEL_INVENTAR.md](prilohy/EXCEL_INVENTAR.md) | Skutečné technické položky, listy a validační seznamy |
| [prilohy/REPO_INVENTAR.md](prilohy/REPO_INVENTAR.md) | Úplný strom repozitáře a identifikace přečtených souborů |
| [prilohy/SCENARE_PILOTU.md](prilohy/SCENARE_PILOTU.md) | Uživatelský průchod od závady přes opravu po podklady |
| [BALICEK_MANIFEST.md](BALICEK_MANIFEST.md) | Obsah ZIP, kontrolní otisky a kontrola dokumentace |

## Jak číst stav

- **DOLOŽENO KÓDEM:** přítomnost nebo konkrétní chování ve zdrojích daného commitu. Neprokazuje nasazení ani správnou funkci v produkci.
- **DOLOŽENO EXCELEM:** přečtená hodnota, struktura nebo vzorec původního sešitu. Neprokazuje skutečný technický stav budovy.
- **KONTEXT DISKUSE:** požadavek nebo tvrzení z předchozího chatu. Bez primárního dokladu nejde o ověřený fakt o SVJ.
- **NÁVRH:** cílová funkce, tabulka, pravidlo či proces. V aktuálním kódu nemusí existovat a vyžaduje implementaci.
- **NEOVĚŘENO:** nasazení, živá databáze, práva v prostředí, provozní a právní skutečnosti, které nebyly kontrolovány.

Všechny cílové specifikace v souborech 01–12 a instrukce agentům jsou **NÁVRH**, pokud odkaz na audit výslovně neříká jinak. Priority vývoje `P0–P4` a technické priority prvků `P1–P5 / Sledovat` jsou dvě různá pole.

## Důležité výsledky ověření

Kód obsahuje novinky, záměry a formuláře. Neobsahuje hotové přihlašování, archiv, technický registr, komunikaci, AI, hospodaření ani režim schůze. Migrace má široká veřejná oprávnění; provoz se skutečnými neveřejnými daty je podmíněn bezpečnostní etapou.

Původní Excel byl nalezen a přečten: `Technicky_registr_SVJ_Pod_Trebesinem.xlsx`. Má 5 listů, 21 pojmenovaných technických prvků a 4 rezervní ID. Všech 21 pojmenovaných prvků má stav „Nezjištěno“, bez doložených hodnocení, termínů a nákladů; plán oprav je prázdný. List „Závazný rámec“ je návrh, jeho schválení není vyplněno. Podrobnosti a kontrolní otisk jsou v importní specifikaci.

Původní Excel, osobní dokumenty, fotografie, zdrojové soubory aplikace a `.env` nejsou součástí ZIP. Nejde o zálohu aplikace ani databáze. Živý web a Supabase prostředí nebyly testovány; nepřebíráme právní závěry minulého chatu jako ověřené požadavky.
