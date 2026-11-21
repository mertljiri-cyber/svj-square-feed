# Runbook: privátní souborová Markdown wiki (vydání pro chat)

Platí pro jedno SVJ. Jen syntetická data nebo výslovně schválené poznámky; nic z vaultu, stagingu ani výstupů nepatří do Gitu.

## Jak to funguje
- **Vydání** = neměnný prefix `ORG/releases/RELEASE/` v privátním bucketu `svj-wiki-releases`: `manifest.json` + poznámky v původních bajtech pod `notes/<hex segmentů>.md` + (formát v2) odvozený index `index/NN.json`. Relativní cesty zůstávají v manifestu, takže `[[wikilinky]]` a relativní `[odkazy](x.md)` fungují stejně jako ve vaultu. Odkaz mimo vydání (jiný soubor, URL, `../` nad kořen) se nikdy nenačte.
- **Formáty**:
  - **v2** (importér jej vytváří vždy): ≤ 256 poznámek, ≤ 8 MiB celkem. Index = slova poznámek (malá písmena, bez diakritiky, ≥ 3 znaky) → pozice v manifestu, rozdělená do 1–64 shardů podle prvních 3 znaků. SHA-256 a velikost každého shardu jsou v manifestu, jehož otisk drží DB → index je vázán na vydání. Na otázku se čte: manifest + ≤ 8 shardů (1 na hledaný tvar) + ≤ 6 kandidátních poznámek + ≤ 4 cíle odkazů, tj. ≤ 19 objektů po ≤ 64 KiB nezávisle na počtu poznámek; ověření citací po generování: manifest + ≤ 5 poznámek.
  - **v1** (pilot): ≤ 64 poznámek, ≤ 2 MiB, bez indexu, na otázku se čtou všechny poznámky. Stávající v1 vydání fungují dál beze změny; nová vydání je nemusí převádět, stačí re-import.
  - Index je jen nápověda, **nikdy důkaz**: úryvky, skóre, odpověď i otevření citace vznikají výhradně z ověřených originálů (SHA-256 z manifestu); otevření citace index vůbec nečte. Nesouhlas indexu (otisk, velikost, číslo shardu, pozice mimo manifest, neplatný počet shardů) → 503, nikdy plné prohledání ani zastaralý obsah.
- **Autorita** je databáze: `app.house_file_release_state` drží jedno aktivní vydání na SVJ. `get_house_file_release` vrací metadata jen aktivnímu členovi (jinak PT403).
- **ask-house** (`supabase/functions/ask-house/handler.ts`): ověří token → kvóta (`consume_house_question` / `consume_house_citation`) → stav vydání pod tokenem uživatele. Teprve pak čte objekty servisním klíčem, ověřuje SHA-256 manifestu i poznámek a před odpovědí i po generování znovu kontroluje, že vydání je stále aktivní.
  - stav `NULL` (nikdy nenastaveno) → dosavadní DB úložiště `read_house_markdown`;
  - náhrobek (`id = null`) → nic; staré i legacy citace jsou zneplatněné;
  - jakákoli chyba (stav, úložiště, integrita) → 503, nikdy zastaralý obsah.
- **Otevření citace**: `POST {organization_id, citation_id}` → `200 {source: Source | null}`; cizí SVJ / neaktivní člen → 403 (frontend zobrazí „není dostupná“). Frontend (`src/features/citationContract.ts`) úryvek zobrazí jen při shodě `id, revision, note_key, section, title, path`.

## Import (lokálně, bez sítě)
1. Allowlist: JSON pole přesných relativních cest, např. `["Rada/Zápis A.md", "Finance/Rozpočet.md"]`. Žádné globy ani adresáře. Před zařazením poznámku celou zkontrolovat (osobní údaje, korespondence) dle `13_WIKI_CHAT_A_MIGRACE.md`.
2. Dry-run (nic nezapisuje, vypíše jen počty a otisk):
   `python3 -I scripts/wiki-release-import.py --root <KOŘEN_POZNÁMEK> --allowlist <approved.json> --organization <ORG_UUID>`
   Výstup obsahuje i `index_shards` (počet shardů).
