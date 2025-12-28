import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Calendar, User } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime, getStatusLabel, getPriorityLabel } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

export default function IntentDetail() {
  const { id } = useParams<{ id: string }>();

  const { data: intent, isLoading, error } = useQuery({
    queryKey: ["intent", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("intents")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <Layout>
        <div className="page-container">
          <Skeleton className="h-8 w-32 mb-6" />
          <Skeleton className="h-12 w-3/4 mb-4" />
          <Skeleton className="h-48 w-full" />
        </div>
      </Layout>
    );
  }

  if (error || !intent) {
    return (
      <Layout>
        <div className="page-container text-center py-16">
          <h1 className="text-2xl font-bold text-foreground mb-4">
            Záměr nenalezen
          </h1>
          <p className="text-muted-foreground mb-6">
            Požadovaný záměr neexistuje nebo byl odstraněn.
          </p>
          <Link to="/zamery">
            <Button>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Zpět na záměry
            </Button>
          </Link>
        </div>
      </Layout>
    );
  }

  const statusClass = intent.status ? `status-${intent.status}` : "status-navrh";
  const priorityClass = intent.priority ? `priority-${intent.priority}` : "priority-medium";

  return (
    <Layout>
      <article className="page-container max-w-4xl">
        <Link
          to="/zamery"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Zpět na záměry
        </Link>

        <header className="mb-8">
          <div className="flex flex-wrap items-start gap-4 mb-4">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground text-balance flex-1">
              {intent.title}
            </h1>
            <span className={`status-badge ${statusClass} text-base px-4 py-1.5`}>
              {getStatusLabel(intent.status)}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            {intent.proposer_name && (
              <span className="flex items-center gap-1.5">
                <User className="h-4 w-4" />
                Navrhovatel: {intent.proposer_name}
              </span>
            )}
            {intent.created_at && (
              <span className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                {formatDateTime(intent.created_at)}
              </span>
            )}
            {intent.priority && (
              <span className={`status-badge ${priorityClass}`}>
                Priorita: {getPriorityLabel(intent.priority)}
              </span>
            )}
          </div>
        </header>

        {intent.description && (
          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Popis záměru</h2>
            <div className="prose prose-slate max-w-none">
              {intent.description.split("\n").map((paragraph, index) => (
                <p key={index} className="text-foreground leading-relaxed mb-4 last:mb-0">
                  {paragraph}
                </p>
              ))}
            </div>
          </div>
        )}
      </article>
    </Layout>
  );
}
