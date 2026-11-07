# Napojení původního technického Excelu

Pozorování sešitu jsou **DOLOŽENO EXCELEM**. Databázové cíle a importní chování jsou **NÁVRH E2**, nejsou implementovaným importérem.

## 1. Identita a skutečný obsah zdroje

Soubor: `/Users/Jiri.Mertl/Documents/SVJ/Technicky_registr_SVJ_Pod_Trebesinem.xlsx`. SHA-256 při čtení: `fe6fdd440de42db10b3c0a58cd7d2078ec9be4fb737f38b3498d0ecf720b6515`.

| List | Ověřený rozsah / význam |
|---|---|
| Závazný rámec | Rozsah A1:H40, návrh pravidel evidence, verze 1.0; účinnost a konkrétní schválení nevyplněné. A37 výslovně říká, že jde o návrh provozního rámce. |
| Technický registr | A1:W196, hlavička A3:W3; 25 ID v A4:A28, ale pouze 21 pojmenovaných prvků v řádcích 4–24. Řádky 25–28 obsahují jen T-022 až T-025. |
| Plán oprav | A1:N200, hlavička A3:N3. Žádné akce v řádcích 4–200. |
| Přehled | A1:H10, uložené hodnoty a vzorce; nejde o další vstupní evidenci. |
| Číselník | A1:F17; definice stavů, jistoty a priorit. Některé další povolené hodnoty jsou pouze v seznamových validacích registru/plánu. |

U všech 21 pojmenovaných prvků je F = Nezjištěno. Sloupce G:W jsou u nich prázdné. Kritičnost E je vyplněná, ale není to odborný důkaz stavu. U čtyř rezerv jsou prázdné i oblast, název a stav. Zdroj neobsahuje přiřazené osoby, odborné závěry, provedené opravy ani částky. Název SVJ v B3 rámce je „Společenství vlastníků Pod Třebešínem 3062 až 3064“; nepoužívat jej jako automatický doklad seznamu budov, jednotek a vlastnictví.

Přehled má uložené B4=25 a B5=21. Vzorec B4 počítá neprázdná ID, tedy i rezervy. Uložené nulové součty nákladů vyplývají z prázdných odhadů, nejsou to skutečné nulové náklady. Vzorce byly přečteny, nebyly přepočítány v nativním Excelu. Detail položek a validačních seznamů je v [inventáři](prilohy/EXCEL_INVENTAR.md).

## 2. Politika prvního převzetí

Převést 21 pojmenovaných prvků do návrhů `technical_assets`, jejich unknown hodnocení do `technical_assessments` se stavem imported a původní kritičnost zachovat jako zdrojové zadání k ověření. Prázdné rezervy zůstanou v `import_rows` jako reserved, nevytvoří čtyři bezejmenné aktivní prvky. V UI zobrazit „21 převzatých prvků, 4 rezervy ve zdroji“.

Import nevyplní dnešní datum jako datum fyzické kontroly. Importovaný unknown není odborně potvrzené hodnocení. Nezakládat 21 prázdných followup úkolů s vymyšlenými termíny; evidovat chybějící plán ověření a umožnit člověku jej doplnit. `asset_followups` vzniká až pro skutečně vyplněný krok nebo schválené doplnění. Prázdný Plán oprav vytvoří 0 akcí a viditelnou informaci „plán dosud nenaplněn“.

## 3. Mapování Technického registru A–W

Všechny původní hodnoty se zachovají také v raw importním řádku. `asset` = technical_assets, `assessment` = technical_assessments, `followup` = asset_followups, `event` = maintenance_events.

