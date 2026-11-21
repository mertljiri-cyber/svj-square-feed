# Dům spolu · implementační plán pro převzetí projektu

**Cíl:** dokončit českou, samostatně spustitelnou ukázku rozhraní pro správu SVJ. Člen výboru v ní například zaznamená závadu, změní její stav a změnu okamžitě uvidí v přehledech. Vlastník najde termín události, otevře dokument a odpoví v ukázkové anketě. Výchozím měřítkem věrnosti je shoda uživatelských postupů, informační struktury a rozložení hlavních obrazovek. Dům spolu má vlastní název, grafiku a česká fiktivní data.

**Rozhodnutí pro první vydání:** zachovat místní provoz bez účtu, jedno ukázkové společenství a otevření aplikace dvojklikem. Toto je doporučené zadání pro implementaci, nikoli schválení nasazení pro skutečné vlastníky. Technologie ani přesná míra vizuální věrnosti nebyly uživatelem předepsány.

## 1. Kde začít a čemu věřit

Tento plán patří k adresáři `dum-spolu/`. Všechny níže uvedené projektové cesty jsou relativní k němu. Výchozí aplikace je `index.html`, dosavadní popis je `README.md`. Zdroj pro další průzkum je [veřejné demo na obrazovce Přehledy](https://demo.svjaplikace.cz/prehledy?svj=svj_99b54efc). Prohlídka proběhla 21. 11. 2026 přes předvyplněný demovstup. Provozovatel při vstupu uváděl, že data jsou fiktivní a odstraňování obsahu a notifikační e-maily jsou vypnuté.

| Oblast | Zjištění z dema | Co je dnes v prototypu |
|---|---|---|
| Společný rámec | Levý panel, skupiny Oblíbené a Menu, hlavička společenství, název stránky | 22 položek, jednoduché skupiny, mobilní menu a navigace přes fragment URL |
| Přehledy a Nástěnka | Pět skupin přehledů s přechodem na seznam či detail. Nástěnka obsahuje zprávy, události a kontakty | Přehledy a nástěnka se vykreslují. Některé údaje jsou pevně zapsané, například počty vlastníků |
| Hlášení | Záložky stavů s počty, výběr řádků, hledání, filtry, sloupce, řazení a vstupy do detailu a formuláře. Uložení změny v cizím demu nebylo ověřeno | Vytvoření, detail, změna stavu, hledání a filtrování jsou implementované v kódu |
| Dokumenty | Složky i soubory, nabídka vytvoření, vyhledání a akce u řádků | Několik názvů složek v plochém seznamu s obecným detailem |
| Diskuze, revize, kalendář | Jejich obsah byl vidět na přehledových kartách. Samostatné pracovní postupy vyžadují průzkum | První dvě sekce mají seznamy, kalendář ukazuje pevný seznam za listopad 2026 |
| Další agendy | Známé jsou názvy a umístění v navigaci. Hlídání plateb je v originálu rozbalovací | Ostatních 15 položek vede na zástupné stránky, včetně Anket |

Při předchozím předání prošla kontrola syntaxe JavaScriptu. Interakce v prohlížeči ani úspěšná publikace tehdy potvrzeny nebyly.

## 2. Pořadí realizace a předávací body

Každá etapa má vlastní ověřitelný výsledek. Doporučená posloupnost je **A → B → C → D → E**. Po B lze samostatně doplňovat jednotlivé agendy podle mapy v § 3. C je první použitelný mezivýsledek. Úplné místní demo vyžaduje také D a E.

### A · Reprodukce a doplnění mapy

1. Pracovat v nové větvi či oddělené kopii. Otevřít původní HTML, uložit jedno zkušební hlášení v odděleném profilu a zkontrolovat je po obnovení. Zopakovat průchod přes Přehledy, tlačítko Zpět a mobilní menu. Zaznamenat prostředí a skutečný výsledek.
2. V originálním demu projít každou položku menu včetně podnabídek. U přehledu, seznamu, detailu a formuláře zaznamenat viditelná pole, povinné údaje, filtry, stavové přechody, prázdný stav, návratovou navigaci a dostupnost podle zobrazené role. Stačí číst a otevírat formuláře. Ověření zápisů provádět na místní kopii.
3. Výsledek uložit do `docs/mapa-rozhrani.md` jako tabulku „sekce / pohled / pozorovaná akce / výsledek / omezení / odpovídající místní obrazovka“. U nedostupného detailu uvést „neověřeno“ a případný vlastní návrh. Referenční snímky slouží ke srovnání při práci, do distribuovaného rozhraní patří vlastní prvky.

**Převzetí:** mapa pokrývá všech 22 položek a zjištěné podnabídky. Další agent z ní pozná, které funkce byly vidět, které byly vyzkoušeny a které jsou návrhem.

### B · Zachování místních dat a společné ovládání

1. Oddělit čitelný zdroj od výsledného HTML. Praktická volba je běžný JavaScript, CSS a malý sestavovací skript, který vloží vše potřebné do `dist/index.html`. Navržené členění je `src/app.js` pro navigaci, `src/store.js` pro data, `src/features/` pro agendy, `src/ui/` pro sdílené ovládání a `src/demo/` pro vlastní příklady. Načítání ze sítě při otevření HTML není potřeba.
2. Zavést trvalá ID a verzi dat. Stávající detail a změna stavu používají index v poli. Nový detail musí po filtrování a řazení otevřít správný záznam podle ID. Převést staré tvary `reports`, `discussions`, `revisions`, `events` a `docs` z klíče `dum-spolu-v1`, včetně českých názvů stavů a již přidaných hlášení.
3. Při prvním otevření načíst původní data, vytvořit novou verzi vedle nich, ověřit její zpětné načtení a až pak ji používat. Opakované otevření nesmí duplikovat záznamy. Při porušených datech nebo odmítnutém zápisu zobrazit srozumitelnou zprávu a zachovat původní obsah. Volitelný reset ukázky smí zasáhnout pouze její vlastní data.
4. Oddělit identifikátor obrazovky od přeloženého názvu. Staré odkazy jako `#Ankety` zachovat převodem. Seznam, detail i změna filtru mají předvídatelný návrat. Sdílet vyhledávání, stavové štítky, tabulky, dialogy a prázdné stavy. Dialog má popisek, podporu Escape a návrat fokusu. Na mobilu musí jít menu zavřít i bez výběru položky.

**Převzetí:** stejný příklad lze otevřít dvojklikem i ze statického serveru. V každém prostředí se samostatně ověří přežití záznamu po obnovení. Zpět z detailu vrátí původní filtr. Změna řazení neovlivní identitu upraveného hlášení.

### C · Dokončení hlavního průchodu od hlášení k přehledu

1. Dokončit seznam hlášení podle mapy z A. Počty na záložkách počítat nad stejnými daty jako přehledy. Implementovat řazení, výběr viditelných sloupců a jen ty hromadné akce, které mají definovaný význam. Prázdný či pouze mezerový název při uložení odmítnout, rozepsaný popis zachovat.
2. V detailu zobrazit typ, popis a stav. Změnu uložit právě jednou. Po uložení aktualizovat seznam, počet na záložce a kartu otevřených hlášení ze stejného zdroje. Stavy převzít z ověřené mapy. Místní pravidla, která se nepodařilo ověřit v demu, popsat v mapě.
3. Nahradit pevná čísla v přehledech výpočty. Otevřené diskuze, nadcházející události, dokončené revize a počty vlastníků odvodit z příslušných evidencí. Pro reprodukovatelnou ukázku lze zvolit pevné referenční datum, které musí být v UI viditelné. Časy a data ukládat strukturovaně a zobrazovat česky.

**Převzetí:** vytvořit „Porucha dveří u kolárny“, ověřit zvýšení počtu nových hlášení o jedno, převést do řešení a pak vyřešit. Po obnovení zůstane záznam mezi vyřešenými, zmizí z karty otevřených hlášení a celkový počet se při samotné změně stavu nezmění.

### D · Implementace dalších agend

Postupovat po skupinách v tabulce níže. Pro každou nejprve zkontrolovat mapu z A, doplnit vzorová data, postavit uvedený pracovní postup a ověřit jeho dopad na související obrazovku. U řádku spojujícího více agend musí mít každá uvedená agenda vlastní smysluplný vstup. První na řadě jsou evidence domu a dokumenty, protože poskytují data pro další stránky.

## 3. Rozsah jednotlivých agend a jejich přejímka

Následující scénáře jsou **návrhem cílového místního dema**. Zejména u financí, hlasování a datové schránky upřesnit rozsah podle výsledků etapy A.

| Agenda | Implementace | Praktická přejímka |
|---|---|---|
| Detail společenství, Jednotky a místnosti, Vlastníci a sousedé | Vlastní model domu, jednotky a osoby. Vazbu osoba–jednotka vést samostatně kvůli spoluvlastnictví. Aktivaci vést jako ukázkový stav | Jednotka se dvěma vlastníky zobrazí oba. V přehledech se započítá jednou |
| Adresář kontaktů, Zprávy, Nástěnka | Místní kontakty s rolí, zprávy s platností, propojená nástěnka | Aktivní zpráva a důležitý kontakt se otevřou z nástěnky. Po skončení platnosti zpráva z aktuálního výpisu zmizí |
| Dokumenty, Fotogalerie | Strom složek s nadřazeným ID, drobečková navigace, detail a otevření vzorového souboru. Galerie s vlastním obrázkem a popiskem. Pokud mapa potvrdí požadavek na místní nahrávání, použít pro obsah souborů IndexedDB | Dvě složky mohou mít stejnojmenný soubor. Otevře se správný obsah. Návrat zachová složku. Obrázek má dostupný textový popis |
| Kalendář událostí, Revize a termíny | Přechod mezi měsíci, detail a vícedenní události. Oddělit termín revize od jejího dokončení. Propojit s kartami | Událost přes hranici měsíce je vidět v obou měsících. Dokončená revize přestane zvyšovat počet revizí po termínu |
| Diskuze, Ankety | Vlákno a příspěvky, u ankety otázka, varianty, možnost odpovědi a výsledky podle mapy. Použít jednu ukázkovou identitu | Příspěvek přetrvá po obnovení. Hlas v anketě se započte jednou a uzavřená anketa další odpověď nepřijme |
| Hlasování, Shromáždění vlastníků | Oddělené záznamy návrhu, jednání a výsledku. Vazba na jednotku a podíl jen tam, kde je doložená. Způsob výpočtu výslovně popsat jako pravidlo ukázky | Výsledek lze reprodukovat z ukázkových vstupů. Z jednání se otevře správný bod a jeho podklad |
| Požadavky ke schválení, Koš | Místní rozhodnutí se stavem a vazbou na záznam. Obnovitelné odstranění tam, kde je součástí navrženého pracovního postupu | Opakované potvrzení jedné žádosti nevytvoří dvě rozhodnutí. Obnovená položka se vrátí do původní evidence |
| Přehled poplatků, Pokladna, Hlídání plateb | Rozbalovací navigace podle A. Místní předpisy, modelové úhrady, pokladní pohyby. Ukládat částky v haléřích a formátovat je v Kč. První scénář provést ručním přiřazením modelové úhrady | Předpis 1 200 Kč a úhrada 800 Kč zobrazí zbývajících 400 Kč. Opakované otevření detailu nezmění saldo. Výdaj v pokladně sníží její zůstatek právě jednou |
| Datová schránka | Místní přehled fiktivních zpráv s jasným označením simulace. Zobrazení odesílatele, data, přílohy a detailu podle mapy | Otevření přepne místní stav přečtení a zpřístupní ukázkovou přílohu. Rozhraní nesmí vytvářet dojem skutečného doručení |

### E · Ověření a předání vydání

- **Data a návaznosti.** Ověřit prázdnou instalaci, migraci z původní verze s vlastním hlášením, druhé spuštění po migraci a chybu zápisu. Použít i stejný název u dvou záznamů, nulové výsledky filtru a text se znaky HTML. Obsah zadaný uživatelem se má zobrazit doslovně.
- **Prohlížeč.** Zkontrolovat skutečné klikací průchody z C a tabulky D. Otestovat klávesnici, přímý odkaz, obnovení detailu, Zpět/Vpřed a úzkou obrazovku přibližně 390 px. Na široké obrazovce porovnat stejné pohledy s demem, zejména hierarchii navigace, pořadí karet, stavové štítky a umístění hlavní akce.
- **Distribuce.** Sestavit čisté HTML, otevřít je z nové složky bez připojení k internetu a provést alespoň vytvoření a opětovné načtení hlášení. Přiložit čitelný zdroj, postup sestavení a README s přesným rozsahem. ZIP po vytvoření rozbalit a ověřit právě rozbalenou verzi.
- **Záznam výsledků.** Do `docs/predani.md` uvést verzi, prohlížeč, způsob spuštění, ověřené scénáře a otevřené odchylky. Pokud některou sekci blokuje chybějící přístup, uvést konkrétní neověřený krok. Položka se zástupným textem se nezapočítává mezi dokončené sekce.

## 4. Hranice následné produkční práce

Pro používání skutečným SVJ by bylo potřeba samostatně rozhodnout o sdíleném úložišti, přihlášení, přístupu vlastníka k jeho jednotkám, pravomocích výboru, zálohách, evidenci změn a způsobu správy osobních údajů. Podobně vyžadují samostatné zadání skutečné bankovní služby, datová schránka, e-maily a závazné hlasování. Místní demo lze dokončit a převzít nezávisle na těchto rozhodnutích.

**První konkrétní úkol pro přebírajícího agenta:** otevři stávající aplikaci v odděleném profilu, projdi cyklus jednoho hlášení a zapiš výsledek. Poté v referenčním demu zmapuj nejprve Hlášení, Dokumenty a Ankety. Tyto tři stránky reprezentují již částečně funkční agendu, jednoduchý seznam bez skutečného obsahu a dosud zástupnou stránku. Po dokončení inventury ostatních sekcí začni etapou B.
