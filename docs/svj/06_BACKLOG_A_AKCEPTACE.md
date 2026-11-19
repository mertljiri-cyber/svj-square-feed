# Implementační backlog a akceptační kritéria

Stav: **NÁVRH**, 32 karet. Žádná karta tímto předáním nevznikla jako GitHub issue a žádná není implementována. Priorita `P0–P4` je priorita vývoje. Technické priority oprav jsou samostatná data.

Každá karta musí před zahájením získat vlastníka, velikost odhadu a cílové prostředí. Akceptaci potvrzuje reviewer s důkazem testu a vlastníkem produktu pro uživatelský průchod. Společná definice dokončení: změna a migrace v Gitu, příslušné testy prošly, dokumentace odpovídá implementaci a stav nasazení je uveden zvlášť.

## E0 – P0 – bezpečný základ

### SEC-01 – Baseline a izolované prostředí

Závislost: žádná. Důvod: K08–K09 a neověřená produkční konfigurace.

- Aktuální HEAD a schéma testovacího Supabase jsou zaznamenány, odchylky proti auditu popsány.
- Zvolen jeden package manager; čistá instalace, build, lint a samostatná typová kontrola mají doložený výsledek. Původní chyby se neoznačí za opravené bez důkazu.
- Vývoj nemíří na produkční data. Je doložen zdroj konfigurace a stav publikace; žádná hodnota secrets není v logu či PR.

### SEC-02 – Přihlášení a schvalované členství

Závislost: SEC-01.

- Pozvaný a ověřený uživatel s aktivním členstvím se přihlásí a odhlásí, nepřijatá pozvánka ani samotný účet interní data neodemkne.
- Obnova účtu funguje v testovacím prostředí; chybná či prošlá pozvánka je odmítnuta bez prozrazení cizího účtu.
- Pozastavení člena zablokuje jeho další interní API požadavek i se starou session; klient znepřístupní interní cache.

### SEC-03 – Role, delegace a bezpečný bootstrap

Závislost: SEC-02.

- První board účet je vytvořen řízeným postupem s auditem. Vlastník si nepřidělí board, tenant ani scoped grant přes API nebo user metadata.
- Správce s technickým grantem nemění role, finance ani cizí soukromé zprávy.
- Odebrání rolí je auditováno; poslední board správce nemůže být neúmyslně odstraněn bez zajištění náhrady.

### SEC-04 – Uzavření současných veřejných politik

Závislost: SEC-02–03. Důvod: F01–F03.

- Nová migrace výslovně odstraní široké veřejné politiky. Anon nečte koncepty, neaktivní formuláře ani interní settings a nevkládá interní záměry/podání.
- Vlastník přímým API nevloží záměr jako schválený a nemění chráněné sloupce.
- Výslovně veřejná publikovaná novinka zůstane veřejně čitelná. Testy běží se skutečnými neprivilegovanými rolemi, včetně uživatele jiného SVJ.

### SEC-05 – Serverová validace, audit a souběh

Závislost: SEC-03–04.

- Payload mimo povolené schéma, neplatný FK a změna organization_id jsou odmítnuty i bez UI.
- Změna doménového stavu a audit se uloží společně nebo vůbec; aplikace audit nepřepíše ani neodstraní.
- Zastaralá row_version vrátí konflikt bez tichého přepsání. updated_at vzniká serverově při skutečné změně.

### SEC-06 – Konfigurace, secrets a ochrana vstupů

Závislost: SEC-01.

- `.env` a historie zkontrolovány bez zveřejnění hodnot; nález rozlišuje veřejnou konfiguraci a skutečný serverový secret. Případná rotace je doložena samostatně.
- Frontend bundle neobsahuje serverové/AI klíče. Privilegované účty mají ověřený přihlašovací a obnovovací postup včetně zvolené ochrany.
- Citlivé endpointy mají limity a ověřenou autorizaci; CORS nepředstavuje jedinou ochranu.

