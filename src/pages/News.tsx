import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, X } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { NewsCard } from "@/components/news/NewsCard";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";

export default function News() {
  const [search, setSearch] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const { data: news, isLoading } = useQuery({
    queryKey: ["news"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("news")
        .select("*")
        .eq("status", "published")
        .order("pinned", { ascending: false })
        .order("published_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const allTags = useMemo(() => {
    if (!news) return [];
    const tags = new Set<string>();
    news.forEach((item) => {
      item.tags?.forEach((tag) => tags.add(tag));
    });
    return Array.from(tags).sort();
  }, [news]);

  const filteredNews = useMemo(() => {
    if (!news) return [];
    return news.filter((item) => {
      const matchesSearch =
        !search ||
        item.title.toLowerCase().includes(search.toLowerCase()) ||
        item.perex?.toLowerCase().includes(search.toLowerCase());
      const matchesTag = !selectedTag || item.tags?.includes(selectedTag);
      return matchesSearch && matchesTag;
    });
  }, [news, search, selectedTag]);

  return (
    <Layout>
      <div className="page-container">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Novinky</h1>
          <p className="text-muted-foreground">
            Aktuální informace a oznámení pro členy SVJ
          </p>
        </div>

        {/* Filters */}
        <div className="mb-8 space-y-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Hledat v novinkách..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {allTags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedTag && (
                <Badge
                  variant="outline"
                  className="cursor-pointer hover:bg-secondary"
                  onClick={() => setSelectedTag(null)}
                >
                  <X className="h-3 w-3 mr-1" />
                  Zrušit filtr
                </Badge>
              )}
              {allTags.map((tag) => (
                <Badge
                  key={tag}
                  variant={selectedTag === tag ? "default" : "secondary"}
                  className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
                  onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                >
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* News Grid */}
        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-48 rounded-xl" />
            ))}
          </div>
        ) : filteredNews.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredNews.map((item, index) => (
              <div
                key={item.id}
                className="animate-fade-in"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <NewsCard {...item} />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              {search || selectedTag
                ? "Nebyly nalezeny žádné novinky odpovídající vašemu filtru."
                : "Zatím nebyly publikovány žádné novinky."}
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
}
