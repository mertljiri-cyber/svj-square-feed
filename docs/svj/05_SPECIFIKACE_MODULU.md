# Specifikace modulů

Stav všech cílových funkcí: **NÁVRH**. Implementovaný základ novinek, záměrů a formulářů je popsán v [auditu](00_STAV_A_ZDROJE.md). Oprávnění všech modulů určuje [bezpečnostní matice](07_BEZPECNOST_A_OPRAVNENI.md); model polí určuje [datový kontrakt](04_DATOVY_MODEL.md).

## M00 – Přístup a administrace (E0)

Obrazovky: přihlášení, přijetí pozvánky, obnovení přístupu, čekající členství, seznam členů a rolí, delegované rozsahy, audit. Preferovaný pilot je pozvánkový přístup přes Supabase Auth s ověřením e-mailu. Výbor potvrzuje vazbu uživatele na SVJ; přiřazení jednotky není odvozeno z libovolného formuláře.

Aktivní členství je podmínkou interního přístupu. Pozvánka má platnost, omezené použití a ověřeného příjemce. Pozastavení člena se projeví při dalším API požadavku i se starým JWT. Před dalším interním obsahem frontend vyčistí příslušnou cache. Správa rolí vyžaduje vyšší oprávnění a audit; systém zabrání neúmyslnému odebrání posledního aktivního board správce bez náhradního řešení.

Účet technického administrátora sám o sobě neznamená čtení soukromých zpráv. Případný nouzový provozní přístup má výslovný důvod, omezený čas a audit. Obnova účtu nesmí znovu aktivovat ukončené členství.

## M01 – Přehled, novinky a záměry (E0/E3)

Přehled obsahuje publikované informace pro danou audience, termíny a vlastní otevřené požadavky. Později přidá chybějící ověření registru a schválené změny plánu. Novinka má koncept, publikaci a archivaci, autora účtu, štítky a viditelnost. Publikace je serverově povolená board roli, veřejné sdělení je samostatná vědomá volba.

Záměr zůstává návrhem až do rozhodnutí oprávněné osoby. Může být propojen s technickým prvkem, požadavkem a opravnou akcí. Stav „schváleno“ vyžaduje odkaz na rozhodnutí nebo dohledatelný záznam schválení; staré demonstrační položky nejsou důkazem skutečných rozhodnutí. Původní URL zůstávají dosažitelné podle nových práv. Při přesunu dat se uchová vazba staré ID → nové ID.

## M02 – Dokumentový archiv (E1)

Obrazovky: seznam s filtry, detail dokumentu, verze, upload, úprava metadat a oprávnění. Minimální metadata: název, kategorie, období, audience, autor nahrání, datum, verze, související prvky nebo požadavky. Kategorie jsou návrhem: stanovy a pravidla, zápisy, smlouvy, technická dokumentace, revize, opravy, finance, ostatní.

Pracovní tok: koncept → kontrola souboru → připraveno → publikováno oprávněným osobám → archivováno nebo znepřístupněno. Chyba extrakce nezablokuje bezpečné stažení originálu. Nahrazení dokumentu vytvoří novou verzi. Historické důkazy ukazují na původní verzi. Publikace jiné verze je auditovaná operace.

P1 vyhledává alespoň metadata; hledání v textu je rozšíření po zavedení spolehlivé extrakce. Výpis ani výsledek hledání nesmí zobrazit název dokumentu, ke kterému uživatel nemá právo. Příloha požadavku či faktury nepřebírá širší práva jen tím, že je na ni odkaz. Export seznamu i souborů dodržuje stejná práva.

Navržený pilotní limit: PDF/JPEG/PNG a XLSX do 20 MB; finální whitelist a limit se potvrdí proti tarifu a scanneru. Aktivní HTML/SVG a spustitelné soubory se v první verzi nenahrávají. XLSX je ke stažení, nikoliv ke spuštění maker či externích odkazů. Žádné veřejné bucket URL pro interní archiv.

## M03 – Technický registr a ověřování stavu (E2)

Seznam filtruje oblast, kritičnost, stav, jistotu, prioritu, odpovědnost a chybějící údaje. Detail obsahuje původní ID, místo, historii hodnocení a zásahů, důkazy, otevřené kroky, související požadavky a plánované opravy.

Import nabídne 21 pojmenovaných prvků jako návrhy. Čtyři rezervy nejsou aktivní prvky. „Nezjištěno“ se zobrazuje výslovně; není to zelený stav. Chybějící termín, odpovědná osoba a metoda ověření jsou viditelné nedostatky. Nevyplněné položky lze uložit jako rozpracované, avšak nelze je vydávat za úplnou evidenci.

Postup změny: pověřený člověk vloží zjištění, datum, zdroj a míru jistoty; odborně odpovědný člověk potvrdí hodnocení; předchozí hodnocení zůstane v historii. AI a běžný vlastník mohou navrhnout doplnění, nemohou potvrdit technický stav. Při kritickém zjištění zobrazit schválené havarijní kontakty a vyvolat prioritní úkol, nikoliv slib nepřetržitého dohledu portálu.

Ověřovací plán je jiný proces než oprava: nejprve může být třeba prohlídka, teprve z ní vznikne oprava. Výchozí kritičnosti a názvy Excelu jsou zdrojové údaje návrhu, ne odborně validovaný pasport. Řádek „Dle prohlášení vlastníka“ zůstává poznámkou do věcného ověření.

## M04 – Plán oprav, údržba a revize (E2)

Obrazovky: víceletý plán po letech, detail akce, historie zásahů, termíny revizí. Plán používá minimálně 5 let a volitelně 10 let podle zdrojového návrhu; není to zde ověřená právní povinnost. Akce nese důvod, technický prvek, prioritu, nákladový odhad s jistotou, odpovědnost, další milník a rozhodnutí.