### SEC-07 – Zálohy, obnova a bezpečnostní brána

Závislost: SEC-04–06.

- Popsány skutečně dostupné zálohy DB i objektů, přístupy k nim, retence a odpovědná osoba. RPO/RTO mají schválený cíl, ne neověřený marketingový příslib.
- Obnova syntetické DB a alespoň jednoho souboru s vazbou je ověřena v izolovaném prostředí; obnovení nerozešle notifikace ani AI úlohy.
- Matice negativních testů z 10_TESTOVANI_A_RELEASE.md má výsledky. Bez splnění G0 se nezačne nahrávat skutečný neveřejný obsah.

## E1 – P1 – archiv

### DOC-01 – Privátní upload a metadata

Závislost: G0.

- Povolený soubor projde kontrolou a vytvoří dokument s metadaty, checksumem a verzí; nepovolený typ a nadlimitní soubor se odmítne serverově.
- Cizí uživatel nečte název, objekt ani dočasný upload. Nedokončený upload netvoří publikovanou verzi a lze jej opakovat či uklidit.

### DOC-02 – Verze a publikace

Závislost: DOC-01.

- Druhý upload vytvoří verzi 2, verze 1 zůstane dohledatelná oprávněným uživatelům. Souběžné uploady nezískají stejné číslo ani nepřepíšou bajty.
- Publikace/znepřístupnění má audit; důkaz odkazující na v1 se nezmění na v2.

### DOC-03 – Seznam, hledání a vazby

Závislost: DOC-02.

- Filtry metadat vracejí pouze oprávněné dokumenty; stránkování a export respektují stejný rozsah.
- Vazba na prvek/požadavek nesdílí dokument neoprávněné audience. Výpadek hledání se nezobrazí jako prázdný archiv.

### DOC-04 – Stažení, odvolání přístupu a obnova

Závislost: DOC-01–03.

- Nové stažení po odebrání grantu je zakázáno. Dřívější signed URL má otestovanou deklarovanou expiraci; restricted cesta znovu kontroluje přístup při požadavku.
- Obnova dvou verzí a metadat zachová checksum a odkazy. Odebrání dokumentu nevede k osiřelé veřejné kopii nebo dostupnému náhledu.

## E2 – P1 – technický registr a opravy

### TEC-01 – Suchý import skutečného Excelu

Závislost: G0, datový model registru; DOC-01 pro bezpečné uchování zdroje, pokud se ukládá.

- Import ověří listy, hlavičky a slovníky podle 09_IMPORT_TECHNICKEHO_EXCELU.md, zobrazí diff a ještě nezapisuje doménová data.
- Pro referenční hash vrátí 25 ID, 21 použitelných pojmenovaných prvků, 4 rezervy, 0 akcí plánu; vzorce Přehledu neimportuje jako technická zjištění.
- Neznámá hodnota slovníku, duplicitní ID nebo neplatný odkaz plánu vytvoří konkrétní chybu s listem a řádkem; žádná tichá náhrada.

### TEC-02 – Potvrzený import, idempotence a návrat

Závislost: TEC-01, SEC-05.

- Potvrzení schváleného diffu založí 21 návrhů prvků a zachová jejich ID; rezervy zůstanou v protokolu. Nevytvoří fiktivní odpovědnosti, datum zdroje ani opravy.
- Opakování stejného batch ani souběžný import nevytvoří duplicity. Změněný sešit nepřepíše novější ruční hodnocení bez vyřešení konfliktu.
- Zrušení importu je možné pro nedotčené importované návrhy; pozdější zásahy se nemažou. Protokol dokládá, co bylo vráceno a co zůstává k řešení.

### TEC-03 – Karta prvku, hodnocení a plán ověření

Závislost: TEC-02, DOC-02.

