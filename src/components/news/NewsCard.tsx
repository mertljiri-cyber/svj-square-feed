import { Link } from "react-router-dom";
import { Calendar, User, Pin } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

interface NewsCardProps {
  id: string;
  title: string;
  perex?: string | null;
  image?: string | null;
  author?: string | null;
  tags?: string[] | null;
  published_at?: string | null;
  pinned?: boolean | null;
}

export function NewsCard({
  id,
  title,
  perex,
  image,
  author,
  tags,
  published_at,
  pinned,
}: NewsCardProps) {
  return (
    <Link to={`/novinky/${id}`}>
      <Card className="h-full card-hover overflow-hidden">
        {image && (
          <div className="aspect-video w-full overflow-hidden">
            <img
              src={image}
              alt={title}
              className="h-full w-full object-cover"
            />
          </div>
        )}
        <CardContent className={`p-5 ${image ? "" : "pt-5"}`}>
          <div className="flex items-start justify-between gap-2 mb-3">
            <h3 className="text-lg font-semibold text-foreground line-clamp-2">
              {title}
            </h3>
            {pinned && (
              <Pin className="h-4 w-4 text-primary flex-shrink-0" />
            )}
          </div>

          {perex && (
            <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
              {perex}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {published_at && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {formatDate(published_at)}
              </span>
            )}
            {author && (
              <span className="flex items-center gap-1">
                <User className="h-3.5 w-3.5" />
                {author}
              </span>
            )}
          </div>

          {tags && tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="text-xs bg-tag-bg text-tag-text"
                >
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
