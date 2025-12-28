import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("cs-CZ", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString("cs-CZ", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getStatusLabel(status: string | null | undefined): string {
  const labels: Record<string, string> = {
    navrh: "Návrh",
    "projednava-se": "Projednává se",
    schvaleno: "Schváleno",
    realizace: "V realizaci",
    hotovo: "Hotovo",
  };
  return labels[status || "navrh"] || "Návrh";
}

export function getPriorityLabel(priority: string | null | undefined): string {
  const labels: Record<string, string> = {
    low: "Nízká",
    medium: "Střední",
    high: "Vysoká",
  };
  return labels[priority || "medium"] || "Střední";
}