- Nezjištěno, chybějící hodnocení a A–E jsou rozlišeny. Potvrzení A–E bez data a důkazu se odmítne.
- Rozpracovaný plán ověření lze uložit, ale chybějící metoda/odpovědnost/termín zůstává viditelný. Potvrzení vytváří novou historickou verzi.
- Obyčejný vlastník ani AI nemohou potvrdit stav, technik bez approve grantu jej pouze navrhne.

### TEC-04 – Akce oprav a víceletý plán

Závislost: TEC-03.

- Akce je navázána na prvek, má stav přípravy, prioritu, rok nebo neurčený horizont a další krok; přechod ke schválení je auditován.
- Součet zahrne jen vybranou verzi akcí. Neodhadnuté náklady jsou nedostatek, 0 je skutečná nula; odhad followupu a akce se nesečtou podruhé.
- Dokončení opravy uloží zásah, ale bez dalšího ověření nezmění technický stav prvku na A.

### TEC-05 – Revize, chybějící důkazy a KPI

Závislost: TEC-03–04.

- Termín revize má doložený podklad; chybějící interval nevygeneruje domnělé datum.
- KPI oddělí 21 aktivních pojmenovaných prvků, 4 rezervy, unknown a nevyplněné hodnoty. Nula kritických hodnocení neznamená bezrizikový dům.
- Přehled chybějících ověření obsahuje odpovědnost a termín, případně explicitně hlásí jejich absenci.

## E3 – P1 – požadavky a komunikace

### REQ-01 – Přijetí požadavku a přílohy

Závislost: G0, DOC-04; TEC-03 pro volitelné vazby.

- Autor po uložení získá unikátní číslo a vlastní detail. Opakovaný submit se stejným idempotency klíčem nezaloží druhý požadavek.
- Výchozí požadavek je soukromý. Jiný vlastník neuvidí název, text ani přílohu; prvek lze připojit bez rozšíření ACL.

### REQ-02 – Fronta, přechody a řešení

Závislost: REQ-01.

- Board přiřadí řešitele, stav a termín; změna a událost jsou atomické. Resolved vyžaduje popis výsledku.
- Autor může doplnit podklady a žádat znovuotevření, nemění však interní schválení. Souběžné změny neztratí historii.

### REQ-03 – Kontakty a soukromé konverzace

Závislost: REQ-01, SEC-03.

- Kontakty zobrazují jen schválené údaje pro danou audience. Přímé zprávy čtou pouze účastníci, včetně testu board uživatele mimo vlákno.
- Převod zprávy na požadavek zobrazí nový rozsah příjemců a přenese jen vědomě vybraný obsah, ne celé soukromé vlákno.

### REQ-04 – Outbox a notifikace

Závislost: REQ-02–03.

- Uložení události a outboxu je jedna transakce; selhání e-mailu nevymaže požadavek a stav doručení není „úspěch“ bez podkladu.
- Retry nezaloží duplicitní událost ani opakované rozeslání při známém provider ID. Nejasný výsledek odeslání má popsané řešení.

### REQ-05 – Historická podání a vazba záměrů

Závislost: REQ-02, TEC-04.

- Každé staré podání má klasifikaci a zachovaný raw JSON; survey se nemigruje automaticky jako závada, neznámému autorovi se nevymyslí účet.
- Převod je idempotentní přes legacy_submission_id. Počty před/po sedí; veřejné původní URL nezpřístupní nově neveřejný obsah.

## E4 – P2 – AI

### AI-01 – Bezpečná extrakce a ingest

Závislost: G1–G3, schválený poskytovatel a proces zpracování.

- Chunk má verzi, stránku/sekci a hash; reingest nevytváří duplicity. Chyba OCR je vidět, bez ovlivnění bezpečného archivu.
- Nezveřejněné, vyřazené a vyloučené osobní zdroje nejsou v běžném indexu.

### AI-02 – Retrieval s živými právy

Závislost: AI-01.

