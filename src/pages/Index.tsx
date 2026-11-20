import { useQuery } from "@tanstack/react-query";
import { Lightbulb, FileText, Newspaper, Wrench } from "lucide-react";
import { Link } from 'react-router-dom';
import { Layout } from "@/components/layout/Layout";
import { NewsCard } from "@/components/news/NewsCard";
import { DashboardTile } from "@/components/ui/DashboardTile";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";

export default function Index() {
  const { data: settings } = useQuery({
    queryKey: ["settings", "intro_text"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "intro_text")
        .maybeSingle();
      if (error) throw error;
      return data?.value || "";
    },
  });

  const { data: news, isLoading: newsLoading } = useQuery({
    queryKey: ["news", "dashboard"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("news")
        .select("*")
        .eq("status", "published")
        .order("pinned", { ascending: false })
        .order("published_at", { ascending: false })
        .limit(3);
      if (error) throw error;
      return data;
    },
  });

  return (
    <Layout>
      {/* Hero Section */}
      <section className="bg-gradient-to-b from-primary/5 to-background border-b border-border">
        <div className="page-container py-12">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4 text-balance">
            Informační portál SVJ
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl">
            {settings || "Vítejte na informačním portálu Společenství vlastníků jednotek."}
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            {import.meta.env.VITE_SVJ_ASK_ENABLED !== 'false' && <Link className="rounded-lg bg-primary px-5 py-3 text-center font-medium text-primary-foreground" to="/zeptat-se">Zeptat se na dům</Link>}
            <Link className="rounded-lg border bg-card px-5 py-3 text-center font-medium" to="/technicky-prehled">Prohlédnout technický přehled</Link>
          </div>
        </div>
      </section>

      <div className="page-container">
        {/* Action Tiles */}
        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-12">
          <DashboardTile
            title="Navrhnout záměr"
            description="Máte nápad na vylepšení domu?"
            href="/formulare"
            icon={Lightbulb}
            variant="primary"
          />
          <DashboardTile
            title="Formuláře"
            description="Nahlaste problém nebo vyplňte průzkum"
            href="/formulare"
            icon={FileText}
            variant="accent"
          />
          <DashboardTile
            title="Technický přehled"
            description="Společné části a technologie domu"
            href="/technicky-prehled"
            icon={Wrench}
          />
          <DashboardTile
            title="Všechny novinky"
            description="Přehled všech aktualit a oznámení"
            href="/novinky"
            icon={Newspaper}
          />
        </section>

        {/* Latest News */}
        <section>
          <h2 className="section-title">Aktuální novinky</h2>
          {newsLoading ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-48 rounded-xl" />
              ))}
            </div>
          ) : news && news.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {news.map((item, index) => (
                <div
                  key={item.id}
                  className="animate-fade-in"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <NewsCard {...item} />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">Zatím nebyly publikovány žádné novinky.</p>
          )}
        </section>
      </div>
    </Layout>
  );
}
