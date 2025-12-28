import { Link } from "react-router-dom";
import { Calendar, User } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate, getStatusLabel, getPriorityLabel } from "@/lib/utils";

interface IntentCardProps {
  id: string;
  title: string;
  description?: string | null;
  proposer_name?: string | null;
  status?: string | null;
  priority?: string | null;
  created_at?: string | null;
}

export function IntentCard({
  id,
  title,
  description,
  proposer_name,
  status,
  priority,
  created_at,
}: IntentCardProps) {
  const statusClass = status ? `status-${status}` : "status-navrh";
  const priorityClass = priority ? `priority-${priority}` : "priority-medium";

  return (
    <Link to={`/zamery/${id}`}>
      <Card className="h-full card-hover">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <h3 className="text-lg font-semibold text-foreground line-clamp-2">
              {title}
            </h3>
            <span className={`status-badge ${statusClass} flex-shrink-0`}>
              {getStatusLabel(status)}
            </span>
          </div>

          {description && (
            <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
              {description}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {proposer_name && (
              <span className="flex items-center gap-1">
                <User className="h-3.5 w-3.5" />
                {proposer_name}
              </span>
            )}
            {created_at && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {formatDate(created_at)}
              </span>
            )}
            {priority && (
              <span className={`status-badge ${priorityClass}`}>
                {getPriorityLabel(priority)}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
