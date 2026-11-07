export const typeLabels: Record<string, string> = { defect: "Závada", question: "Dotaz", proposal: "Návrh" };
export const statusLabels: Record<string, string> = {
  new: "Nový", triaged: "Zařazený", in_progress: "V řešení", waiting: "Čeká se",
  resolved: "Vyřešený", closed: "Uzavřený", rejected: "Zamítnutý", duplicate: "Duplicitní",
};
export const priorityLabels: Record<string, string> = { low: "Nízká", normal: "Běžná", high: "Vysoká", urgent: "Naléhavá" };

// Zrcadlí pravidla na serveru jen pro nabídku v UI; rozhoduje vždy databáze.
export const transitions: Record<string, string[]> = {
  new: ["triaged", "rejected", "duplicate"],
  triaged: ["in_progress", "waiting", "rejected", "duplicate"],
  in_progress: ["waiting", "resolved"],
  waiting: ["in_progress"],
  resolved: ["closed", "in_progress"],
  closed: ["in_progress"],
  rejected: ["new"],
  duplicate: ["new"],
};
export const handlerOnlyTargets = ["in_progress", "waiting", "resolved"];

export const eventLabels: Record<string, string> = {
  created: "Požadavek založen", status_changed: "Změna stavu", comment: "Komentář", reopen_requested: "Žádost o znovuotevření",
};

export const fmt = (iso: string) => new Date(iso).toLocaleString("cs-CZ", { dateStyle: "short", timeStyle: "short" });
