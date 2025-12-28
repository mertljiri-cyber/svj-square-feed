import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
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
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Záměry</h1>
          <p className="text-muted-foreground">
            Přehled návrhů na opravy, změny a investice v domě
          </p>
        </div>

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
