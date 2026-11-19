# Inventář původního technického Excelu

Stav: **DOLOŽENO EXCELEM**, čtení 7. 11. 2026. Originál nebyl upraven.

Soubor: `/Users/Jiri.Mertl/Documents/SVJ/Technicky_registr_SVJ_Pod_Trebesinem.xlsx`. SHA-256: `fe6fdd440de42db10b3c0a58cd7d2078ec9be4fb737f38b3498d0ecf720b6515`.

Nejde o odborné potvrzení technického stavu ani o databázový import. Mapování a pravidla převzetí stanoví [importní specifikace](../09_IMPORT_TECHNICKEHO_EXCELU.md).

## Listy

| List | Rozsah podle sešitu | Neprázdné řádky |
|---|---|---|
| Závazný rámec | 40 řádků × 8 sloupců | 29 |
| Technický registr | 196 řádků × 23 sloupců | 27 |
| Plán oprav | 200 řádků × 14 sloupců | 2 |
| Přehled | 10 řádků × 8 sloupců | 9 |
| Číselník | 17 řádků × 6 sloupců | 16 |

Rozsah zahrnuje formátované a připravené prázdné řádky. Jejich počet není počet skutečných datových položek.

## Technické položky

| Řádek | ID | Oblast | Prvek / systém | Umístění / rozsah | Kritičnost | Stav |
|---|---|---|---|---|---|---|
| 4 | T-001 | Střecha | Střešní plášť a hydroizolace | Všechny objekty / střecha | Vysoká | Nezjištěno |
| 5 | T-002 | Střecha | Klempířské prvky a odvodnění střechy | Všechny objekty / střecha | Střední | Nezjištěno |
| 6 | T-003 | Obvodový plášť | Fasáda, spáry, zateplení | Všechny fasády | Střední | Nezjištěno |
| 7 | T-004 | Obvodový plášť | Balkony / lodžie a zábradlí | Dle prohlášení vlastníka | Vysoká | Nezjištěno |
| 8 | T-005 | Nosné konstrukce | Nosné konstrukce, trhliny, statické projevy | Celý dům | Vysoká | Nezjištěno |
| 9 | T-006 | Spodní stavba | Základy, hydroizolace, vlhkost | Suterén / obvod domu | Vysoká | Nezjištěno |
| 10 | T-007 | Interiéry | Společné chodby a schodiště | Všechny vchody | Nízká | Nezjištěno |
| 11 | T-008 | Vstupy | Vstupní dveře, zámky, zavírače | Všechny vchody | Střední | Nezjištěno |
| 12 | T-009 | Okna | Okna ve společných částech | Společné prostory | Nízká | Nezjištěno |
| 13 | T-010 | ZTI | Rozvody studené a teplé vody | Stoupačky a společné rozvody | Vysoká | Nezjištěno |
| 14 | T-011 | ZTI | Kanalizace a odpadní potrubí | Stoupačky a ležaté rozvody | Vysoká | Nezjištěno |
| 15 | T-012 | Vytápění | Rozvody vytápění / předávací části | Společné části | Vysoká | Nezjištěno |
| 16 | T-013 | TUV | Příprava a cirkulace TUV | Společné části | Vysoká | Nezjištěno |
| 17 | T-014 | Elektro | Hlavní a společné elektroinstalace | Rozvaděče, chodby, společné prostory | Vysoká | Nezjištěno |
| 18 | T-015 | Elektro | Společné osvětlení | Chodby, sklepy, vstupy | Střední | Nezjištěno |
| 19 | T-016 | Hromosvod | Ochrana před bleskem / uzemnění | Střecha a společné části | Vysoká | Nezjištěno |
| 20 | T-017 | Požární bezpečnost | Požární uzávěry, značení, hasicí prostředky | Společné prostory | Vysoká | Nezjištěno |
| 21 | T-018 | Komunikace | Domovní telefony, zvonky, přístupový systém | Všechny vchody | Střední | Nezjištěno |
| 22 | T-019 | Sklepy | Sklepní prostory, vlhkost, konstrukce | Suterén | Střední | Nezjištěno |
| 23 | T-020 | Pozemek | Plot, brány, zpevněné plochy | Pozemek SVJ | Střední | Nezjištěno |
| 24 | T-021 | Technologie | Ostatní společná technická zařízení | Dle vybavení domu | Střední | Nezjištěno |
| 25 | T-022 | — | — | — | — | — |
| 26 | T-023 | — | — | — | — | — |
| 27 | T-024 | — | — | — | — | — |
| 28 | T-025 | — | — | — | — | — |

T-022 až T-025 jsou rezervy s jedinou hodnotou ID; pomlčky v tabulce znamenají prázdné zdrojové buňky. U pojmenovaných prvků jsou G:W prázdné.

## Definice z Číselníku

