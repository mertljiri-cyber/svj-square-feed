-- Tabulka pro novinky
CREATE TABLE public.news (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  perex TEXT,
  content TEXT,
  image TEXT,
  author TEXT,
  tags TEXT[] DEFAULT '{}',
  published_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  pinned BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabulka pro záměry
CREATE TABLE public.intents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  proposer_name TEXT,
  status TEXT DEFAULT 'navrh' CHECK (status IN ('navrh', 'projednava-se', 'schvaleno', 'realizace', 'hotovo')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabulka pro definice formulářů
CREATE TABLE public.forms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  fields JSONB DEFAULT '[]',
  submit_target TEXT DEFAULT 'feedback' CHECK (submit_target IN ('intent', 'feedback', 'survey')),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabulka pro odeslané formuláře
CREATE TABLE public.form_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  form_id UUID REFERENCES public.forms(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabulka pro úvodní text dashboardu
CREATE TABLE public.settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value TEXT,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS - veřejné čtení pro všechny tabulky (bez autentizace)
ALTER TABLE public.news ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Politiky pro veřejné čtení
CREATE POLICY "Public read access for news" ON public.news FOR SELECT USING (true);
CREATE POLICY "Public read access for intents" ON public.intents FOR SELECT USING (true);
CREATE POLICY "Public read access for forms" ON public.forms FOR SELECT USING (true);
CREATE POLICY "Public read access for settings" ON public.settings FOR SELECT USING (true);

-- Politiky pro vkládání formulářů (veřejné)
CREATE POLICY "Public insert for form_submissions" ON public.form_submissions FOR INSERT WITH CHECK (true);
CREATE POLICY "Public insert for intents" ON public.intents FOR INSERT WITH CHECK (true);

-- Vložit výchozí nastavení
INSERT INTO public.settings (key, value) VALUES ('intro_text', 'Vítejte na informačním portálu Společenství vlastníků jednotek. Zde naleznete aktuální novinky, přehled záměrů a formuláře pro komunikaci s výborem.');

-- Vložit ukázkové formuláře
INSERT INTO public.forms (title, description, fields, submit_target) VALUES 
('Nový záměr', 'Máte nápad na vylepšení domu? Podejte návrh na nový záměr.', '[{"name": "title", "label": "Název záměru", "type": "text", "required": true}, {"name": "description", "label": "Popis záměru", "type": "textarea", "required": true}, {"name": "proposer_name", "label": "Vaše jméno", "type": "text", "required": true}]', 'intent'),
('Nahlášení problému', 'Nahlaste technický problém nebo závadu v domě.', '[{"name": "title", "label": "Název problému", "type": "text", "required": true}, {"name": "description", "label": "Popis problému", "type": "textarea", "required": true}, {"name": "location", "label": "Místo", "type": "text", "required": false}]', 'feedback'),
('Průzkum spokojenosti', 'Pomozte nám zlepšit správu domu.', '[{"name": "rating", "label": "Celková spokojenost (1-5)", "type": "number", "required": true}, {"name": "feedback", "label": "Váš komentář", "type": "textarea", "required": false}]', 'survey');

-- Vložit ukázkové novinky
INSERT INTO public.news (title, perex, content, author, tags, status, pinned, published_at) VALUES 
('Plánovaná odstávka vody', 'V pondělí 6. ledna bude od 8:00 do 14:00 přerušena dodávka vody.', 'Vážení vlastníci,\n\nz důvodu plánované opravy vodovodního řadu bude v pondělí 6. ledna 2025 v době od 8:00 do 14:00 přerušena dodávka vody v celém domě.\n\nDoporučujeme si den předem připravit zásobu vody.\n\nDěkujeme za pochopení.\n\nVýbor SVJ', 'Výbor SVJ', ARRAY['důležité', 'voda'], 'published', true, now()),
('Výsledky shromáždění vlastníků', 'Shromáždění odsouhlasilo rekonstrukci vstupních dveří.', 'Na shromáždění vlastníků konaném dne 15. prosince 2024 bylo schváleno:\n\n1. Rekonstrukce vstupních dveří\n2. Navýšení příspěvku do fondu oprav o 5%\n3. Volba nových členů výboru\n\nZápis ze shromáždění bude k dispozici na nástěnce v přízemí.', 'Výbor SVJ', ARRAY['shromáždění'], 'published', false, now() - interval '3 days'),
('Nový úklidový harmonogram', 'Od nového roku platí aktualizovaný rozpis úklidu společných prostor.', 'Aktualizovaný harmonogram úklidu je vyvěšen na nástěnce. Prosíme o dodržování stanovených termínů.', 'Správce', ARRAY['provoz'], 'published', false, now() - interval '7 days');

-- Vložit ukázkové záměry
INSERT INTO public.intents (title, description, proposer_name, status, priority) VALUES 
('Instalace kamerového systému', 'Návrh na instalaci bezpečnostních kamer ve vstupním prostoru a garáži.', 'Jan Novák', 'projednava-se', 'medium'),
('Rekonstrukce výtahu', 'Modernizace stávajícího výtahu včetně nové kabiny.', 'Výbor SVJ', 'schvaleno', 'high'),
('Úprava zeleně na dvoře', 'Vysázení nových keřů a údržba travnaté plochy.', 'Marie Svobodová', 'navrh', 'low');