| Sloupec / přesná hlavička | Navržený cíl | Převod a validace |
|---|---|---|
| A – ID | asset.external_id | trim, zachovat T-001 apod.; unikátní v SVJ, prázdné ID u jinak vyplněného řádku je chyba |
| B – Oblast | asset.area | text + řízený slovník z potvrzených hodnot, nové oblasti k odsouhlasení |
| C – Prvek / systém | asset.name | povinné pro aktivní prvek; samotné ID bez B:W je rezerva |
| D – Umístění / rozsah | asset.location_text | zachovat text, neodvozovat automaticky konkrétní entrance_id |
| E – Kritičnost | asset.criticality | Vysoká/Střední/Nízká → high/medium/low; prázdné = null |
| F – Stav | assessment.condition | A–E a Nezjištěno → A/B/C/D/E/unknown; prázdné zůstává missing v importním protokolu |
| G – Popis stavu / závady | assessment.description | text, nepřevádět na potvrzený požadavek bez lidské volby |
| H – Zdroj informace | assessment.source_text | zachovat původní popis, dokument_version link až po nalezení skutečného důkazu |
| I – Datum zdroje | assessment.source_date | datum dle Excel epoch/typované buňky; nejednoznačný text do karantény |
| J – Poslední fyzické ověření | assessment.physically_verified_on | date; nesmí se nahradit datem importu |
| K – Ověřil / autor | assessment.verifier_text | text; verified_by pouze po potvrzeném mapování na osobu/účet |
| L – Jistota znalosti | assessment.knowledge_confidence | high/medium/low/unknown; null zachovat odlišně |
| M – Poslední významný zásah | event.intervention_summary | historický popis, bez vymyšleného dne provedení |
| N – Rok zásahu | event.intervention_year | celé číslo roku nebo null; pokud jen rok bez popisu, vyžaduje kontrolu před událostí |
| O – Doporučený další krok | followup.next_step | text; metoda ověření není ve zdroji samostatným sloupcem, lze ji lidsky doplnit |
| P – Priorita | followup.technical_priority | P1–P5 nebo monitor; nezaměnit s prioritou implementace |
| Q – Horizont zásahu | followup.intervention_horizon | přesné mapování seznamu níže, neodvozovat konkrétní rok bez výchozího data |
| R – Odhad nákladů Kč | followup.estimated_cost | numeric v CZK; prázdné=null, 0=0, záporné k odmítnutí/prověření |
| S – Jistota odhadu | followup.estimate_confidence | high/medium/low/not_prepared; prázdné=null |
| T – Odpovědnost | followup.responsible_text | text; assignee_membership_id až po potvrzeném mapování, žádná automatická pozvánka |
| U – Termín dalšího kroku | followup.due_on | date; minulý termín není chyba formátu, ale viditelný stav po termínu |
| V – Status | followup.technical_status | open/planned/ordered/in_progress/closed/monitor, nezaměnit se stavem přípravy akce |
| W – Poslední aktualizace | assessment.source_updated_on a followup.source_updated_on, pokud existuje | datum zdrojového záznamu, odlišné od serverového updated_at; prázdné zachovat |

Záznam historie zásahu se vytváří jen z věcně použitelného obsahu M/N. Částečný údaj zůstane v raw a importním nálezu, pokud nelze bez domýšlení založit událost. Potvrzené hodnocení A–E se z Excelu nikdy nevytvoří automaticky; import je návrh k kontrole. Neznámý či prázdný stav se nesmí normalizovat na A.

## 4. Mapování Plánu oprav A–N

| Sloupec / přesná hlavička | Cíl v repair_actions | Pravidlo |
|---|---|---|
| A – ID akce | external_id | unikátní v SVJ, zachovat původní klíč |
| B – ID prvku | asset_id přes external_id | povinná existující vazba; rezerva není aktivní prvek |
| C – Název akce | title | povinný pro převzetí akce |
| D – Důvod / vazba na stav | reason | původní text |
| E – Priorita | technical_priority | P1–P5; Sledovat zde seznamová validace nepovoluje |
| F – Plánovaný rok | planned_year | integer; prázdný rok není současný rok |
| G – Odhad nákladů Kč | estimated_cost | numeric, CZK, null odlišně od 0 |
| H – Jistota odhadu | estimate_confidence | high/medium/low/not_prepared |
| I – Stav přípravy | preparation_status | seznam níže; automaticky neznamená potvrzené schválení |
| J – Rozhodnutí shromáždění | decision_text | text; resolution_id až po dohledání a potvrzení skutečného usnesení |
| K – Odpovědnost | responsible_text | text, volitelné ručně potvrzené přiřazení účtu |
| L – Další milník | next_milestone | text |
| M – Termín milníku | milestone_due_on | date |
| N – Poznámka | note | text |

Aktuální zdroj nemá žádné řádky akcí. Toto mapování je připraveno pro budoucí naplnění nebo jinou odsouhlasenou verzi zdroje; nejde o tvrzení, že existují schválené investice.

## 5. Slovníky a rozdíly mezi listy

Autoritou pro význam A–E je list Číselník, ale povolené hodnoty zahrnují také inline validace. Import musí číst obojí a rozdíly přiznat.

