import { Link } from "react-router-dom";
import { Users, ClipboardList, FolderOpen, Lightbulb, ScrollText, Newspaper } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { RequireMember } from "@/features/auth/RequireMember";
import { useAuth } from "@/features/auth/AuthProvider";

const sections = [
  { to: "/clenove", icon: Users, title: "Členové a role", text: "Pozvánky, schvalování členství, pozastavení a role." },
  { to: "/pozadavky/fronta", icon: ClipboardList, title: "Fronta požadavků", text: "Všechny požadavky SVJ, přidělení řešitele a vyřízení." },
  { to: "/dokumenty", icon: FolderOpen, title: "Dokumenty", text: "Nahrávání verzí, publikace a jmenovitý přístup." },
  { to: "/zamery", icon: Lightbulb, title: "Záměry", text: "Úpravy, změna stavu a odkazy na rozhodnutí." },
  { to: "/sprava/novinky", icon: Newspaper, title: "Novinky a úvodní text", text: "Psaní, publikace a viditelnost novinek, úvodní text portálu." },
  { to: "/sprava/audit", icon: ScrollText, title: "Záznam změn", text: "Kdo, kdy a co změnil: členství, role, publikace, stahování." },
];

function AdminInner() {
  const { activeMembership } = useAuth();
  return (
    <Layout>
      <div className="page-container py-8">
        <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-primary">Výbor</p>
        <h1 className="text-3xl font-bold md:text-4xl">Správa</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">{activeMembership?.organization_name}. Tato sekce je viditelná pouze výboru.</p>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {sections.map(({ to, icon: Icon, title, text }) => (
            <Link key={to} to={to} className="flex gap-4 rounded-xl border bg-card p-5 transition-shadow hover:shadow-md">
              <div className="h-fit rounded-lg bg-primary/10 p-2 text-primary"><Icon className="h-5 w-5" /></div>
              <div><h2 className="font-semibold">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{text}</p></div>
            </Link>
          ))}
        </div>
      </div>
    </Layout>
  );
}

export default function Admin() {
  return <RequireMember boardOnly><AdminInner /></RequireMember>;
}
