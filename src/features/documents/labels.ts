export const categoryLabels: Record<string, string> = {
  stanovy: "Stanovy a pravidla", zapisy: "Zápisy", smlouvy: "Smlouvy", technicka: "Technická dokumentace",
  revize: "Revize", opravy: "Opravy", finance: "Finance", ostatni: "Ostatní",
};
export const visibilityLabels: Record<string, string> = { owners: "Vlastníci a výbor", board: "Pouze výbor", restricted: "Jmenovitě vybraní" };
export const lifecycleLabels: Record<string, string> = { draft: "Koncept", published: "Publikováno", archived: "Archivováno", withdrawn: "Staženo" };
export const uploadStatusLabels: Record<string, string> = { pending: "Nahrává se", ready: "Hotovo", failed: "Selhalo" };
export const ACCEPT = ".pdf,.docx,.xlsx,.png,.jpg,.jpeg";
export const MAX_BYTES = 25 * 1024 * 1024;

export const formatBytes = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} kB`);

export async function sha256Hex(file: File): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