- Cizí dokument ani metadata nevstoupí do kontextu modelu. Odvolání grantu během dotazu zabrání vydání dotčené odpovědi.
- Cache, citace a historie neobejdou nové ACL. Přímý útok přes chunk endpoint či RPC je odmítnut.

### AI-03 – Odpovědi, citace a eval

Závislost: AI-02.

- Výstup splní kontrakt a prahy v 08_AI_A_RAG.md, včetně 30 testovacích dotazů a nulových úniků.
- Asistent přizná chybějící stav a neplatnost neověřené domněnky; injekce v dokumentu nezmění jeho oprávnění ani nevyvolá akci.

### AI-04 – Návrhy metadat a provozní limity

Závislost: AI-03.

- Vytěžená hodnota má důkaz a čeká na potvrzení oprávněného uživatele. Změna prochází běžnou validací a auditem.
- Limity spotřeby, logování a vypnutí AI jsou ověřeny; vypnutí AI neomezí běžný archiv a registr.

## E5 – P2 – hospodaření

### FIN-01 – Kontrakt a staging finančního importu

Závislost: G1–G3 a skutečný schválený zdroj správce.

- Mapování formátu, období, měny a identifikátorů je zdokumentováno podle reálných dat. Neznámý formát se neimportuje odhadem.
- Součty, duplicity a chybějící podklady jsou viditelné před commit; opakování stejného importu nezvýší náklady.

### FIN-02 – Rozpočet proti skutečnosti

Závislost: FIN-01.

- Přehled rozlišuje odhad, schválený rozpočet, doklad a platbu, vždy s obdobím a úplností.
- Faktura a úhrada nejsou dva náklady; kontrolní součet se shoduje se schváleným zdrojem a zvolenou účetní perspektivou.

### FIN-03 – Zakázky a propojené podklady

Závislost: FIN-02, TEC-04.

- Výdaj či zakázka odkazuje na správnou opravu, dodavatele a verzi dokumentu. Oprava vazby je auditovaná.
- Společný souhrn neprozradí individuální osobní údaje z omezené faktury; přístup k dokladu se ověřuje samostatně.

## E6 – P3 – fyzická schůze

### MTG-01 – Program a podklady

Závislost: G1–G3, v preferovaném pořadí po E5.

- Program a verze návrhů jsou dohledatelné a publikované jen oprávněným. E-mailová notifikace není automaticky označena za právní důkaz doručení.
- Projekce na obrazovku nezobrazuje neveřejné kontakty, plné moci ani poznámky organizátora.

### MTG-02 – Účast a záznam fyzického hlasování

Závislost: MTG-01, ověřené podíly, zastoupení a pravidla rozhodování.

- Jednotka není započtena dvakrát při spoluvlastnictví nebo zástupci; změna účasti vytvoří nový snapshot.
- Výpočet používá přesné podíly a verzované pravidlo s uvedeným jmenovatelem. Chybějící podíl nebo neověřené zastoupení blokuje automatické potvrzení.

### MTG-03 – Zápis, usnesení a úkoly

Závislost: MTG-02.

- Pracovní a schválený zápis jsou dvě rozlišitelné verze. Oprava výsledku má historii a nepřepíše podepsaný podklad.
- Ze schváleného usnesení vznikne jeden dohledatelný úkol s odpovědností a termínem; opakované zpracování nevytvoří duplicitu.

## E7 – P4 – poslední priorita

### VOT-01 – Samostatné zadání oficiálního per rollam

Závislost: stabilní pilot, rozhodnutí vlastníka produktu a právně ověřené primární podklady.

- Výstupem první karty je schválený proces a rozsah, nikoliv tlačítko hlasování. Řeší identitu, aktuální vlastnictví a zastoupení, neměnné návrhy, podpis, doručení, papírové hlasy, výpočty, oznámení a důkazní archiv.
- Do nové akceptace a právního ověření zůstane oficiální vzdálené hlasování vypnuté. Odhad implementace a výběr podpisové služby jsou až součástí nového zadání.
