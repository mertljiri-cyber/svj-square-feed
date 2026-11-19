# Rozhodnutí, neznámé vstupy a odpovědnosti

Stav: návrhy k převzetí. Tento dokument nevyžaduje odpovědi před stažením balíčku; otázky představují vstupní podmínky příslušné budoucí etapy.

## Návrhová rozhodnutí

| ID | Rozhodnutí a důvod | Stav |
|---|---|---|
| ADR-01 | Zachovat Lovable + React/TypeScript + Supabase, rozvíjet modulárně bez mikroservis | NÁVRH v souladu se zadáním |
| ADR-02 | Bezpečnost před archivem, registrem a požadavky; AI, finance a schůze později | Pořadí dané aktuálním zadáním |
| ADR-03 | Jeden pilot SVJ, tenant ID a izolace už od začátku | NÁVRH, více SVJ jako produkt není součást scope |
| ADR-04 | Privátní archiv, neměnné verze a konkrétní důkazní odkazy | NÁVRH |
| ADR-05 | Excel importovat přes staging, 21 pojmenovaných prvků a 4 rezervy odděleně | Opřeno o přečtený zdroj; politika převzetí je NÁVRH |
| ADR-06 | Nezjištěno, chybějící údaj a špatný stav jsou odlišné | Požadavek diskuse i zdroje; implementace navržena |
| ADR-07 | Předběžné technické odhady, plán oprav a skutečné náklady se nesčítají jako jedna vrstva | NÁVRH pro konzistenci |
| ADR-08 | Požadavky se stavem a konverzace u nich; soukromá přímá komunikace jako oddělené vlákno | NÁVRH podle diskuse |
| ADR-09 | AI v první verzi jen čte, každé věcné tvrzení má zdroj | NÁVRH podle diskuse |
| ADR-10 | Finanční přehledy přebírat, nevytvářet vlastní účetnictví a platební systém | NÁVRH podle diskuse |
| ADR-11 | Schůze nejprve pro fyzické jednání; oficiální per rollam oddělit a ponechat P4 | Pořadí a oddělení podle zadání |
| ADR-12 | Automatický import osobních údajů, BIM a 3D integrace nejsou první scope | NÁVRH vymezující předávané zadání |

## Otevřené vstupy podle etapy

| ID / kdy | Potřebný vstup | Navržený vlastník | Co bez něj nelze potvrdit |
|---|---|---|---|
| O01 / E0 | Skutečný Lovable projekt, vazba na GitHub, produkční Supabase a odchylky schématu | provozní správce | Nasazený stav a bezpečný release |
| O02 / E0 | Kdo smí zvát uživatele, potvrzovat vlastnictví a spravovat role | výbor | Ověřené členství a první board účet |
| O03 / E0 | Počet a seznam budov, vchodů a jednotek z primárního podkladu | výbor / správce dat | Autoritativní seed jednotek; údaj 29/3 z chatu nestačí |
| O04 / E0 | Zálohy tarifu, retence, RPO/RTO, provozní odpovědnost a rozpočet | provozní vlastník | Bránu před reálnými daty |
| O05 / E1 | První sada dokumentů, kategorie, audience a vlastníci obsahu | správce archivu | Bezpečnou publikaci a úplnost archivu |
| O06 / E1 | Whitelist, limity, scanner, případný OCR a způsob náhledů | provozní správce | Podporované uploady a bezpečnost pipeline |
| O07 / E2 | Potvrzení úplnosti 21 prvků, budoucí využití rezerv a odborný správce | výbor / technický správce | Skutečné pokrytí domu a potvrzená hodnocení |
| O08 / E2 | Odpovědnosti, termíny a metody ověření neznámých stavů | technický správce | Úplný plán ověření; z Excelu chybí |
| O09 / E3 | Kontakty, havarijní kanál, řešitelé a pravidla zveřejnění požadavků | výbor | Provozní očekávání a skutečný proces vyřízení |
| O10 / E4 | Poskytovatel AI/OCR, zpracovatelské podmínky, region, budget a eval dataset | vlastník produktu + správce obsahu | Zpracování skutečných dokumentů AI |
| O11 / E5 | Formát finančních podkladů správce a úplnost období | finanční správce | Správné mapování a finanční součty |
| O12 / E6 | Aktuální stanovy, podíly, zastoupení a ověřená pravidla konkrétních rozhodnutí | výbor + právní/odborný poradce podle potřeby | Autoritativní výpočet účasti a výsledků |
| O13 / E7 | Právně ověřený end-to-end proces per rollam, podpis/doručení/papír/archiv | výbor + právní poradce | Tvrzení o oficiální platnosti a implementaci |

Jméno správce Pragostav je pouze kontext z diskuse; jeho aktuální smluvní rozsah nebyl ověřen. „Závazný rámec“ v Excelu nemá doložené schválení. Žádný agent nemá vyplnit schvalovací datum, přidělit osobám odpovědnost nebo nastavit hlasovací většinu jen pro dokončení obrazovky.

## Změnové řízení

Při změně schématu či priority aktualizovat tento seznam rozhodnutí, PRD, roadmapu, backlog a odpovídající kontrakt. Věcná změna musí uvést důvod a dopad na data/testy. Rozšíření AI či hlasování nepřebírá automaticky schválení základního archivu. Otázky blokují pouze závislou práci; lze pokračovat s nezávislými, bezpečně ověřitelnými částmi.
