import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle, Loader2 } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface FormField {
  name: string;
  label: string;
  type: string;
  required: boolean;
}

export default function FormDetail() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const { data: form, isLoading, error } = useQuery({
    queryKey: ["form", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("forms")
        .select("*")
        .eq("id", id)
        .eq("active", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const submitMutation = useMutation({
    mutationFn: async (data: Record<string, string>) => {
      // Veškerá validace a zápis jsou na serveru (RPC); klient ji jen předvyplňuje.
      if (form?.submit_target === "intent") {
        const { error } = await supabase.rpc("submit_intent", {
          p_organization_id: form.organization_id,
          p_title: data.title ?? "",
          p_description: data.description ?? "",
          p_proposer_name: data.proposer_name ?? null,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.rpc("submit_form", { p_form_id: id!, p_data: data });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      setSubmitted(true);
      toast({
        title: "Formulář odeslán",
        description: "Děkujeme za vaše podání.",
      });
    },
    onError: (err: { message?: string }) => {
      toast({
        title: "Chyba",
        description: err?.message || "Nepodařilo se odeslat formulář. Zkuste to prosím znovu.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const fields = (form?.fields as unknown as FormField[]) || [];
    
    // Validate required fields
    for (const field of fields) {
      if (field.required && !formData[field.name]?.trim()) {
        toast({
          title: "Chybějící údaje",
          description: `Pole "${field.label}" je povinné.`,
          variant: "destructive",
        });
        return;
      }
    }
    
    submitMutation.mutate(formData);
  };

  const handleInputChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="page-container max-w-2xl">
          <Skeleton className="h-8 w-32 mb-6" />
          <Skeleton className="h-12 w-3/4 mb-4" />
          <Skeleton className="h-64 w-full" />
        </div>
      </Layout>
    );
  }

  if (error || !form) {
    return (
      <Layout>
        <div className="page-container text-center py-16">
          <h1 className="text-2xl font-bold text-foreground mb-4">
            Formulář nenalezen
          </h1>
          <p className="text-muted-foreground mb-6">
            Požadovaný formulář neexistuje nebo není aktivní.
          </p>
          <Link to="/formulare">
            <Button>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Zpět na formuláře
            </Button>
          </Link>
        </div>
      </Layout>
    );
  }

  if (submitted) {
    return (
      <Layout>
        <div className="page-container max-w-2xl">
          <Card className="text-center py-12">
            <CardContent>
              <div className="flex justify-center mb-6">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/10">
                  <CheckCircle className="h-8 w-8 text-accent" />
                </div>
              </div>
              <h1 className="text-2xl font-bold text-foreground mb-4">
                Děkujeme za odeslání!
              </h1>
              <p className="text-muted-foreground mb-2">
                Vaše podání bylo úspěšně přijato.
              </p>
              <p className="text-sm text-muted-foreground mb-8">
                {form.submit_target === "intent"
                  ? "Váš návrh byl zařazen do přehledu záměrů."
                  : form.submit_target === "feedback"
                  ? "Vaše hlášení bude předáno výboru SVJ k vyřízení."
                  : "Děkujeme za vaši zpětnou vazbu."}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link to="/formulare">
                  <Button variant="outline">Zpět na formuláře</Button>
                </Link>
                <Link to="/">
                  <Button>Na úvodní stránku</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  const fields = (form.fields as unknown as FormField[]) || [];

  return (
    <Layout>
      <div className="page-container max-w-2xl">
        <Link
          to="/formulare"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Zpět na formuláře
        </Link>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{form.title}</CardTitle>
            {form.description && (
              <p className="text-muted-foreground">{form.description}</p>
            )}
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {fields.map((field) => (
                <div key={field.name} className="space-y-2">
                  <Label htmlFor={field.name}>
                    {field.label}
                    {field.required && <span className="text-destructive ml-1">*</span>}
                  </Label>
                  {field.type === "textarea" ? (
                    <Textarea
                      id={field.name}
                      value={formData[field.name] || ""}
                      onChange={(e) => handleInputChange(field.name, e.target.value)}
                      required={field.required}
                      rows={4}
                    />
                  ) : (
                    <Input
                      id={field.name}
                      type={field.type}
                      value={formData[field.name] || ""}
                      onChange={(e) => handleInputChange(field.name, e.target.value)}
                      required={field.required}
                    />
                  )}
                </div>
              ))}

              <Button
                type="submit"
                className="w-full"
                disabled={submitMutation.isPending}
              >
                {submitMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Odesílám...
                  </>
                ) : (
                  "Odeslat formulář"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