| Řádek | Pole | Hodnota | Definice | Očekávaná reakce |
|---|---|---|---|---|
| 4 | Stav | A – velmi dobrý | Bez významné vady; běžná údržba. | Standardní sledování. |
| 5 | Stav | B – dobrý | Drobné vady bez významného dopadu na funkci. | Běžná údržba / plánovat drobné opravy. |
| 6 | Stav | C – uspokojivý | Funkční, ale se známkami opotřebení nebo dílčími závadami. | Zařadit do střednědobého plánu. |
| 7 | Stav | D – špatný | Významná závada nebo degradace; hrozí růst škody / omezení funkce. | Připravit konkrétní zásah, typicky do 1–3 let nebo dříve dle rizika. |
| 8 | Stav | E – kritický | Bezprostřední nebo vysoké riziko havárie, škody, bezpečnosti nebo nefunkčnosti. | Neprodlené prověření a rozhodnutí o zásahu. |
| 9 | Stav | Nezjištěno | Stav není dostatečně znám nebo doložen. | Stanovit způsob a termín ověření. |
| 10 | Jistota znalosti | Vysoká | Aktuální revize, odborná prohlídka nebo jednoznačný dokumentovaný stav. | — |
| 11 | Jistota znalosti | Střední | Stav je znám z běžné kontroly nebo staršího podkladu bez známky změny. | — |
| 12 | Jistota znalosti | Nízká | Odhad, nepřímá informace, starý nebo neúplný podklad. | Vyžaduje ověření. |
| 13 | Priorita | P1 – ihned | Bezpečnost, havárie, významné riziko škody nebo zákonný/revizní nesoulad. | Řešit bez odkladu. |
| 14 | Priorita | P2 – do 1 roku | Významná závada, která má být připravena/odstraněna v nejbližším rozpočtovém období. | — |
| 15 | Priorita | P3 – 1–3 roky | Střednědobá oprava / obnova. | — |
| 16 | Priorita | P4 – 3–5 let | Plánovaná obnova bez akutního rizika. | — |
| 17 | Priorita | P5 – >5 let | Dlouhodobá obnova. | — |

## Skutečné seznamové validace

| List | Rozsah | Povolené hodnoty podle formula1 |
|---|---|---|
| Závazný rámec | C20:C26 | Ano,Částečně,Ne |
| Technický registr | E4:E196 | Vysoká,Střední,Nízká |
| Technický registr | F4:F196 | A – velmi dobrý,B – dobrý,C – uspokojivý,D – špatný,E – kritický,Nezjištěno |
| Technický registr | L4:L196 | Vysoká,Střední,Nízká,Nezjištěno |
| Technický registr | P4:P196 | P1 – ihned,P2 – do 1 roku,P3 – 1–3 roky,P4 – 3–5 let,P5 – >5 let,Sledovat |
| Technický registr | Q4:Q196 | 0–1 rok,1–3 roky,3–5 let,5–10 let,>10 let,Bez zásahu,Neurčeno |
| Technický registr | S4:S196 | Vysoká,Střední,Nízká,Nezpracován |
| Technický registr | V4:V196 | Otevřeno,Plánováno,Objednáno,Realizace,Uzavřeno,Sledovat |
| Plán oprav | E4:E200 | P1 – ihned,P2 – do 1 roku,P3 – 1–3 roky,P4 – 3–5 let,P5 – >5 let |
| Plán oprav | H4:H200 | Vysoká,Střední,Nízká,Nezpracován |
| Plán oprav | I4:I200 | Námět,Prověřit,Projekt / nabídky,Ke schválení,Schváleno,Objednáno,Realizace,Dokončeno |

Validace se částečně liší od definic Číselníku: zejména Sledovat, Nezjištěno v jistotě znalosti, Nezpracován, horizonty a stavy přípravy. Tyto rozdíly se při převzetí zachovávají a pojmenovávají.

## Přehled a jeho omezení

B4 počítá COUNTA nad ID A4:A196: zahrnuje 25 ID včetně rezerv. B5 počítá 21 výslovných Nezjištěno ve F4:F196. B6–B10 mají uloženou nulu; nevyplněná pole ovšem nejsou odborný důkaz absence problému. Nákladové součty E4:E10 mají uložené nuly při prázdných odhadech. Zdrojový plán oprav je prázdný.

Přehled plánovaných nákladů odkazuje na horizonty a odhady v Technickém registru, nikoliv na prázdný list Plán oprav. Cílový systém proto musí výslovně určit autoritu plánu a zabránit dvojímu započtení technického odhadu a opravné akce.

List Závazný rámec obsahuje návrh pravidel a doporučeného usnesení. Není vyplněné datum účinnosti ani identifikace skutečného schválení; nadpis Závazný rámec není důkaz jeho právní závaznosti.
