# Lokální noční UAT — pouze syntetická data

## Spuštění

Z této izolované pracovní kopie spusťte jediný příkaz:

    npm run local

Příkaz sestaví `dist-fixtures` a spustí Vite preview pouze na `http://127.0.0.1:4174/` (strictPort). Pokud už na tomto portu běží předchozí náhled, stačí adresu otevřít. Pro samotný build slouží `npm run local:build`, pro již hotový build `npm run local:preview`. Proces patří terminálu; přežití konce agentovy relace není garantováno. Žádná služba, cron ani globální instalace se nevytváří.

Závislosti byly instalovány `npm ci --offline --ignore-scripts`. Lokální režimy nenačítají repo `.env`; Vite aliasuje skutečný auth a Supabase klient pouze pro `local-fixtures`. Normální režim žádné testovací identity nepoužívá. Testovací role nejsou autentizace ani bezpečnostní mechanismus. Mimo loopback se demo nezobrazí.

## Co je skutečné a co mock

Skutečné komponenty: Index, Header, AskHouse/HouseChat, správa metadat zdrojů, technický registr/detail, existující formulář požadavku a seznam/detail požadavků. Skutečné jsou i navigace, předvyplnění, stavové přechody UI, zpracování retry a výběr přesné citace.

Simulované: přihlášení/role, Supabase síťový klient, odpověď AI a zdrojové texty. V registru je pouze SYN-001. Požadavky a audit jsou pouze v paměti JS a zmizí při obnovení stránky. Nepodporované části aplikace mají explicitní vysvětlení, nikoliv fiktivní úspěch. Do výběru souboru používejte jen syntetické .md; mock publikování není implementováno a vrací chybu. Žádná data se neposílají do skutečného backendu, AI ani wiki.

Odděleně se `npm test` spouští skutečné PostgreSQL RPC, RLS a migrace v lokálním PGlite s umělými uživateli a SVJ. To je integrační důkaz oprávnění, nikoliv běžící Supabase/Auth/Edge/AI stack. Úspěch mock prokliku neprokazuje nasazenou integraci. Ta zde nebyla zkoušena a nic nebylo nasazeno.

Jednodušší samostatný chatový mock lze sestavit `npm run build -- --mode local-demo` a spustit `npm run preview -- --mode local-demo --host 127.0.0.1 --port 4173 --strictPort`; není hlavním UAT artefaktem.

## Ranní scénáře

1. Mobil 390×844 a desktop 1600×1100: obě úvodní akce viditelné, proklik chatu a registru, navigace bez horizontálního přetečení. Mobilní menu se po prokliku zavře.
2. Obyvatel → Zeptat se: každý ze tří českých příkladů pouze doplní dotaz. Odpověď se zobrazí až po Zeptat se.
3. Testovací scénář postupně Bez zdrojů / Limit / Chyba. Sledujte načítání; retry ponechá dotaz a po přepnutí zpět na Odpověď se zdrojem uspěje.
4. Citace otevře jen označený odstavec a revizi, nikoli celou poznámku. Projděte jako obyvatel i výbor.
5. Výbor: otevřete Správa zdrojů wiki. Zobrazí se klíč opravy, aktivní stav, verze a poslední změna odvozené z auditu. Obyvatel panel nevidí.
6. Výbor → Stáhnout syntetickou citaci. Přehled označí poznámku jako staženou; opětovné otevření staré citace je odmítnuto. Již zobrazený/zkopírovaný text nelze zpětně odvolat; opětovné otevření vždy znovu ověřuje oprávnění. Reload obnoví počáteční fixture.
7. Technický přehled → SYN-001 → Nahlásit závadu k prvku: existující formulář obsahuje vazbu, název a místo, prázdný popis; nic nebylo automaticky odesláno. Zrušení neodešle požadavek.
8. Doplňte smyšlený popis a odešlete. Najděte požadavek přes potvrzení i Moje požadavky; zkontrolujte Nový, poslední změnu, popis a vazbu. Jiný obyvatel neuvidí seznam ani detail; návrat autora jej znovu zobrazí. Tato browser kontrola je mock; skutečná DB kontrola patří testům níže.
9. Dry-run: `python3 -B -m unittest discover -s scripts -p test_wiki_batch_preview.py -v`. Testuje i explicitně vybraný osobní soubor, export:false a local-only, bez zápisů a bez výpisů těl. Reálná wiki nebyla během běhu použita. Nový `scripts/wiki-batch-preview.py` je jen náhled, ne importér; kandidát vyžaduje ruční kontrolu soukromí. Starý `wiki-migration-plan.py` zůstává nezměněn.

## Opakovatelné ověření

    npm test
    npm run build
    npm run local:build
    python3 -B scripts/check-local-artifact.py
    python3 -B -m unittest discover -s scripts -p test_wiki_batch_preview.py -v
    npm run lint
    ./node_modules/.bin/tsc -p tsconfig.app.json --noEmit

Browser scénáře obsahuje `scripts/verify-local-fixtures.py`; používá již instalovaný Hermes browser harness a spouští se v browser_exec pomocí `runpy.run_path(..., run_name='__main__')`. Není to nová globální závislost projektu. Průběžné assertions ukládá do `../evidence/actual-ui-results.json`, snímky `*-final-*.png` do stejné složky.

Nové testy: `supabase/tests/overnight-citations.test.ts`, `overnight-sources.test.ts`, `overnight-requests.test.ts`; existující `src/features/ask-house.test.ts` a `supabase/tests/wiki-markdown-chat.test.ts` doplňují chatové kontroly. Časy a revize syntetické fixture nejsou skutečný audit domu.

## Známé hranice před předáním

Build není TypeScript typecheck. Finální TypeScript byl v agentově prostředí zablokován lifecycle guardem (velikost `_tsc.js`), schvalování nebylo obcházeno. Celkový lint obsahuje čtyři existující chyby v nezměněných souborech (`ui/command.tsx`, `ui/textarea.tsx`, Edge `ask-house/index.ts`, `tailwind.config.ts`). Proto nelze celý bod předání vykázat jako ověřený ani změny považovat za připravené k nasazení.

Frontend nyní potřebuje zaktualizovanou odpověď funkce ask-house s přesným `sources[].id`; se starší funkcí bezpečně nezobrazí úryvek. Nasazení páru frontend/funkce není součástí tohoto lokálního běhu. Správa zdrojů čte metadata z existujícího neměnného auditu, ne těla poznámek, a explicitně oznamuje chybu/neúplnost. Žádná migrace ani změna oprávnění nebyla provedena.
