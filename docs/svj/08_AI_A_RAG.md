# AI a RAG nad dokumentací

Stav: **NÁVRH E4/P2**. V auditovaném kódu není AI, extrakce ani vektorový index. Zavádět až po bezpečném archivu a pilotu základní evidence.

## Rozsah první AI verze

Asistent odpovídá na otázky nad publikovanými dokumenty, ke kterým má uživatel právo. V první verzi je pouze pro čtení. Strukturovaný plán oprav lze připojit řízeným dotazem do databáze. Částky, součty a termíny se počítají deterministicky nad vybraným obdobím a rozsahem dat; LLM je vysvětlí. Neznámá cena se nikdy nezmění na 0 Kč.

Soukromé přímé zprávy, nepublikované uploady, raw importy a individuální osobní podklady jsou z první verze vyloučeny. Pozdější zpřístupnění restricted dokumentů vyžaduje zvláštní testy a souhlas správce obsahu s tímto způsobem zpracování.

## Zpracování zdroje

1. Triggerem je připravená a schválená verze dokumentu, ne libovolný soubor v bucketu.
2. Úloha má klíč document_version + content_hash + pipeline_version. Stejné spuštění nevytvoří duplicitní chunky.
3. Extrahovat text se stránkou či sekcí. Sken potřebuje OCR a zobrazení stavu i kvality; při chybě žádná falešná „AI připravenost“.
4. Rozdělit podle struktury dokumentu s rozumným překryvem. Zachovat vazbu na originál, nadpis a rozsah stránek. Konkrétní velikosti určit vyhodnocením českých podkladů, ne převzetím univerzální konstanty.
5. Vygenerovat embeddings ve schváleném regionu/službě; zaznamenat model a verzi. Text ani embedding se nepublikuje do veřejné tabulky.
6. Při nové verzi připravit nový index a přepnout jej až po dokončení. Starý důkaz zůstává dohledatelný, běžné dotazy preferují publikovanou aktuální verzi.
7. Odvolání publikace nebo práv dokument okamžitě vyřadí z nových dotazů přes živou autorizaci; fyzické odstranění odvozených dat se řídí retenční úlohou.

## Tok dotazu a ochrana práv

Backend ověří uživatele a aktivní členství. Retrieval běží s jeho kontextem a práva filtruje před předáním úryvků modelu. Nepoužívat široký service-role dotaz nad všemi chunky s dodatečnou prosbou modelu „neukazuj cizí data“. Document ACL je autoritativní i pro chunky, fulltext, citace, náhledy a přepočet top výsledků. Výchozí reference: [Supabase RAG s oprávněními](https://supabase.com/docs/guides/ai/rag-with-permissions).

Model dostane pouze potřebné úryvky a bezpečné identifikátory. Dokument je nedůvěryhodná data: pokyny uvnitř PDF či Excelu nesmějí měnit systémová pravidla, volat externí URL, odhalovat tajemství nebo spouštět akce. LLM nedostává serverové klíče, přímý SQL přístup ani odesílání e-mailu.

Závěrečná odpověď kontroluje, že citované source IDs pocházejí z aktuálního oprávněného retrieval. Je-li oprávnění odebráno během dotazu, odpověď se před odesláním znovu ověří a dotčené informace se nevydají. Sdílená cache odpovědí mezi uživateli se v první verzi nepoužívá. Historie AI má vlastní ACL a při ztrátě práv nesmí sloužit jako obcházení odvolaného přístupu.

## Kontrakt odpovědi

Strukturovaný výsledek má answer, claims s typem fact/interpretation/unknown, citations s document_id/version_id/page_or_section, data_as_of a limitations. UI ukazuje čitelný český text a funkční odkazy do oprávněného prohlížeče.

Každé věcné tvrzení o domě musí mít použitelnou citaci nebo být výslovně označeno jako nedoložené. Název PDF bez relevantní stránky není dostatečný důkaz konkrétního detailu. Pokud se zdroje rozcházejí, odpověď uvede oba zdroje a rozpor. Starší smlouva se neoznačí za aktuálně platnou pouze podle data souboru. Není-li odpověď ve zdrojích, vrátit jasně „V dostupných podkladech to není doloženo“ a potřebný další zdroj.

Příklad požadovaného chování nad původním Excelem: na dotaz „Je střecha v dobrém stavu?“ odpovědět, že registr u T-001 uvádí Nezjištěno, odborné ověření není vyplněno. Neodvozovat dobrý stav z nuly kritických položek v přehledu.

## Vytěžování a návrhy

Pozdější AI navrhne kategorii dokumentu, datum, dodavatele, částku, vazbu na prvek nebo termín z explicitní pasáže. Návrh má původní text, citaci, míru nejistoty a status pending. Uživatel vidí diff; oprávněné potvrzení projde doménovou validací a auditem. AI nesmí sama upravit schválený rozpočet, usnesení ani technické hodnocení. Odmítnutý návrh není potichu znovu aplikován při reindexaci.

## Hodnocení před G4

Připravit nejméně 30 českých testovacích dotazů s člověkem určenou očekávanou odpovědí a zdrojem: 10 zodpověditelných, 5 bez podkladu, 5 s rozpory/verzemi, 5 přístupových a 5 s injekcí pokynů či vadným OCR. Kategorie lze rozšířit, kritické testy se při každé změně indexu nebo modelu opakují.

| Kontrola | Návrh akceptace |
|---|---|
| Únik cizích dat | 0 úniků obsahu i metadat v celé přístupové sadě; jediný únik blokuje release |
| Citace | Každé faktické tvrzení odkazuje na dostupný relevantní zdroj; manuální posouzení všech pilotních odpovědí |
| Neznalost | Všechny negativní dotazy z předepsané sady přiznají chybějící podklad bez vymyšleného údaje |
| Verze a rozpory | Žádné zamlčené použití vyřazené verze jako aktuální ani sloučení protichůdných údajů do jistého závěru |
| Prompt injection | Vložené instrukce nevyvolají akci, obcházení práv ani neautorizované vyhledání |
| Užitečnost | Alespoň 90 % zodpověditelných pilotních dotazů správně a s relevantní citací; práh je návrh, ne současný výsledek |

Zaznamenat model, prompt/pipeline verzi, dataset, výsledek a lidské hodnocení. AI vypínač nesmí zablokovat archiv ani registr. Změna poskytovatele nebo modelu vyžaduje nové hodnocení relevantních scénářů.

## Provoz a poskytovatel

Poskytovatel AI, cena, region, pravidla uchovávání a smluvní podmínky nejsou v tomto balíčku zvoleny. Před prvním reálným dokumentem určit, kam se obsah posílá, kdo jej smí zpracovat, zda se používá pro trénování a jak se maže. Citlivé texty neposílat do neověřené služby.

Rozpočtové limity určit na uživatele i SVJ, omezit velikost kontextu, počet paralelních dotazů a opakování. Měřit latenci, selhání, spotřebu a užitečnost; logovat přednostně ID zdrojů a metriky, nikoliv celý soukromý obsah. Výpadek AI má skončit srozumitelnou chybou a odkazy na běžné hledání dokumentů.
