import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/features/auth/AuthProvider";
import { Layout } from "@/components/layout/Layout";
import { IntentCard } from "@/components/intents/IntentCard";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

const statusOptions = [
  { value: "all", label: "Všechny stavy" },
  { value: "navrh", label: "Návrh" },
  { value: "projednava-se", label: "Projednává se" },
  { value: "schvaleno", label: "Schváleno" },
  { value: "realizace", label: "V realizaci" },
  { value: "hotovo", label: "Hotovo" },
];

const priorityOptions = [
  { value: "all", label: "Všechny priority" },
  { value: "high", label: "Vysoká" },
  { value: "medium", label: "Střední" },
  { value: "low", label: "Nízká" },
];

export default function Intents() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const { activeMembership } = useAuth();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: "", description: "" });
  const [message, setMessage] = useState("");

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.rpc("submit_intent", {
      p_organization_id: activeMembership!.organization_id, p_title: form.title, p_description: form.description, p_proposer_name: null,
    });
    if (error) { setMessage(error.message); return; }
    setMessage("Záměr byl podán jako návrh.");
    setCreating(false);
    setForm({ title: "", description: "" });
    await qc.invalidateQueries({ queryKey: ["intents"] });
  }

  const { data: intents, isLoading } = useQuery({
    queryKey: ["intents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("intents")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filteredIntents = useMemo(() => {
    if (!intents) return [];
    return intents.filter((item) => {
      const matchesStatus = statusFilter === "all" || item.status === statusFilter;
      const matchesPriority = priorityFilter === "all" || item.priority === priorityFilter;
      return matchesStatus && matchesPriority;
    });
  }, [intents, statusFilter, priorityFilter]);

  return (
    <Layout>
      <div className="page-container">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Záměry</h1>
            <p className="text-muted-foreground">
              Přehled návrhů na opravy, změny a investice v domě
            </p>
          </div>
          <Button onClick={() => { setCreating(true); setMessage(""); }}>Nový záměr</Button>
        </div>

        {message && <p role="status" className="mb-6 rounded-lg border p-3 text-sm">{message}</p>}

        {creating && (
          <form onSubmit={create} className="mb-8 space-y-4 rounded-xl border bg-card p-6">
            <h2 className="text-lg font-semibold">Nový záměr</h2>
            <label className="block text-sm font-medium">Název *<Input className="mt-1" required minLength={3} maxLength={200} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
            <label className="block text-sm font-medium">Popis<Textarea className="mt-1 min-h-32" maxLength={5000} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
            <p className="text-xs text-muted-foreground">Záměr je návrh. Prioritu, odhad nákladů a rok doplní správce a schválit ho může jen výbor.</p>
            <div className="flex gap-3"><Button type="submit">Podat záměr</Button><Button type="button" variant="outline" onClick={() => setCreating(false)}>Zrušit</Button></div>
          </form>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-8">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Stav" />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Priorita" />
            </SelectTrigger>
            <SelectContent>
              {priorityOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Intents Grid */}
        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-40 rounded-xl" />
            ))}
          </div>
        ) : filteredIntents.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredIntents.map((item, index) => (
              <div
                key={item.id}
                className="animate-fade-in"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <IntentCard {...item} />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              {statusFilter !== "all" || priorityFilter !== "all"
                ? "Nebyly nalezeny žádné záměry odpovídající vašemu filtru."
                : "Zatím nebyly vytvořeny žádné záměry."}
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
}
