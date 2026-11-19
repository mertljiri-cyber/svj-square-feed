# Produktové zadání

Stav: **NÁVRH**. Zdroj současného stavu: [audit](00_STAV_A_ZDROJE.md). Toto zadání nepředstavuje schválený rozpočet ani usnesení SVJ.

## Problém a zamýšlený výsledek

Současná kostra publikuje novinky, záměry a formuláře. Pro řízení domu chybí bezpečný přístup, dohledatelná dokumentace, evidence technických znalostí a cesta od hlášení problému k odpovědnosti, opravě a podkladům. Cílem je jedno místo, kde vlastník zjistí, co je doloženo, co se teprve ověřuje a jaký je další krok.

Jádrem produktu je vazba **technický prvek → zjištění → požadavek → oprava/zakázka → dokument a náklad → případné usnesení**. Moduly sdílejí identity, oprávnění, dokumentové odkazy a historii.

## Uživatelé a úkoly

| Role | Hlavní potřeba |
|---|---|
| Vlastník | Najít oprávněné podklady, nahlásit problém, sledovat vlastní požadavek, vidět společný plán oprav |
| Předseda / člen výboru | Spravovat oprávnění, dokumenty, odpovědnosti, termíny a návrhy rozhodnutí |
| Smluvní správce | Pracovat jen s přidělenými doménami a záznamy, dokládat provedené úkony |
| Technický správce / odborník | Dodat konkrétní hodnocení s datem a důkazem; neměnit vlastníky a finance bez přiděleného práva |
| Administrátor systému | Provozovat účty a konfiguraci; samotná provozní role automaticky neuděluje čtení soukromé korespondence |
| Veřejný návštěvník | Vidět jen výslovně publikované veřejné informace |

Jedna osoba může mít více rolí. Vlastnictví jednotky, přístup do aplikace a hlasovací oprávnění jsou různé vztahy. Pouhé přihlášení neznamená ověřené vlastnictví.

## Rozsah a priority

| Priorita vývoje | Funkce | Výsledek |
|---|---|---|
| P0 | Identita, schvalované členství, role, databázová a souborová práva, audit a ověřená obnova | Bezpečný základ před skutečnými neveřejnými daty |
| P1 | Archiv dokumentů | Verze, metadata, soukromé úložiště, odkazy a hledání |
| P1 | Technický registr, ověřování stavu, opravy a revize | Převzetí 21 skutečně pojmenovaných prvků Excelu, jasné nejistoty a odpovědnost |
| P1 | Požadavky, kontakty, konverzace | Evidované přijetí, stav, odpovědná osoba, přílohy a historie |
| P2 | AI nad dokumenty | Citované odpovědi pouze z oprávněných zdrojů; návrhy k potvrzení |
| P2 | Hospodaření | Ověřené importy přehledů, rozpočet a skutečnost, vazby na opravy |
| P3 | Režim fyzického shromáždění | Příprava, podklady, evidence průběhu a schválený zápis |
| P4 | Oficiální per rollam | Samostatný právně posouzený projekt, standardně vypnuto |

## První provozní pilot

Pilot má zahrnovat výbor, jednoho pověřeného správce a malou skupinu vlastníků; počet účastníků určí vlastník produktu. Použije se schválená sada reálných dokumentů až po bezpečnostní bráně, předtím jen syntetická data. První pilot neobsahuje AI, účetnictví ani právně závazné elektronické hlasování.

Povinné průchody: pozvání a odvolání uživatele; nahrání dvou verzí dokumentu; import registru s přehledem chyb; doplnění plánu ověření neznámého stavu; nahlášení závady a její vyřízení; provázání opravy s důkazem. Viz [scénáře](prilohy/SCENARE_PILOTU.md).

## Měřitelné cíle pilotu

Následující cíle jsou návrhem pro akceptaci, nikoliv naměřenou současnou úrovní:

- 100 % negativních přístupových scénářů v testovací matici zablokováno na API i v úložišti.
- 21 pojmenovaných prvků zdroje dohledatelných pod původními ID, 4 rezervy viditelné v importním protokolu. Žádná automaticky vytvořená oprava bez podkladu.
- U každého prvku explicitní stav znalosti. U chybějící odpovědnosti, způsobu ověření či termínu viditelný nedostatek; úplnost se před pilotem postupně doplní.
- Každý přijatý požadavek má stabilní číslo, autora, stav a audit; změna stavu je dohledatelná.
- Vlastník při řízeném ověření najde vybraný dokument a stav svého požadavku bez pomoci správce. Měří se úspěch úlohy, ne počet kliknutí.
- Zálohu databáze a souborů lze obnovit do izolovaného prostředí se zachováním vazeb.

## Uživatelská zkušenost

České prostředí, mobilní i desktopová obsluha, čitelné stavy a ovládání klávesnicí. Žádný obsah nesmí zmizet pod „0 položek“, pokud selhalo načtení. Rozlišovat načítání, prázdný seznam, chybu, neexistující záznam a chybějící oprávnění bez prozrazení citlivého obsahu.

Cílová navigace: Přehled; Dokumenty; Stav domu a plán oprav; Požadavky a komunikace; později Hospodaření a Shromáždění. Administrace jen podle oprávnění. AI se přidá do dokumentů a detailů prvků po P1, nemusí být samostatnou hlavní položkou. Novinky zůstávají součástí přehledu. Staré URL záměrů musí mít funkční detail nebo řízený přechod na propojený záznam.

## Co není součástí cíle první verze

Vlastní účetní systém, automatické bankovní platby, veřejná sociální síť, nepřetržitý komunitní chat, automatické technické posudky, právní rozhodování AI, BIM/3D propojení a plošné převzetí osobních údajů z jiných dokumentů. Existence lokálního 3D prohlížeče nezakládá požadavek na jeho integraci.

## Správa produktu a dat

Vlastník produktu schvaluje rozsah a pilot. Výbor určí správce dokumentů a technického registru. Technické závěry potvrzuje pověřený člověk s odpovídající odborností. Správce finančních podkladů ručí za věcnou shodu importů se zdrojem. Coding agent dodává implementaci a důkazy testů, nikoliv schválení technického stavu budovy.