- Stav: A – velmi dobrý; B – dobrý; C – uspokojivý; D – špatný; E – kritický; Nezjištěno.
- Jistota znalosti: Vysoká; Střední; Nízká; Nezjištěno. Poslední hodnota je v validaci L, ale nemá samostatnou definici v Číselníku.
- Kritičnost: Vysoká; Střední; Nízká. Není to posouzení stavu A–E.
- Priorita registru: P1 – ihned; P2 – do 1 roku; P3 – 1–3 roky; P4 – 3–5 let; P5 – >5 let; Sledovat. Sledovat je pouze ve validaci registru, nikoliv v definicích priorit ani v seznamu Plánu oprav.
- Horizont: 0–1 rok; 1–3 roky; 3–5 let; 5–10 let; >10 let; Bez zásahu; Neurčeno. Navržené kódy h0_1/h1_3/h3_5/h5_10/h10_plus/no_intervention/undetermined.
- Jistota odhadu: Vysoká; Střední; Nízká; Nezpracován. `not_prepared` není částka ani nula.
- Status registru: Otevřeno; Plánováno; Objednáno; Realizace; Uzavřeno; Sledovat.
- Stav přípravy plánu: Námět; Prověřit; Projekt / nabídky; Ke schválení; Schváleno; Objednáno; Realizace; Dokončeno. Mapovat na idea/investigate/design_quotes/for_approval/approved/ordered/in_progress/completed.

Rozlišovat `unknown` výslovně napsané ve zdroji, prázdné `null` a chybnou neznámou hodnotu. Normalizace Unicode a okrajových mezer je dovolena, změna významu ne. Rozdílné pomlčky lze mapovat jen podle explicitní alias tabulky s protokolem.

## 6. Importní proces a idempotence

1. Oprávněný importer vybere SVJ a zdroj. Ověří typ, limity velikosti a bezpečnost archivu XLSX. Nespouští makra, vzorce ani externí odkazy.
2. Spočítá SHA-256, uloží verzi mapování a detekuje strukturu. Hlavičky kontroluje podle názvů a počtu; neznámá varianta vyžaduje nové mapování.
3. Načte tabulkové řádky podle hlaviček, nikoliv podle max_row samotného. Prázdné formátované řádky ignoruje; ID-only řádek je reserved.
4. Uloží raw hodnoty, souřadnice a validační výsledek do stagingu. Přehled a Závazný rámec uchová jako kontext, ne jako technické události či schválený předpis.
5. Připraví diff create/update/unchanged/conflict/reserved/error. Duplicitní ID v jednom souboru je blokující chyba, ne „poslední vyhrává“.
6. Uživatel vyřeší chyby a výslovně vybere řádky k převzetí. První zdroj může přijmout 21 validních návrhů, rezervy zůstanou v protokolu. Chyby nesmějí být tiše přeskočeny; částečná volba musí uvést seznam vyloučených řádků.
7. Commit schválené sady proběhne v jedné DB transakci. UNIQUE SVJ + hash + mapping_version a doménové externí klíče zabrání duplicitě. Souběžný import stejného zdroje se uzamkne nebo vrátí existující výsledek.
8. Reimport změněného souboru porovná zdrojový hash řádku a aktuální row_version. Ručně změněná data se nepřepíšou bez vyřešeného konfliktu. Chybějící řádek nového souboru nemaže historický prvek.
9. Protokol obsahuje počty, výběr, změněná pole, konflikty, aktéra a časy. Stejný import znovu vrátí původní batch, nevytváří novou historii hodnocení.

Návrat importu vrací pouze nedotčené návrhy vytvořené daným batchem. Pokud mezitím vznikl důkaz, oprava nebo ruční změna, není dovoleno objekt smazat kaskádou; použít kompenzační změnu a uvést nevrácené řádky k lidskému řešení. Obnova celé databáze není běžným tlačítkem „undo import“.

## 7. Referenční očekávání a KPI

Pro hash uvedený výše: identifikátorů 25, pojmenovaných prvků 21, rezerv 4, duplicit ID 0, explicitních unknown stavů 21, akcí oprav 0, vyplněných odhadů 0. Tyto hodnoty byly ověřeny čtením řádků, nejde o provedený databázový import.

Navržený dashboard oddělí počet aktivních prvků, rezervy a úplnost znalosti. V první převzaté verzi je 21/21 pojmenovaných prvků bez zjištěného stavu. KPI „kritické 0“ musí být doprovázeno tímto kontextem. Prázdná priorita není „nízká“, prázdný horizont není „Bez zásahu“. Součet prázdných odhadů zobrazit „Náklady dosud neodhadnuty“ s počtem dotčených položek.

Předání neobsahuje kopii Excelu ani automatický seed. Originál zůstává beze změny v uvedeném umístění; pro jiný počítač jej dodat bezpečnou cestou mimo veřejný Git. Testy importu jsou v backlogu TEC-01–05 a v testovacím plánu.
