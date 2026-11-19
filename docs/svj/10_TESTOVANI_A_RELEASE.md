# Testování, pilot a release

Stav: **NÁVRH OVĚŘENÍ BUDOUCÍ IMPLEMENTACE**. Při přípravě balíčku proběhlo čtení zdrojů a kontrola dokumentace, nikoliv níže uvedené testy aplikace.

## Vrstvy důkazu

| Vrstva | Co prokazuje | Co sama neprokazuje |
|---|---|---|
| Kód a migrace v commitu | Implementace je dohledatelná | Že se spustí, je nasazená nebo správně nakonfigurovaná |
| Čistý build, lint a typová kontrola | Kontrolovaný kód projde konkrétními lokálními kontrolami | RLS, přístup k souborům nebo právní platnost procesu |
| API a DB integrační test | Ověřený scénář v konkrétní DB konfiguraci | Stejný stav produkce |
| Testovací nasazení a browser | Fungování dané verze v cílovém testovacím prostředí | Dlouhodobý provoz a úplnost reálných dat |
| Pilot vlastníků | Použitelnost a skutečný průchod schválenou sadou dat | Univerzální bezchybnost nebo zákonnost hlasování |

Ke každému důkazu uvádět datum, commit, verze migrací, prostředí, roli a výsledek. Testy nesmějí používat produkční účty vlastníků ani zasílat zkušební e-maily reálným lidem.

## Testovací osoby a data

Syntetické účty: anon, přihlášený bez členství, owner A, owner B téhož SVJ, board, manager s omezeným grantem, technik bez a s approve grantem, system_admin bez obsahové role, suspendovaný člen se starým tokenem a owner jiného SVJ. Testovací dokumenty owners/board/restricted, dvě verze a odvolaný grant; soukromé vlákno bez board účastníka.

Primární technický Excel používat pro přesnost importního parseru v izolované kopii/stagingu. Pro mutační scénáře vytvořit syntetické varianty: duplicita ID, chybějící hlavička, neznámá priorita, 0 Kč, prázdná částka, neplatné datum, akce bez prvku a ruční konflikt. Originál nepřepisovat.

## Povinné integrační scénáře

