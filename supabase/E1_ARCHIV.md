# Archiv dokumentů (E1): stav implementace

Migrace `20261107140000_e1_documents.sql`, testy `supabase/tests/documents.test.ts` (a archivní část `restore.test.ts`). Stav: **implementováno lokálně, nenasazeno**.

## Hotovo

| Karta | Co je v kódu |
|---|---|
| DOC-01 upload a metadata | `create_document`, `begin_upload`, `complete_upload`. Whitelist PDF, DOCX, XLSX, PNG, JPG do 25 MB; přípona musí sedět s MIME. Neuhodnutelný klíč `org/dokument/verze` bez názvu souboru. Nahrát lze jen pod klíč, který založilo `begin_upload` tomuto uživateli (max. 1 hodina, bez přepsání) |
| DOC-02 verze a publikace | Verze jsou neměnné (trigger), stav jen `pending → ready/failed`. Souběžná nahrávání dostanou různá čísla (zámek dokumentu). `publish_version` mění aktuální verzi, stará zůstává čitelná. Změny publika a stavu jdou do auditu |
| DOC-03 seznam a filtry | Filtr kategorie, hledání v názvu, stránkování po 25. Seznam vrací jen dokumenty, které smí uživatel číst (RLS). Chyba načtení se nezobrazí jako prázdný archiv |
| DOC-04 stažení a odvolání | `authorize_download` znovu ověří právo při každém stažení a zapíše audit; poté klient vydá odkaz na 60 s. Odebrání grantu, stažení z publikace nebo pozastavení člena zablokuje nové stažení hned |

Publikum: `owners` (aktivní členové), `board` (výbor), `restricted` (jen jmenné granty; ani výbor bez grantu). Koncept a stažený dokument vidí jen správci. Nelze odebrat posledního správce omezeného dokumentu. Objekty ve Storage jsou neměnné (bez UPDATE/DELETE politik).

Stránky: `/dokumenty`, `/dokumenty/:id`.

## Omezení a odchylky od návrhu

- **Obsah souboru se neověřuje.** Kontrolní součet SHA-256 dodává prohlížeč a server ho neověřuje; typ a velikost se porovnávají s metadaty uloženými ve Storage. Neprovádí se antivirový sken ani kontrola skutečného formátu (magic bytes). Vyžaduje serverovou funkci.
- **Restricted dokumenty se stahují přes podepsaný odkaz (60 s)**, ne přes endpoint, který kontroluje každý požadavek. Návrh to preferuje; odkaz vydaný před odebráním přístupu platí do expirace.
- **Osiřelé objekty** po selhaném nahrávání zůstávají ve Storage (verze je označena `failed`). Úklid není automatický.
- **Vazby** na požadavky a technické prvky (DOC-03) nejsou; čekají na registr (E2). Přílohy požadavků zatím nejsou napojeny.
- **Export seznamu** není implementován. Hledání je jen v metadatech, ne v textu.
- **Náhled** v prohlížeči není; soubory se stahují.

## Neověřeno

Politiky na `storage.objects` jsem testoval jen nad napodobeninou tabulky, ne nad skutečným Supabase Storage. Neověřeno zůstává zejména, zda `createSignedUrl` pro běžného uživatele respektuje politiku SELECT tak, jak předpokládám, a zda migrační nástroj Lovable dovolí vytvořit politiky na schématu `storage`. Před použitím s reálnými dokumenty je nutné projít celý tok (nahrání, publikace, stažení, odebrání přístupu) v testovacím projektu.
