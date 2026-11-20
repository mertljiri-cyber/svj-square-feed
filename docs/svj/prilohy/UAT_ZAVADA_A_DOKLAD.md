# UAT: závada → řešitel → doklad

Stav: testovací scénář, ne potvrzení nasazení. Pro první průchod nepoužívat skutečné účty vlastníků ani soubory domu.

## Předání testerovi

- Připravit odkaz do ověřeného náhledu připojeného výhradně k testovacímu backendu. Zapsat Git commit náhledu a ověřit obě migrace pilotu (`request_evidence`, `wiki_sources`) na tomto backendu.
- Připravit testovací role: vlastník (autor), výbor, přidělený řešitel a druhý vlastník stejného SVJ. Pro technické ověření ještě účet z jiného SVJ. Přihlašovací údaje nesdílet v Gitu.
- Připravit u prvku T-013 testovací závadu nebo ji nechat založit testerem. V archivu připravit syntetický protokol se dvěma verzemi a jeden doklad pouze pro výbor.

## Ruční průchod

1. **Vlastník:** nahlásí „Kolísá teplota vody“, vybere T-013 a uvidí číslo požadavku. Odkaz v detailu otevře odpovídající technický prvek.
2. **Výbor:** otevře frontu a přiřadí řešitele. Řešitel v požadavku vidí stav a může připojit přesně verzi 1 protokolu, pokud má k dokumentu přístup.
3. **Vlastník:** po připojení vidí a stáhne verzi 1, pokud je dokument publikovaný pro vlastníky. Nepřístupný doklad se v seznamu neobjeví ani názvem. Druhý vlastník nesmí vidět samotný cizí požadavek. Samotná viditelnost sdíleného dokumentu v jeho běžném archivu tím není omezena.
4. **Výbor:** přepne aktuální verzi protokolu na 2. Existující doklad v požadavku stále odkazuje na verzi 1. Po stažení dokumentu z publikace vlastník nezíská nový odkaz; dříve staženou kopii nelze odvolat.

## Technické ověření před UAT

- Ověřit autentizaci a profil každé role, skutečné stažení ze Storage a zamítnutí nového odkazu po odvolání přístupu. Lokální SQL testy tyto kroky neprokazují.
- Ověřit v náhledu, že prohlížeč nevolá živý backend a že vlastník mimo požadavek nevidí vazbu. Když migrace nebo oprávnění chybí, nepředávat náhled jako připravené UAT.
- AI není součástí této akceptace. Samostatný budoucí scénář: „Co se schválilo ohledně zvonků?“ s citací ověřeného zdroje a odlišením návrhu, schválení a realizace.
