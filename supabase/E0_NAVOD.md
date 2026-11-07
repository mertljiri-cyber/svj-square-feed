# E0 – bezpečný základ: návod a stav ověření

Větev `e0-bezpecnost`. Původní migrace `20251228145052` nebyla změněna (SHA-256 `25971dc3…b6af`, ověřeno testem).

## Spuštění testů

```bash
npm install
npm test
```

Testy běží nad PGlite (PostgreSQL 17) s napodobeninou rolí `anon`/`authenticated`, `auth.uid()` a výchozích grantů Supabase. Ověřují RLS, granty, RPC, triggery, audit a obnovu.

**Co testy neprokazují:** skutečný Supabase Auth (e-mail, potvrzení, reset hesla), PostgREST, Storage, Lovable build a nasazení. Ty vyžadují testovací projekt.

## Migrace

| Soubor | Obsah | Karta |
|---|---|---|
| `20261107120000_e0_identity_roles_audit.sql` | organizace, profily, členství, role, delegace, pozvánky, audit, RPC členství | SEC-02, SEC-03, SEC-05 |
| `20261107120100_e0_close_public_policies.sql` | odstranění `USING(true)` a `WITH CHECK(true)`, backfill na pilotní SVJ, chráněné sloupce, validace formulářů, povolené přechody záměrů, RPC `submit_intent`, `submit_form`, `change_intent_status` | SEC-04, SEC-05 |

Backfill přiřadí stávající řádky k zástupné organizaci `00000000-0000-4000-8000-000000000001`. Její název musí správce doplnit. Historická podání zůstávají bez autora.

## Výsledky testů

| Test | Výsledek |
|---|---|
| T-SEC-01 anon čte jen veřejné publikované novinky | prošel |
| T-SEC-02 anon nečte interní data a nevkládá záznamy | prošel |
| T-SEC-03 vlastník nemění role, organizaci, autora, stav | prošel |
| T-SEC-04 jiné SVJ nevidí ani nepropojí data | prošel |
| T-SEC-05 pozastavený a čekající člen nečte interní data | prošel |
| T-SEC-06 konflikt verze, povolené přechody, nedělitelný audit | prošel |
| Pozvánky (přijetí, expirace, použití, odvolání, e-mail) | prošel |
| T-OPS-01 záloha a obnova do izolované kopie, počty a otisky | prošel |
| Kontrola serverového klíče v `src` a `dist` | prošel |

Build (`npm run build`), TypeScript (`tsc -p tsconfig.app.json`) a lint nových souborů prošly.

## Frontend

- `src/features/auth/` – kontext přihlášení, ochrana obsahu pro členy.
- `/prihlaseni` – přihlášení, registrace, přijetí pozvánky z fragmentu URL.
- `/clenove` – výbor schvaluje členství, přidělí role, vytvoří pozvánku (odkaz se zobrazí jednou).
- Záměry a formuláře vyžadují přihlášení; odeslání jde přes RPC s validací na serveru.

## Co zůstává otevřené (neověřeno nebo rozhodnutí vlastníka)

1. **Testovací Supabase projekt** – migrace se na něj zatím neaplikovaly. Nasazení čeká na pokyn.
2. **Regenerace typů** – `src/integrations/supabase/types.ts` je upraven ručně (RPC a sloupec `forms.organization_id`). Po nasazení je nutné vygenerovat znovu.
3. **Bootstrap prvního výboru** – funkce `app.bootstrap_first_board` existuje, ale spouští ji provozní správce ručně. Rozhodnutí O02 je otevřené.
4. **Kontrola `.env`** – soubor je v repozitáři (`git log` ukazuje commit `b3f25c9`). Hodnoty jsou veřejný publishable klíč s rolí `anon`, ale tato kontrola nebyla kompletně provedena a případná rotace zůstává v rozhodnutí vlastníka.
5. **Veřejné formuláře a záměry** – podle návrhu nejsou čitelné anonymně. Pokud má být některý formulář veřejný, je to změna politiky a musí ji schválit výbor.
6. **Prototyp (E2/E3)** – stránky registru, plánu oprav a požadavků zůstávají nezměněné a bez vazby na databázi.
7. **Zálohy a obnova v produkci (SEC-07)** – ověřena je pouze syntetická obnova PGlite. Retence, RPO/RTO a odpovědná osoba jsou neurčené.

## Kontrolní formulář předání implementace

| Pole | Hodnota |
|---|---|
| Výchozí HEAD / výsledný commit | `d9e67ec92fda83c2fef627f17f2d8e1690bb894c` → `9a2e49a` (větev `e0-bezpecnost`) plus následný commit s testem EXECUTE, pokud byl vytvořen |
| Dokončené karty | SEC-01 (částečně: lokální baseline, bez testovacího Supabase), SEC-02, SEC-03, SEC-04, SEC-05 lokálně ověřeno. SEC-06 a SEC-07 částečně |
| Změněné tabulky a politiky | Nové: organizations, profiles, memberships, membership_roles, scoped_grants, invitations, audit_events. Změněné: news, intents, forms, form_submissions, settings (sloupce, granty po sloupcích, nové politiky, staré `USING(true)`/`WITH CHECK(true)` odstraněny) |
| Provedené testy a prostředí | `npm test`: 39 testů, PGlite (PostgreSQL 17), syntetické role. `tsc`, `vite build`, `eslint` bez chyb. Datum 7. 11. 2026 |
| Neprovedené kontroly | Skutečný Supabase Auth, PostgREST, Storage, MFA, reset hesla, limity na úrovni Auth, test v prohlížeči. Dopad: pokrytí RLS je ověřené, tok přihlášení nikoli |
| Nasazení | Pouze lokálně. Testovací ani produkční Supabase nedotčeny, nic nepublikováno |
| Vrácení změny | Migrace jsou inkrementální. Zpět lze vrátit zálohou DB před aplikací; obnovení veřejných politik se nesmí používat jako návrat. Postup obnovy ověřen pouze na syntetické DB (T-OPS-01) |
| Zbývající vstupy | O01, O02, O03, O04 (viz 11_ROZHODNUTI_A_OTAZKY.md). Dále rozhodnutí, zda mají být některé formuláře veřejné |

### SEC-06 – klasifikace `.env`

Soubor obsahuje tři klíče: `VITE_SUPABASE_PROJECT_ID`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`. Publishable klíč je JWT s rolí `anon` a odkazem na stejný projekt jako URL, tedy veřejná konfigurace, ne serverový secret. V historii Gitu je soubor v jediném commitu (`b3f25c9`) a obsahuje jen tytéž tři názvy. Serverový klíč (`service_role`) není v `src` ani v build výstupu, což hlídá test. Rotace není na základě těchto nálezů nutná. Soubor generuje Lovable, proto jsem ho nevyjímal z verzování.
