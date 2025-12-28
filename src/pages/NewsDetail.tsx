import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Calendar, User } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

export default function NewsDetail() {
  const { id } = useParams<{ id: string }>();

  const { data: news, isLoading, error } = useQuery({
    queryKey: ["news", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("news")
        .select("*")
        .eq("id", id)
        .eq("status", "published")
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
          <Skeleton className="h-64 w-full mb-6" />
          <Skeleton className="h-48 w-full" />
        </div>
      </Layout>
    );
  }

  if (error || !news) {
    return (
      <Layout>
        <div className="page-container text-center py-16">
          <h1 className="text-2xl font-bold text-foreground mb-4">
            Novinka nenalezena
          </h1>
          <p className="text-muted-foreground mb-6">
            Požadovaná novinka neexistuje nebo byla odstraněna.
          </p>
          <Link to="/novinky">
            <Button>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Zpět na novinky
            </Button>
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <article className="page-container max-w-4xl">
        <Link
          to="/novinky"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Zpět na novinky
        </Link>

        <header className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4 text-balance">
            {news.title}
          </h1>

          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-4">
            {news.published_at && (
              <span className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                {formatDateTime(news.published_at)}
              </span>
            )}
            {news.author && (
              <span className="flex items-center gap-1.5">
                <User className="h-4 w-4" />
                {news.author}
              </span>
            )}
          </div>

          {news.tags && news.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {news.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="bg-tag-bg text-tag-text">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </header>

        {news.image && (
          <div className="mb-8 rounded-xl overflow-hidden">
            <img
              src={news.image}
              alt={news.title}
              className="w-full h-auto max-h-96 object-cover"
            />
          </div>
        )}

        {news.perex && (
          <p className="text-lg text-muted-foreground mb-6 leading-relaxed">
            {news.perex}
          </p>
        )}

        {news.content && (
          <div className="prose prose-slate max-w-none">
            {news.content.split("\n").map((paragraph, index) => (
              <p key={index} className="text-foreground leading-relaxed mb-4">
                {paragraph}
              </p>
            ))}
          </div>
        )}
      </article>
    </Layout>
  );
}
