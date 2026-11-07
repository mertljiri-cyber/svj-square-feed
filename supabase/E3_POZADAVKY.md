# Modul požadavků (E3): stav implementace

Migrace `20261107130000_e3_requests.sql`, testy `supabase/tests/requests.test.ts`. Stav: **implementováno lokálně, nenasazeno**.

## Hotovo

| Karta | Co je v kódu |
|---|---|
| REQ-01 přijetí | `create_request`: unikátní číslo v rámci SVJ, soukromý požadavek, idempotence přes klíč, validace délek a typu, limit 10/hod |
| REQ-02 fronta a přechody | `change_request_status`: stavový automat na serveru, kontrola `row_version`, povinné vysvětlení u zamítnutí, duplicity a zařazení bez řešitele, povinný výsledek u vyřešení. Stav a událost se ukládají v jedné transakci |
| REQ-02 autor | `request_reopen` (žádost o znovuotevření s důvodem), `add_request_comment` (komentáře; interní poznámky jen výbor a řešitel) |
| REQ-04 outbox | tabulka `notification_outbox`, naplňuje se ve stejné transakci jako událost. Neobsahuje text požadavku. Idempotentní klíč brání duplicitám |

Práva: požadavek vidí autor (aktivní člen), výbor a přidělený řešitel; jiný vlastník ani jiné SVJ nevidí ani jeho existenci. Zápis do tabulek přímo z API není povolen.

Stránky: `/pozadavky` (moje požadavky a podání), `/pozadavky/:id` (detail, historie, komentáře, vyřízení), `/pozadavky/fronta` (jen výbor).

## Nehotovo

- **Doručování e-mailů.** Nic nevybírá frontu `notification_outbox`; záznamy zůstávají ve stavu `queued`. Vyžaduje poskytovatele e-mailu a rozhodnutí o doručovacím kanálu (O09). Do té doby uživatel o změně stavu zjistí jen v portálu.
- **Přílohy** (REQ-01) čekají na archiv dokumentů (E1).
- **Vazba na technický prvek** je zatím jen textové označení (`T-013`), bez kontroly existence. Skutečná vazba čeká na registr v databázi (E2).
- **Kontakty a přímé soukromé konverzace** (REQ-03) nejsou implementovány.
- **Převod historických podání** (REQ-05) nejsou implementovány. Podání ve `form_submissions` zůstávají beze změny.
- **Havarijní kontakt.** Formulář zatím neukazuje ověřený kontakt pro urgentní situace (nemáme ověřený údaj, O09).
- Prototyp `RequestsDemo.tsx` (localStorage) už není v routách. Soubor je zachován a lze ho smazat.

## Neověřeno

Skutečný Supabase, PostgREST a prohlížeč. Stránky se pouze přeložily (typy, lint, build); nebyly spuštěny proti živé databázi.