| ID | Akce | Očekávaný výsledek / brána |
|---|---|---|
| T-SEC-01 | Anon čte news přímo API bez UI filtru | Jen výslovně veřejné publikované; žádný draft či interní obsah / G0 |
| T-SEC-02 | Anon čte forms/settings a vkládá intents/submissions | Interní data a vkládání odmítnuto; žádný zápis / G0 |
| T-SEC-03 | Owner mění role, organization_id, autora, stav schválení | Operace odmítnuta, data nezměněna / G0 |
| T-SEC-04 | Uživatel jiného SVJ hádá ID a FK | Žádné čtení ani propojení přes tenanty / G0 |
| T-SEC-05 | Suspendovaný člen použije stále platný JWT | Další interní požadavek zakázán / G0 |
| T-SEC-06 | Změna s neplatnou row_version, rollback auditní transakce | Konflikt nebo plný rollback bez poloviční změny / G0 |
| T-DOC-01 | Owner B čte restricted dokument A přes seznam/API/objekt/hledání | Žádná metadata ani obsah / G1 |
| T-DOC-02 | Odebrání grantu po vydání odkazu | Nové stažení zakázáno; dřívější signed URL nejpozději expiruje podle uvedeného TTL / G1 |
| T-DOC-03 | Přerušený upload a souběžné dvě verze | Žádná publikovaná osiřelá verze, žádné přepsané bajty / G1 |
| T-DOC-04 | Nepovolený typ, změněné MIME, nadlimitní XLSX | Serverové odmítnutí či karanténa, bezpečný chybový stav / G1 |
| T-TEC-01 | Suchý import referenčního hashe | 21 pojmenovaných + 4 rezervy, 0 akcí, žádný doménový zápis / G2 |
| T-TEC-02 | Commit a opakování i souběh stejného batch | Jeden výsledek bez duplicit / G2 |
| T-TEC-03 | Reimport po ruční změně a návrat importu | Konflikt, žádné ztracené hodnocení ani smazané navazující důkazy / G2 |
| T-TEC-04 | Unknown, missing, 0 Kč a missing odhad | Rozlišené stavy a správný jmenovatel KPI / G2 |
| T-TEC-05 | Potvrzení A–E bez důkazu a dokončení opravy | Nepovolené potvrzení blokováno; oprava sama nevylepší stav / G2 |
| T-REQ-01 | Owner A podá závadu a opakuje submit | Jedno číslo, jeden požadavek, soukromá příloha / G3 |
| T-REQ-02 | Board mimo soukromou přímou konverzaci čte zprávy | Odmítnuto, pokud nemá explicitní účast / G3 |
| T-REQ-03 | Převod legacy feedback/survey, neznámý autor | Zachovaný raw, žádné domyšlené autorství, survey není automaticky závada / G3 |
| T-REQ-04 | E-mail provider selže po uložení požadavku | Požadavek přijat, notifikace failed/pending, řízený retry / G3 |
| T-AI-01 | Dotaz na cizí dokument, odebrání práv během generování | Žádný únik ani do LLM kontextu a odpovědi / G4 |
| T-AI-02 | Neexistující podklad, rozpor verzí, instrukce v dokumentu | Přiznaná neznalost/rozpor, pokyny se nevykonají / G4 |
| T-FIN-01 | Stejný doklad importován podruhé a spárován s platbou | Žádné dvojí náklady; součet sedí na zvolený zdroj/pohled / G5 |
| T-MTG-01 | Spoluvlastníci i společný zástupce, odchod v průběhu bodu | Jedna jednotka započtena nejvýše jednou, verzovaný snapshot / G6 |
| T-MTG-02 | Chybějící podíl či neověřené pravidlo většiny | Automatické potvrzení výsledku blokováno / G6 |
| T-OPS-01 | Obnova DB a dvou souborových verzí do izolace | Vazby a checksumy sedí, žádná nechtěná pošta / G0 a znovu G1 |

Test přístupových práv ověřuje databázi i soubory; pouhé skrytí tlačítka nevyhovuje. Odepření čtení může vrátit prázdný výsledek nebo bezpečnou chybu podle endpointu, avšak nesmí změnit data ani prozradit existenci citlivého obsahu.

## Uživatelské a provozní ověření

Ověřit mobilní šířku přibližně 375 px i desktop, klávesnici, popisky formulářů, čitelnost stavu bez spoléhání na barvu, chybové stavy, pomalé načítání a návrat po výpadku. Pro první pilot stačí funkční archiv a metadata; selhání OCR nesmí blokovat orientaci.

Pilotní průchod je v [příloze](prilohy/SCENARE_PILOTU.md). Zástupce vlastníků ověří použitelnost, správce dat potvrdí věcnou shodu a technický reviewer bezpečnostní důkazy. Chybějící reálné vstupy se zaznamenají jako omezení, nikoliv doplní simulovanými fakty.

## Postup release

1. Zaznamenat přesný commit, migrace a dokončené karty; zkontrolovat aktuální oprávnění k publikaci z konkrétního uživatelského zadání.
2. Ověřit zálohu a obnovu, kompatibilitu frontendu a migrací, odhad dopadu a plán návratu.
3. Aplikovat inkrementální migrace do testu, spustit příslušné testy a uživatelské průchody. Chyba blokuje dotčenou bránu.
4. Produkční migrace a publikace provést až v rámci výslovně zadané release práce. Samotný Git push není důkaz Lovable publikace ani migrace.
5. Ověřit spotřebovanou vrstvu: nasazenou verzi, autentizaci, přímé API, soubory a klíčový pracovní průchod. Označit, co bylo ověřeno a co ne.

Při chybě vypnout novou funkci nebo přejít na kompatibilní předchozí frontend. Nevracet bezpečnostní opravu obnovením veřejných politik. Datové migrace vracet jen podle předem vyzkoušeného postupu; při již přijatých nových datech použít kompatibilní opravu nebo řízenou kompenzaci. Žádný bezhlavý reset produkční databáze.
