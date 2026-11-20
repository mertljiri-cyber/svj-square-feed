"""Loopback-only UI acceptance using Hermes' installed browser harness.

Run inside browser_exec: runpy.run_path('scripts/verify-local-fixtures.py', run_name='__main__').
Requires a local-fixtures build served at 127.0.0.1:4174. No real login/data.
Results and screenshots are written incrementally outside the repo in ../evidence.
The simulated adapter is NOT a substitute for the PostgreSQL/RLS integration tests.
"""
import json
from pathlib import Path
import shutil
import time
from browser_harness.helpers import new_tab, wait_for_load, js, cdp, capture_screenshot

EVIDENCE = Path(__file__).resolve().parents[2] / 'evidence'
EVIDENCE.mkdir(exist_ok=True)
RESULTS = []


def record(name, passed):
    RESULTS.append({'test': name, 'passed': bool(passed), 'surface': 'actual application UI with synthetic in-memory adapter'})
    (EVIDENCE / 'actual-ui-results.json').write_text(json.dumps(RESULTS, ensure_ascii=False, indent=2))
    assert passed, name


def screenshot(name):
    target = EVIDENCE / name
    shutil.copy(capture_screenshot(), target)
    print(str(target))


def nav(path):
    js('(()=>{history.pushState({},"",' + json.dumps(path) + ');dispatchEvent(new PopStateEvent("popstate"))})()')
    time.sleep(.25)
    js('scrollTo(0,0)')


def click(text, selector='button'):
    js('(()=>{const e=[...document.querySelectorAll(' + json.dumps(selector) + ')].find(e=>e.textContent===' + json.dumps(text) + ');if(!e)throw Error("Control missing");e.click()})()')
    time.sleep(.15)


def select(index, value):
    js('(()=>{const e=document.querySelectorAll("aside select")[' + str(index) + '];e.value=' + json.dumps(value) + ';e.dispatchEvent(new Event("change",{bubbles:true}))})()')
    time.sleep(.2)


def submit():
    js('document.querySelector("form button").click()')


