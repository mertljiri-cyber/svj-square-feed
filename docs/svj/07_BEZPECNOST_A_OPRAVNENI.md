# Bezpečnost a přístupová pravidla

Stav: **NÁVRH**. Konkrétní mezery současné migrace F01–F08 jsou v [auditu](00_STAV_A_ZDROJE.md). G0 musí projít před skutečnými neveřejnými daty.

## Klasifikace a matice

Výchozí pravidlo je zamítnout, pokud není výslovné oprávnění. Aktivní členství se ověřuje při každém API požadavku. Přihlášený uživatel bez aktivního členství má rozsah veřejného návštěvníka. Role manager a technical mají pouze jmenovitě přidělený rozsah; „správce domu“ není univerzální administrátor dat.

| Objekt / operace | Veřejnost | Vlastník | Board | Pověřený manager/technical | Samotný system_admin |
|---|---|---|---|---|---|
| Publikované veřejné novinky | čtení | čtení | správa | jen delegace | žádné zvláštní obsahové právo |
| Interní novinky / společné přehledy | ne | publikované čtení | správa | delegace | ne |
| Koncepty, publikace a schvalování | ne | ne | podle modulu | výslovná delegace | ne |
| Dokument owners | ne | čtení publikované verze | správa | podle grantu | ne |
| Dokument board | ne | ne | správa | jmenný grant | ne |
| Dokument restricted | ne | jen jmenný grant | jen jmenný grant | jen jmenný grant | ne |
| Registr a společný plán | ne | čtení publikovaného pohledu | správa | delegovaná doména | ne |
| Potvrzení odborného hodnocení | ne | ne | pouze s pověřením/odbornou odpovědností | explicitní approve grant | ne |
| Vlastní soukromý požadavek | ne | vytvořit, číst, komentovat | řešit | přidělený řešitel | ne |
| Cizí soukromý požadavek | ne | ne | řešit | jen přidělený | ne |
| Přímá soukromá konverzace | ne | účastník | pouze účastník | pouze účastník | ne |
| Společné finanční přehledy | ne | publikované čtení | správa | finanční delegace | ne |
| Členství a role | ne | jen vlastní omezený profil | řízená správa | ne | technická správa podle zvláštního rozsahu |
| Audit | ne | vlastní uživatelská historie v omezeném pohledu | obsahový audit podle rozsahu | jen rozsah | technický audit bez soukromých textů |

Odborné pověření je procesní rozhodnutí SVJ, software neověřuje kvalifikaci jen podle názvu role. Při kombinaci rolí se práva skládají, ale dokument restricted a soukromá konverzace stále vyžadují explicitní účast/grant. Skutečný provozovatel databáze může mít technicky privilegovaný přístup; od aplikačních rolí se odděluje, omezuje a audituje.

## RLS, API a změny stavů

Odstranit staré veřejné `USING(true)` a `WITH CHECK(true)`, ne jen přidat další politiky. Omezit grants pro `anon` a `authenticated`; RLS je další vrstva. Novinky pro veřejnost vyžadují současně visibility=public a status=published. Neaktivní formuláře a interní settings nesmí být veřejně čitelné přímým API.

Každá politika řeší SELECT, INSERT, UPDATE a DELETE samostatně. UPDATE musí ověřit dosavadní i výsledný záznam. Změna organization_id, autora, role, approval stavu, auditních údajů a interní priority není běžná samoobslužná editace. Pole omezit granty, triggery nebo doménovým RPC; samotná řádková politika neřeší libovolnou změnu sloupce.

Přímé API testy používají publishable konfiguraci a JWT reálných testovacích rolí; test s privilegovaným klíčem neověřuje RLS běžného uživatele. Vyzkoušet i RPC, views, hledání, exporty a realtime, pokud budou zapnuté. Views nad chráněnými daty musí prokazatelně respektovat volajícího. Pomocné `SECURITY DEFINER` funkce mají omezené EXECUTE, pevný search_path a ručně zkontrolovanou autorizaci.

