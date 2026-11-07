# Aktuální stav, důkazy a hranice ověření

Datum kontroly: 7. 11. 2026, Europe/Prague. Režim: pouze čtení GitHubu a podkladů. Žádný zápis do repozitáře, databáze nebo Lovable.

## 1. Identifikace zdrojového stavu

Repozitář je podle připojeného GitHubu privátní, výchozí větev `main`. [Ověřený commit](https://github.com/mertljiri-cyber/svj-square-feed/commit/d9e67ec92fda83c2fef627f17f2d8e1690bb894c) je `d9e67ec92fda83c2fef627f17f2d8e1690bb894c`, zpráva „Fix utils helpers“, datum 28. 12. 2025 14:57:01 UTC. Větev byla ověřena přes read-only endpoint `/branches/main`. Kořenový Git tree: `529fe98e81452e94c6faae533c305818d6d77e10`. Rekurzivní výpis tohoto stromu není zkrácen. Úplný seznam cest a blob SHA je v [inventáři](prilohy/REPO_INVENTAR.md).

Přehled níže je statický audit, nikoliv výsledek běhu aplikace. Název větve ani datum commitu neprokazují verzi nasazeného webu.

## 2. Co je doloženo kódem

Všechny následující odkazy jsou připnuty k témuž commitu.

| ID | Zjištění | Zdroj |
|---|---|---|
| K01 | React `^18.3.1`, TS `^5.8.3`, Vite `^5.4.19`, Supabase JS `^2.89.0`, TanStack Query, React Router, Tailwind a shadcn/Radix. Jde o rozsahy z manifestu, ne o ověření běžící verze. | [package.json](https://github.com/mertljiri-cyber/svj-square-feed/blob/d9e67ec92fda83c2fef627f17f2d8e1690bb894c/package.json) |
| K02 | Routy `/`, `/novinky`, `/novinky/:id`, `/zamery`, `/zamery/:id`, `/formulare`, `/formulare/:id` a fallback. Není zde autentizační provider ani chráněná routa. | [App.tsx, ř. 16–36](https://github.com/mertljiri-cyber/svj-square-feed/blob/d9e67ec92fda83c2fef627f17f2d8e1690bb894c/src/App.tsx#L16-L36) |
| K03 | Dashboard čte úvodní text a poslední tři publikované novinky; novinky mají výpis, detail, klientské hledání v názvu/perexu a štítky. | [Index.tsx](https://github.com/mertljiri-cyber/svj-square-feed/blob/d9e67ec92fda83c2fef627f17f2d8e1690bb894c/src/pages/Index.tsx), [News.tsx](https://github.com/mertljiri-cyber/svj-square-feed/blob/d9e67ec92fda83c2fef627f17f2d8e1690bb894c/src/pages/News.tsx) |
| K04 | Záměry se čtou ze Supabase, mají filtr stavu a priority a detail. Stavy jsou navrh, projednava-se, schvaleno, realizace, hotovo. | [Intents.tsx](https://github.com/mertljiri-cyber/svj-square-feed/blob/d9e67ec92fda83c2fef627f17f2d8e1690bb894c/src/pages/Intents.tsx), migrace |
| K05 | Aktivní formuláře mají dynamická pole. `submit_target=intent` vytváří záměr; feedback a survey ukládají JSON do `form_submissions`. Validace povinných polí je v UI. | [FormDetail.tsx, ř. 43–103](https://github.com/mertljiri-cyber/svj-square-feed/blob/d9e67ec92fda83c2fef627f17f2d8e1690bb894c/src/pages/FormDetail.tsx#L43-L103) |
| K06 | Jediná migrace vytváří `news`, `intents`, `forms`, `form_submissions`, `settings`, RLS a demonstrační data. Totéž jádro obsahují generované typy. | [migrace](https://github.com/mertljiri-cyber/svj-square-feed/blob/d9e67ec92fda83c2fef627f17f2d8e1690bb894c/supabase/migrations/20251228145052_0fdf8dda-684b-492a-a2a0-2c749ed128ee.sql), [types.ts](https://github.com/mertljiri-cyber/svj-square-feed/blob/d9e67ec92fda83c2fef627f17f2d8e1690bb894c/src/integrations/supabase/types.ts) |
| K07 | Supabase klient používá `VITE_SUPABASE_URL` a `VITE_SUPABASE_PUBLISHABLE_KEY`; persistence session v localStorage je nakonfigurována, ale sama není implementací přihlášení. | [client.ts](https://github.com/mertljiri-cyber/svj-square-feed/blob/d9e67ec92fda83c2fef627f17f2d8e1690bb894c/src/integrations/supabase/client.ts) |
| K08 | Skripty dev, build, build:dev, lint a preview. Chybí test skript, testy i CI workflow v kontrolovaném stromu. Aplikační TS má `strict=false`. | package.json, [tsconfig.app.json](https://github.com/mertljiri-cyber/svj-square-feed/blob/d9e67ec92fda83c2fef627f17f2d8e1690bb894c/tsconfig.app.json), inventář |
| K09 | README je obecná šablona Lovable s `REPLACE_WITH_PROJECT_ID`. Strom obsahuje `package-lock.json` i `bun.lockb` a také `.env`. Obsah `.env` nebyl načten. | [README](https://github.com/mertljiri-cyber/svj-square-feed/blob/d9e67ec92fda83c2fef627f17f2d8e1690bb894c/README.md), inventář |
| K10 | V tomto stromu nejsou implementační soubory archivu, technického registru, AI, financí, chatových vláken, schůze, Edge Functions ani Storage migrací. Neexistuje ani AGENTS.md. | úplný inventář + routy + jediná migrace |

## 3. Bezpečnostní a funkční nálezy

| ID / priorita vývoje | Důkaz | Dopad a navržená náprava |
|---|---|---|
| F01 / P0 | Migrace ř. 64–67: `SELECT USING (true)` u news, intents, forms a settings. | Databázová politika nerozlišuje publikaci ani neveřejný obsah. Filtr `status=published` v UI nezabrání přímému API čtení konceptů při odpovídajících grantech. Zavést klasifikaci a zúžit RLS. Živá oprávnění a případný únik nebyly testovány. |
| F02 / P0 | Migrace ř. 70–71: veřejný INSERT podání a záměrů s `WITH CHECK (true)`. | Obejítím UI lze podle politiky vložit i stav/priority záměru, které UI samo nenabízí. Hrozí spam a nedůvěryhodná data. Odstranit široké politiky, vyžadovat aktivní členství, serverovou validaci a povolené přechody. |
| F03 / P0 | K02, K06, K07. Chybí propojení uživatel–SVJ–jednotka a role. | Nelze spolehlivě vynucovat přístup vlastníků ani autorství. Zavést účty, schvalované členství a odvolatelné role. |
| F04 / P1 | K05; v migraci pro `form_submissions` není SELECT politika ani author ID. | Podání se v UI uloží, avšak zde není pracovní schránka pro výbor, vlastník podání ani evidence vyřízení. Není to důkaz veřejného čtení podání; to migrace nepovoluje. Doplnit řízenou migraci do požadavků. |
| F05 / P1 | FormDetail ř. 154–158 slibuje předání výboru. Ve stromu není notifikační implementace. | Text UI není důkaz doručení e-mailu ani zpracování požadavku. Navrhnout outbox a evidenci doručení. |
| F06 / P0 | `.env` je ve stromu, obsah nečten. | Provést omezenou kontrolu názvů a typu hodnot a historie při implementaci. Publishable klíč není sám tajný serverový klíč. Nelze tvrdit, že unikl secret, dokud není klasifikován; případné secrets rotovat. |
| F07 / P1 | `updated_at DEFAULT now()` bez update triggeru v migračním souboru. | Default nezaručuje změnu času při UPDATE; doplnit serverový timestamp a audit. |
| F08 / P0 | K08, chybí testy a CI ve stromu. | Bezpečnostní změnu podmínit API/RLS integračními testy, ne jen sestavením frontendu. |

Nález popisuje zdrojovou politiku. Databázové grants, aktuální RLS, Auth nastavení, soubory v úložišti a další ruční zásahy v Supabase nebyly dostupné k ověření.

## 4. Excel a konverzace

**DOLOŽENO EXCELEM:** původní soubor `/Users/Jiri.Mertl/Documents/SVJ/Technicky_registr_SVJ_Pod_Trebesinem.xlsx`, SHA-256 `fe6fdd440de42db10b3c0a58cd7d2078ec9be4fb737f38b3498d0ecf720b6515`. Přečteny všechny neprázdné řádky, vzorce, uložené hodnoty přehledu a seznamové validace. Sešit nebyl změněn ani přepočítán v Excelu. Viz [import](09_IMPORT_TECHNICKEHO_EXCELU.md).

**KONTEXT DISKUSE:** načten chat „Rozvoj informačního systému SVJ“, ID `6aef728c-ce4c-83eb-b4c6-7383e642f7a6`, dostupné čtyři turny, bez příloh v odpovědi nástroje. Převzaty cíle, propojení modulů a požadavek zachovat režim schůze; poslední zadání určuje prioritu schůze po AI a hospodaření. Dřívější tvrzení o 25 oblastech je zpřesněno Excelem na 21 pojmenovaných položek a 4 rezervy. Počet 29 jednotek, 3 vchody a jméno správce Pragostav zůstávají kontextem k potvrzení, nikoliv daty pro automatický seed.

Dřívější právní citace nejsou přenosnými primárními zdroji. Stanovy, vlastnické podíly, plné moci ani rozhodovací většiny se z chatu automaticky nepřebírají. Nalezené jiné osobní tabulky na Disku nebyly použity jako náhrada registru.

V místních `podklady/` jsou též 3D HTML prohlížeč, fotografie a PDF prohlášení vlastníka. Jejich obsah nebyl pro toto zadání analyzován; balíček z nich neodvozuje geometrii domu, rozsah společných částí, seznam vlastníků ani právní pravidla. Před převzetím těchto údajů je nutná samostatná kontrola.

## 5. Technické reference

Přečtené primární zdroje, stav přístupu 7. 11. 2026. Použity pro cílový návrh, ne jako důkaz konfigurace projektu:

- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security): oprávnění musí platit i při přímém API přístupu; privilegovaný serverový klíč není pro frontend.
- [Storage access control](https://supabase.com/docs/guides/storage/security/access-control): úložiště vyžaduje vlastní přístupová pravidla.
- [Securing Edge Functions](https://supabase.com/docs/guides/functions/auth): uživatelský endpoint ověřuje identitu a používá klienta v kontextu volajícího.
- [RAG with permissions](https://supabase.com/docs/guides/ai/rag-with-permissions): vyhledávání musí respektovat přístup uživatele ke zdrojům.

Konkrétní SDK syntaxi, limity a autentizační konfiguraci znovu ověřit při implementaci vůči tehdejším verzím.

## 6. Co tato kontrola neprokazuje

Nebyly spouštěny build, lint, testy aplikace, migrace, penetrace, přihlášení, upload, AI ani hlasování. Nebyl kontrolován živý web `https://svj-square-feed.lovable.app`, projekt Lovable, produkční data, zálohy, e-mailový poskytovatel, právní platnost stanov nebo schválení registru. Tyto položky jsou **NEOVĚŘENO**, nikoliv „hotovo“ nebo „nefunguje“.
