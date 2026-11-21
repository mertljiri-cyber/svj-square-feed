# Dům spolu – samostatný prototyp

Otevřete `index.html` ve svém prohlížeči. Aplikace nepotřebuje instalaci ani server. Změny hlášení se ukládají do místního úložiště daného prohlížeče a nejsou sdíleny mezi uživateli ani zařízeními. Vymazání dat prohlížeče je může odstranit. Nevkládejte do prototypu skutečné osobní nebo citlivé údaje.

Pro další práci je připravený [implementační plán](IMPLEMENTACNI-PLAN.md).

## Co bylo zmapováno

- Přehledy: karty hlášení, otevřených diskuzí, revizí, událostí a počtů vlastníků a jednotek; odkazy na seznamy a detaily.
- Nástěnka: poslední zprávy, události a důležité kontakty.
- Hlášení: seznam, stavy, vyhledávání, volba sloupců, detail a vytvoření.
- Dokumenty: seznam složek a souborů, hledání, vytvoření a akce u záznamů.
- Další stránky byly identifikovány z navigace, ale jejich obsah a chování nebyly podrobně prozkoumány.

Zdrojové demo výslovně uvádí, že veškerá jeho data jsou fiktivní. Tato aplikace používá samostatná vzorová data; podobnosti názvů záznamů slouží k přiblížení struktury dema.

## Rozsah prototypu

Fungují navigace, přehledové karty, seznamy hlášení, diskuzí, revizí a dokumentů, vyhledávání, filtrování hlášení, detaily, přidání hlášení a změna jeho stavu. Další položky navigace zobrazují označené zástupné stránky. Dokumenty nejsou skutečné soubory; kalendář je ukázkový seznam, nikoli plnohodnotný kalendář. Není implementováno přihlášení, server, oprávnění, sdílení, nahrávání souborů ani notifikace. Vizuál a data představují vlastní interpretaci, nikoli úplnou kopii všech funkcí zdroje.
