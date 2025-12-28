import { Link } from "react-router-dom";
import { LucideIcon, ArrowRight } from "lucide-react";

interface DashboardTileProps {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  variant?: "default" | "primary" | "accent";
}

export function DashboardTile({
  title,
  description,
  href,
  icon: Icon,
  variant = "default",
}: DashboardTileProps) {
  const variants = {
    default: "bg-card border border-border hover:border-primary/30 hover:shadow-md",
    primary: "bg-primary text-primary-foreground hover:bg-primary/90",
    accent: "bg-accent text-accent-foreground hover:bg-accent/90",
  };

  const iconVariants = {
    default: "bg-primary/10 text-primary",
    primary: "bg-primary-foreground/20 text-primary-foreground",
    accent: "bg-accent-foreground/20 text-accent-foreground",
  };

  const textVariants = {
    default: "text-muted-foreground",
    primary: "text-primary-foreground/80",
    accent: "text-accent-foreground/80",
  };

  return (
    <Link
      to={href}
      className={`block rounded-xl p-5 transition-all duration-200 ${variants[variant]}`}
    >
      <div className="flex items-start gap-4">
        <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${iconVariants[variant]}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-lg mb-1">{title}</h3>
          <p className={`text-sm ${textVariants[variant]}`}>{description}</p>
        </div>
        <ArrowRight className="h-5 w-5 opacity-50 flex-shrink-0 mt-1" />
      </div>
    </Link>
  );
}