3. Odmítnutí (exit 2) uvádí jen kód důvodu a index položky (`invalid_path`, `duplicate_path`, `export_false`, `local_only`, `unsafe_or_unreadable_path` pro symlink/hardlink, `file_size`, `too_many_files` > 256, `batch_too_large` > 8 MiB, `manifest_too_large`, `index_too_large`, …). Opravit allowlist, ne skript.
   - `manifest_too_large`: manifest musí mít ≤ 64 KiB (limit bucketu); při 256 poznámkách to dává průměrně ~150 B UTF-8 na cestu (české znaky = 2 B). Zkrátit cesty nebo rozdělit dávku.
   - `index_too_large`: ani 64 shardů po 64 KiB nestačí (extrémně mnoho různých slov se stejnými prvními 3 znaky). Zmenšit dávku.
4. Staging do NOVÉHO adresáře mimo kořen poznámek (nikdy v worktree):
   `python3 -I scripts/wiki-release-import.py … --write <OUT>` → vypíše `release_id`, `manifest_sha256`, `activate_sql`. `manifest_sha256` musí odpovídat dry-runu. Při chybě `<OUT>` smazat a opakovat.

## Nahrání a aktivace (jen lokální / testovací Supabase)
5. Nahrát obsah `<OUT>/<ORG>/releases/<RELEASE>/` se zachovanými relativními klíči do bucketu `svj-wiki-releases` (bez upsertu; `manifest.json` a `index/*.json` jako `application/json`, poznámky jako `text/markdown`). Chybějící shard = 503 na otázky, které ho potřebují; nahrát vždy celý adresář. Např. `supabase storage cp -r <OUT>/<ORG> ss:///svj-wiki-releases/<ORG> --experimental --local` — syntaxi ověřit dle verze CLI.
6. Teprve po úplném nahrání aktivovat jako `service_role`/operátor: `activate_sql` z bodu 4. Pozor: první záznam stavu pro SVJ trvale vypne legacy `read_house_markdown` pro toto SVJ.
7. Ověřit v prohlížeči (syntetika): člen dostane odpověď s citacemi `Soubor: …`, otevření citace ukáže úryvek; člen jiného SVJ a pozastavený člen nedostanou nic.

## Výměna a odvolání
- **Nová verze** = vždy nový `release_id` (bod 4–6). ID nelze znovu aktivovat (PK), takže odvolané citace se nevrátí; starší citace po výměně vrací `source: null`.
- **Okamžité stažení**: `select public.set_house_file_release('<ORG>', null, null);` (náhrobek). Chat i citace okamžitě fail closed. Návrat = re-staging s novým ID.
- Objekty starých vydání lze po stažení z bucketu smazat; databázový stav je rozhodující i bez nich.

## Provozní limity a známá omezení (v2)
- Kandidáti se vybírají podle indexu (shoda hledaných tvarů vážená vzácností), čte se jen 6 nejlepších poznámek; odpověď skládá stávající skórování úryvků. Otázka, jejíž slova jsou ve stovkách poznámek, tak může minout správnou poznámku → odpověď „nevím“, ne nepravdu.
- Shoda je předponová jako dřív (`výtah` najde `výtahu`); slova kratší než 3 znaky a znaky mimo písmena/číslice se neindexují. Index obsahuje i text frontmatteru/kódu a cestu (jen pro výběr kandidátů).
- Sledují se max. 2 odkazy z top 3 poznámek a nejvýše 4 dosud nenačtené cíle odkazů.
- Limit 256 poznámek je pevný (manifest + index musí zůstat ≤ 64 KiB na objekt); větší vault = rozdělit nebo rozšířit formát.

## Testy
`npx vitest run supabase/tests/file-wiki.test.ts supabase/tests/file-wiki-acl.test.ts supabase/tests/ask-house-handler.test.ts src/features/house-chat-contract.test.ts src/features/ask-house.test.ts` a `python3 scripts/test_wiki_release_import.py`.