Příprava: Námět → Prověřit → Projekt/nabídky → Ke schválení → Schváleno → Objednáno → Realizace → Dokončeno. Vrácení zpět je možné s důvodem; zrušení se eviduje odděleně bez výmazu. Objednání vyžaduje doložené oprávnění rozhodnout, dokončení vyžaduje popis skutečného zásahu a podklad. Dokončení automaticky nezlepšuje hodnocení celého prvku bez nového ověření.

Rozpočet plánu sčítá pouze vybranou verzi akcí a měnu. Chybějící odhady ukazuje jako počet a nedostatek, nikoliv 0 Kč. Přehled odděluje předběžné náměty, schválené akce a skutečné výdaje. Intervaly revizí se zadávají podle ověřeného dokumentu nebo odborného pravidla; aplikace nesmí generovat zákonné lhůty z názvu zařízení.

## M05 – Požadavky a komunikace (E3)

Obrazovky: nový požadavek, moje požadavky, pracovní fronta výboru, detail s historií a přílohami, adresář kontaktů, přímá konverzace. Typy: závada, dotaz, návrh. Požadavek má číslo, autora, místo, popis, volitelný prvek a přílohu. Výchozí viditelnost je soukromá: autor, board a pověřený řešitel.

Životní cyklus: `new → triaged → in_progress → waiting → resolved → closed`. Z waiting lze zpět do in_progress, z resolved/closed lze znovu otevřít s důvodem. `rejected` nebo `duplicate` vyžaduje vysvětlení a při duplicitě vazbu na hlavní požadavek, která neprozradí cizí soukromé údaje. Přechod do triaged vyžaduje řešitele nebo výslovně evidovaný důvod nepřiřazení; resolved vyžaduje výsledek. Autor nemůže sám měnit interní prioritu ani označit opravu schválenou.

Diskuse u požadavku má auditovaný kontext. Přímá soukromá konverzace je samostatná a čtou ji jen účastníci. Zprávu lze převést na požadavek až vědomou volbou a se zobrazením příjemců; nepřeklopit celou historii soukromého vlákna. V první verzi stačí text a přílohy, bez složitých skupin a přítomnostních indikátorů.

Uložení požadavku vrací potvrzení a číslo. Notifikace má zvláštní stav a opakování. E-mail neobsahuje soukromé přílohy ani celý citlivý text; odkaz vede do portálu. Portál nezajišťuje havarijní službu, formulář zobrazí skutečně ověřený kontakt pro urgentní situaci.

## M06 – AI asistent (E4)

Vstupem jsou pouze publikované, schválené zdroje a strukturovaná data v rozsahu uživatele. Výstup rozlišuje doložený fakt, interpretaci a chybějící údaj; cituje verzi, stránku nebo sekci. Nemá právo publikovat dokument, potvrdit stav ani schválit výdaj. Vytěžená hodnota je návrh s důkazem a potvrzením člověka. Detaily v [AI/RAG](08_AI_A_RAG.md).

## M07 – Hospodaření (E5)

Obrazovky: rozpočet proti skutečnosti, seznam dokladů, detail výdaje/zakázky, dodavatelé a návaznost na opravy. Data se přebírají od správce po odsouhlasení formátu. Každý přehled má období, datum aktualizace, způsob účtování pohledu a úplnost vstupů.

Import: staging → kontrola duplicit a součtů → potvrzení → publikace přehledu. Opravy importu se evidují verzovaně. Souhrny nesčítají fakturu a její úhradu jako dva náklady. Vlastník vidí schválené společné finanční přehledy; individuální údaje vlastníka a neanonymizované citlivé doklady mají vlastní ACL. Modul nevytváří platby a neslibuje úplné účetnictví SVJ.

## M08 – Režim fyzického shromáždění (E6)

Příprava: datum a místo, program, podklady, návrhy usnesení, evidence pozvání a potřebného zastoupení. Průběh: neveřejné ovládání zapisovatele, oddělená projekce s povolenými údaji, přítomnost a podíly k danému bodu, znění návrhu a zaznamenaný výsledek. Po schůzi: pracovní zápis → ověření a podpisy mimo či uvnitř schváleného procesu → archivace schválené verze → úkoly z usnesení.

Před výpočtem výsledků musí být ověřeny stanovy, pravidla konkrétních rozhodnutí a stav vlastnictví. Přesné podíly se počítají bez float zaokrouhlení, spoluvlastníci a zástupce nesmějí zdvojit jednotku. Neověřené zastoupení a chybějící podíl blokují automatické potvrzení výsledku. Změna přítomnosti během schůze vytváří nový snapshot. Projekce nesmí ukázat soukromé poznámky, kontakty ani plné moci.

Mobil vlastníka může zobrazit podklady a průběh. První verze neobsahuje vzdálené závazné odevzdání hlasu. Uložený záznam fyzického hlasování není automaticky elektronický podpis ani důkaz doručení pozvánky.

## M09 – Oficiální per rollam (E7, P4)

Výchozí stav vypnuto a mimo první dodávky. Před implementací musí existovat samostatně schválené zadání opřené o aktuální stanovy, pravidla identity a zastoupení, přípustný podpis a doručení, konkrétní rozhodovací většiny, podporu papírového procesu, audit a uchování důkazů. Právní parametry tohoto procesu balíček neurčuje.

Pokud se někdy implementují orientační ankety, musí být označené jako nezávazné a datově oddělené. Tlačítko PRO/PROTI/ZDRŽEL SE, e-mailové přihlášení ani Bank iD login samy o sobě v tomto zadání nezakládají tvrzení o platném oficiálním hlasu.