def main():
    new_tab('http://127.0.0.1:4174/')
    wait_for_load()
    time.sleep(.8)
    record('06 explicitly labelled synthetic surface', js('document.body.innerText.includes("simulovaný backend/identity/AI")'))
    for width, height, label in [(1600, 1100, 'desktop'), (390, 844, 'mobile')]:
        nav('/')
        cdp('Emulation.setDeviceMetricsOverride', width=width, height=height, deviceScaleFactor=1, mobile=label == 'mobile')
        time.sleep(.2)
        record('01 ' + label + ' both CTA visible', js('(()=>{const a=[...document.querySelectorAll("a")].filter(e=>["Zeptat se na dům","Prohlédnout technický přehled"].includes(e.textContent));return a.length===2&&a.every(e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<innerHeight})})()'))
        record('01 ' + label + ' no horizontal overflow', js('document.documentElement.scrollWidth<=innerWidth'))
        screenshot('01-final-home-' + label + '.png')
        click('Zeptat se na dům', 'a')
        record('01 ' + label + ' chat CTA navigation', js('location.pathname==="/zeptat-se" && !!document.querySelector("textarea")'))
        nav('/')
        click('Prohlédnout technický přehled', 'a')
        record('01 ' + label + ' registry CTA navigation', js('location.pathname==="/technicky-prehled" && document.body.innerText.includes("SYN-001")'))
    nav('/')
    js('document.querySelector("button[aria-label=Navigace]").click()')
    time.sleep(.15)
    record('01 mobile navigation expands', js('document.querySelector("button[aria-label=Navigace]").getAttribute("aria-expanded")==="true"'))
    click('Zeptat se', '#mobile-navigation a')
    record('01 mobile navigation closes on click', js('location.pathname==="/zeptat-se" && document.querySelector("button[aria-label=Navigace]").getAttribute("aria-expanded")==="false"'))
    questions = ['Co se schválilo ohledně zvonků?', 'Jaký je plán oprav?', 'Jaká pravidla platí pro společné prostory?']
    for question in questions:
        click(question)
        record('02 prefill without submit: ' + question, js('document.querySelector("textarea").value') == question and js('!document.querySelector("[aria-label=Odpověď]")'))
    click(questions[0])
    submit()
    time.sleep(.12)
    record('03 loading state', js('document.body.innerText.includes("Hledám v podkladech…")'))
    time.sleep(.8)
    record('06 resident answer visible', js('!!document.querySelector("[aria-label=Odpověď]")'))
    js('[...document.querySelectorAll("button")].find(e=>e.textContent.startsWith("Citace 1:")).click()')
    time.sleep(.15)
    record('04 exact authorized excerpt', js('document.querySelector("blockquote")?.textContent==="V modelovém domě byla schválena výměna zvonků. Termín realizace zatím není stanoven."'))
    js('document.querySelector("blockquote").scrollIntoView({block:"center"})')
    screenshot('04-final-citation-mobile.png')
    record('07 resident source management hidden', js('!document.body.innerText.includes("Správa zdrojů wiki")'))
    for scenario, text in [('unknown', 'V dostupných podkladech to není doložené.'), ('limit', 'Dosáhli jste limitu dotazů.'), ('error', 'Asistent je momentálně nedostupný.')]:
        select(1, scenario)
        submit()
        time.sleep(.85)
        record('03 state ' + scenario, text in str(js('document.body.innerText')))
        record('03 query retained ' + scenario, js('document.querySelector("textarea").value') == questions[0])
        if scenario != 'unknown':
            record('03 retry action ' + scenario, js('document.querySelector("form button").textContent==="Zkusit znovu"'))
    screenshot('03-final-error-mobile.png')
    select(1, 'answer')
    submit()
    time.sleep(.85)
    record('03 retry same question recovers', js('!!document.querySelector("[aria-label=Odpověď]")') and js('document.querySelector("textarea").value') == questions[0])
    cdp('Emulation.setDeviceMetricsOverride', width=1600, height=1100, deviceScaleFactor=1, mobile=False)
    select(0, 'board')
    js('document.querySelector("summary").click()')
    time.sleep(.2)
    record('07 board active note version and time', js('(()=>{const s=document.querySelector("[aria-label=\\"Aktivní zdroje\\"]");return !!s&&s.innerText.includes("opravy · aktivní")&&s.innerText.includes("a".repeat(64))&&!!s.querySelector("time")})()'))
    js('scrollTo(0,0)')
    screenshot('07-final-source-inventory-desktop.png')
    click(questions[0])
    submit()
    time.sleep(.85)
    js('[...document.querySelectorAll("button")].find(e=>e.textContent.startsWith("Citace 1:")).click()')
    time.sleep(.15)
    record('06 board answer citation flow', js('!!document.querySelector("blockquote")'))
    screenshot('06-final-board-citation-desktop.png')
    click('Zavřít úryvek')
    click('Stáhnout syntetickou citaci')
    js('[...document.querySelectorAll("button")].find(e=>e.textContent.startsWith("Citace 1:")).click()')
    time.sleep(.15)
    record('10 withdrawn citation unavailable on reopen', js('!document.querySelector("blockquote") && document.body.innerText.includes("Citace již není dostupná")'))
    record('07 inventory refreshes withdrawal', js('document.querySelector("[aria-label=\\"Aktivní zdroje\\"]").innerText.includes("opravy · stažená")'))
    screenshot('10-final-withdrawn-desktop.png')
    select(0, 'owner')
    record('07 role change hides metadata', js('!document.body.innerText.includes("Správa zdrojů wiki")'))
    nav('/technicky-prehled/SYN-001')
    click('Nahlásit závadu k prvku', 'a')
    record('08 existing form asset prefill without description', js('location.pathname==="/pozadavky" && document.querySelector("input[list=svj-assets]").value==="SYN-001" && document.querySelector("textarea").value===""'))
    record('08 no automatic submission', js('document.body.innerText.includes("zatím nebylo nic odesláno") && document.body.innerText.includes("Zatím jste nepodali")'))
    screenshot('08-final-prefill-desktop.png')
    js('(()=>{const e=document.querySelector("textarea");Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,"value").set.call(e,"Syntetický popis závady zvonků pro lokální UAT.");e.dispatchEvent(new Event("input",{bubbles:true}))})()')
    time.sleep(.1)
    submit()
    time.sleep(.3)
    record('09 acknowledged request appears with status and timestamp', js('document.body.innerText.includes("Požadavek č. 1 byl přijat") && document.body.innerText.includes("Poslední změna") && document.body.innerText.includes("Nový")'))
    js('[...document.querySelectorAll("a")].find(e=>e.textContent.startsWith("Otevřít přijatý požadavek")).click()')
    time.sleep(.25)
    request_path = js('location.pathname')
    record('09 detail includes description asset status and timestamps', js('document.body.innerText.includes("Syntetický popis závady") && document.body.innerText.includes("SYN-001") && document.querySelectorAll("time").length>=2'))
    screenshot('09-final-request-desktop.png')
    select(0, 'other')
    record('09 other ordinary resident cannot view detail (mock)', js('document.body.innerText.includes("Požadavek nenalezen") && !document.body.innerText.includes("Syntetický popis závady")'))
    nav('/pozadavky')
    record('09 other resident list empty (mock)', js('document.body.innerText.includes("Zatím jste nepodali")'))
    select(0, 'owner')
    record('09 author rediscovers request', js('document.body.innerText.includes("Závada: Syntetické zvonky") && document.body.innerText.includes("Poslední změna")'))
    nav(request_path)
    cdp('Emulation.setDeviceMetricsOverride', width=390, height=844, deviceScaleFactor=1, mobile=True)
    time.sleep(.2)
    record('09 mobile request no horizontal overflow', js('document.documentElement.scrollWidth<=innerWidth'))
    js('window.scrollTo(0,Math.max(0,document.querySelector("h1").getBoundingClientRect().top+scrollY-85))')
    screenshot('09-final-request-mobile.png')
    resources = js('performance.getEntriesByType("resource").map(x=>x.name)')
    assert isinstance(resources, list), 'Resource list unavailable'
    record('06 all observed resources are loopback', all(url.startswith('http://127.0.0.1:4174/') for url in resources))
    (EVIDENCE / 'observed-resources.json').write_text(json.dumps(resources, indent=2))
    print(json.dumps({'tests': len(RESULTS), 'passed': sum(r['passed'] for r in RESULTS), 'results': str(EVIDENCE / 'actual-ui-results.json')}))


if __name__ == '__main__':
    main()