Serverové endpointy ověřují podpis/platnost tokenu odpovídajícím podporovaným mechanismem i aktivní členství, nespokojí se s klientem dodaným user_id nebo organization_id. CORS je nastavení browseru, nikoliv náhrada autentizace. Privilegovaný serverový klíč se nepoužívá v UI. Viz [oficiální RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) a [auth serverových funkcí](https://supabase.com/docs/guides/functions/auth).

## Soubory a přenos oprávnění

Privátní bucket, RLS nad objekty a ověřená vazba objekt → verze → dokument → živé oprávnění. Neuhodnutelné UUID není autorizace. Povolit pouze potvrzené typy a velikosti, zamezit přepsání cizího object_key, kontrolovat skutečný obsah, karanténu a chyby skenování. Náhled se otevírá bezpečným rendererem, ne neomezeným inline HTML.

Stažení probíhá po autorizaci; pro běžné dokumenty lze navrhnout krátkodobé signed URL (pilotní TTL nejvýše 60 sekund). Již vydané signed URL může platit do expirace a již stažený soubor nelze vzdáleně odebrat. Pro restricted dokumenty preferovat kontrolované streamování přes endpoint s novou kontrolou každého požadavku a bez sdílené cache. Negarantovat okamžité odvolání dříve vydaného odkazu.

Změna ACL se ihned projeví v novém seznamu, hledání, nových odkazech a nových AI dotazech. Znepřístupněné verze se vyřadí z běžného retrieval. Kopie, exporty a přílohy podléhají samostatné retenční správě. Podklady pro [Storage](https://supabase.com/docs/guides/storage/security/access-control).

## Soukromí, audit a uchovávání

Minimalizovat údaje: nezavádět automatický import kontaktů a vlastnictví ze všech nalezených souborů. Účel zpracování, příjemce a retenční doby určí SVJ podle skutečných povinností a smluv. Soukromé zprávy, podklady vlastníků a AI historie nejsou výchozím zdrojem pro společný znalostní index.

Auditovat změny rolí, publikaci, ACL, importy, potvrzení hodnocení, finanční revize a rozhodnutí. Aplikace nesmí audit měnit ani mazat. Do logů neposílat hesla, tokeny, signed URL, kompletní dokumenty ani celá soukromá vlákna. Provozní logy mají omezený přístup a schválenou retenci. Audit není absolutně odolný proti správci databáze; pro pozdější důkazně citlivé procesy je třeba zvláštní ochrana a export mimo jeho běžný zásah.

Výmaz nebo znepřístupnění se musí promítnout do textových extraktů, embeddings, náhledů, cache a exportních úloh. Zálohy mají popsané doběhnutí retence. Právní důvod uchování konkrétního záznamu se rozhoduje samostatně, tento návrh neurčuje univerzální lhůtu.

## Provoz a povinné důkazy G0

- Oddělené testovací prostředí, seznam správců a zálohovaných objektů; obnova DB i souborů do izolovaného prostředí.
- Klasifikace `.env` bez tisku hodnot. Rotace pouze skutečně identifikovaných serverových secrets, revize historie a přístupů.
- Ochrana přihlašování a citlivých endpointů proti zneužití, omezení počtu požadavků, idempotence a serverová validace délky a typu polí.
- MFA pro privilegované účty jako navržená podmínka pilotu; nastavení a obnovu ověřit vůči dostupným možnostem služby.
- Při incidentu omezit dotčený přístup, zastavit publikaci/import/AI podle dopadu, uchovat důkazy bez dalšího šíření a vyhodnotit rozsah s odpovědnou osobou.
- Test, že pozastavený účet se starým tokenem nečte další interní data; test, že jiný vlastník nedostane metadata, soubor, zprávu ani AI úryvek cizího restricted záznamu.

Detailní scénáře a důkazy patří do [testovacího plánu](10_TESTOVANI_A_RELEASE.md). Tato dokumentace neznamená, že testy již proběhly.
