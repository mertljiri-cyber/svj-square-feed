# První implementační balík pro další zadání

Stav: **PŘIPRAVENÉ ZADÁNÍ, NEPROVEDENO**. Kopírovat agentovi až ve chvíli, kdy má uživatel skutečně zahájit změny lokálního vývojového projektu.

## Doporučené zadání

> V lokálním projektu mertljiri-cyber/svj-square-feed implementuj pouze E0 z předávací dokumentace: SEC-01 až SEC-07. Nejprve přečti dokumentaci a skutečné instrukce repozitáře, porovnej HEAD s d9e67ec92fda83c2fef627f17f2d8e1690bb894c a aktualizuj audit rozdílů. Zachovej existující novinky, záměry a formuláře s novými bezpečnými pravidly. Vytvoř oddělenou pracovní větev, identitu a schvalované členství, role, přímé API/RLS kontroly, serverovou validaci, audit a postup obnovy. Nepřepisuj původní migraci. Používej vývojové/testovací prostředí a syntetická data. Neprováděj produkční migrace, push, publikaci Lovable ani odesílání zpráv reálným lidem bez odpovídajícího samostatného pokynu. Zjisti neznámé vstupy z dostupné konfigurace; pokud něco chybí, pokračuj v nezávislé práci a popiš konkrétní blokovanou část. Výstupem je reviewovatelný diff a důkazy provedených kontrol, ne tvrzení o produkční připravenosti bez ověření.

## Požadované výsledky E0

1. Baseline aktuálního kódu a testovací konfigurace bez secretů.
2. Přihlašovací tok a členství oddělené od identity; role nejsou ovladatelné běžným uživatelem.
3. Inkrementální migrace rušící široké veřejné politiky a zavádějící kontrolu tenantů, autorství a povolených změn stavů.
4. Omezená správa rolí, bezpečný bootstrap, odvolání členství a audit.
5. Výsledky T-SEC-01–06 a T-OPS-01; build, lint a typová kontrola podle skutečného projektu. Testovací infrastrukturu doplnit, protože ve výchozím commitu není.
6. Návod spuštění a obnovy, přehled toho, co je lokálně ověřené, co nasazené do testu a co čeká na rozhodnutí.

První balík nepřidává archiv, technický import, AI, finance ani hlasování. Jejich datové potřeby jsou známé, ale samostatná implementace následuje až po G0. To neznamená, že se má vytvořit celá cílová databáze předem.

## Následující zadání po G0

E1: DOC-01 až DOC-04, dvě verze dokumentu a bezpečný přístup včetně obnovy. E2: TEC-01 až TEC-05 podle skutečného Excelu, nejprve suchý import, potom potvrzené převzetí. E3: REQ-01 až REQ-05 a úplný pilot. Po každé etapě aktualizovat stav backlogu a nedeklarovat další etapu hotovou jen proto, že je navržená v dokumentaci.

## Kontrolní formulář předání implementace

| Pole | Vyplní implementující agent |
|---|---|
| Výchozí HEAD / výsledný commit | Doplnit skutečné SHA |
| Dokončené karty | Pouze skutečně splněná ID |
| Změněné tabulky a politiky | Seznam migrací a důvod |
| Provedené testy a prostředí | Konkrétní výsledky, datum, role |
| Neprovedené kontroly | Důvod a dopad |
| Nasazení | Lokálně / test / produkce, s důkazem |
| Vrácení změny | Vyzkoušený postup a omezení |
| Zbývající vstupy | Konkrétní položky O01–O13 |
