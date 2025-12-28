import { Link } from "react-router-dom";
import { FileText, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface FormCardProps {
  id: string;
  title: string;
  description?: string | null;
  submit_target?: string | null;
}

function getTargetDescription(target: string | null): string {
  switch (target) {
    case "intent":
      return "Váš návrh bude zařazen do přehledu záměrů.";
    case "feedback":
      return "Vaše hlášení bude předáno výboru SVJ.";
    case "survey":
      return "Vaše odpovědi pomohou zlepšit správu domu.";
    default:
      return "Data budou uložena a zpracována.";
  }
}

export function FormCard({ id, title, description, submit_target }: FormCardProps) {
  return (
    <Card className="h-full card-hover">
      <CardContent className="p-5 flex flex-col h-full">
        <div className="flex items-start gap-3 mb-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 flex-shrink-0">
            <FileText className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">
              {title}
            </h3>
          </div>
        </div>

        {description && (
          <p className="text-sm text-muted-foreground mb-3">
            {description}
          </p>
        )}

        <p className="text-xs text-muted-foreground mb-4">
          {getTargetDescription(submit_target)}
        </p>

        <div className="mt-auto">
          <Link to={`/formulare/${id}`}>
            <Button variant="outline" size="sm" className="w-full group">
              Vyplnit formulář
              <ArrowRight className="h-4 w-4 ml-2 transition-transform group-hover:translate-x-1" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
