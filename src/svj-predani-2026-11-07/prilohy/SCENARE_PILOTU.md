# Pilotní uživatelské scénáře

Stav: návrh scénářů pro E0–E3. Následující jména dokumentů, závady a akce jsou syntetické příklady. Nejsou skutečným hodnocením domu.

## A – Vlastník, dokument a znepřístupnění

Board pozve testovacího vlastníka a potvrdí jeho členství. Vlastník se přihlásí, najde publikovaný společný dokument a otevře jeho aktuální verzi. Nevidí koncept ani restricted dokument jiného uživatele. Board odebere členství; další přímý API požadavek interní data nevrátí, seznam i cache v UI se znepřístupní. Dříve staženou lokální kopii nelze vzdáleně odebrat.

Akceptace: účastník rozumí rozdílu mezi veřejnými a interními informacemi; tester doloží API a souborový výsledek, nikoliv jen screenshot menu.

## B – Převzetí registru a doplnění znalosti

Importer zvolí původní sešit a provede dry-run. Vidí 21 pojmenovaných prvků, čtyři rezervy a prázdný plán oprav. Po potvrzení se T-013 „Příprava a cirkulace TUV“ objeví s původním unknown a označením importovaného návrhu. Technik doplní konkrétní způsob ověření, skutečně pověřenou osobu a dohodnutý termín. Žádná cena ani odborný stav se nevytvoří automaticky.

Akceptace: dashboard ukáže, co chybí, a nezobrazí dům jako bezrizikový podle nul kritických hodnocení. Opakovaný import nepřidá druhé T-013.

## C – Závada, řešení a propojené důkazy

Vlastník v testu nahlásí „Nestabilní teplota vody“ a vybere T-013. Přiloží syntetickou fotografii, získá číslo požadavku. Board požadavek přiřadí, řešitel doplní výsledek prohlídky a vloží testovací zprávu do archivu. Oprávněný technik potvrdí nové hodnocení jen podle vloženého důkazu. Pokud vznikne návrh opravy, je propojen s prvkem i požadavkem a nese odhad nebo explicitní chybějící odhad.

Akceptace: vlastník vidí postup svého požadavku; jiný vlastník nevidí jeho soukromý text ani přílohu. Změna technického hodnocení má samostatné potvrzení, historie zůstává dohledatelná. E-mailová chyba nevymaže již přijatý požadavek.

## D – Dvě verze a chyba uploadu

Správce nahraje syntetickou revizní zprávu v1. Při nahrávání v2 se spojení přeruší; v1 zůstává publikovaná. Opakované nahrání bezpečně dokončí v2. Historický důkaz u hodnocení stále otevře v1. Výměna aktuální verze má audit a správnou audience.

Akceptace: žádný prázdný dokument ve stavu ready, žádná přepsaná v1, žádné veřejné URL. Chyba extrakce textu je vidět odděleně od dostupnosti originálu.

## E – Soukromá zpráva a požadavek

Vlastník napíše kontaktní osobě do přímé konverzace. Board člen mimo účastníky ji neotevře. Příjemce nabídne založení požadavku z vybraného textu; UI nejprve ukáže, že jej uvidí board a přidělený řešitel. Převede se pouze vybraný text, nikoliv zbytek konverzace.

Akceptace: změna audience je vědomá a dohledatelná. Konverzace i nový požadavek dodržují samostatná práva.

## Pozdější kontrolní průchody

E4: dotaz na stav střechy přizná nedoložený stav a cituje T-001; požadavek na cizí restricted dokument se odmítne bez úniku. E5: stejná testovací faktura importovaná dvakrát nevytvoří dvojnásobný výdaj. E6: změna účasti během fyzické schůze nezmění historický snapshot; projekce neobsahuje soukromé podklady. Tyto průchody nepatří do akceptace první bezpečnostní implementace.
