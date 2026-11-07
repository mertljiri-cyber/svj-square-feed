import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { FormCard } from "@/components/forms/FormCard";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";

export default function Forms() {
  const { data: forms, isLoading } = useQuery({
    queryKey: ["forms"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("forms")
        .select("*")
        .eq("active", true)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  return (
    <Layout>
      <div className="page-container">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Formuláře</h1>
          <p className="text-muted-foreground">
            Vyberte si formulář pro komunikaci s výborem SVJ
          </p>
        </div>

        <Link to="/pozadavky" className="mb-8 block rounded-xl border bg-card p-5 transition-shadow hover:shadow-md"><h2 className="font-semibold text-primary">Moje požadavky →</h2><p className="mt-1 text-sm text-muted-foreground">Nahlaste závadu, dotaz nebo návrh a sledujte jeho vyřízení.</p></Link>

        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-48 rounded-xl" />
            ))}
          </div>
        ) : forms && forms.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {forms.map((form, index) => (
              <div
                key={form.id}
                className="animate-fade-in"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <FormCard {...form} />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              Momentálně nejsou k dispozici žádné formuláře.
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
}
