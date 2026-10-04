ALTER TABLE public.agents ADD COLUMN autopilot boolean NOT NULL DEFAULT false, ADD COLUMN articles_per_day integer NOT NULL DEFAULT 1, ADD COLUMN next_run_at timestamptz, ADD COLUMN last_run_at timestamptz, ADD COLUMN last_error text;
ALTER TABLE public.articles ADD COLUMN seo_score integer, ADD COLUMN seo_report jsonb NOT NULL DEFAULT '[]'::jsonb, ADD COLUMN auto_generated boolean NOT NULL DEFAULT false;
CREATE TABLE public.autopilot_lock (id integer PRIMARY KEY, locked_until timestamptz NOT NULL DEFAULT 'epoch');
GRANT ALL ON public.autopilot_lock TO service_role;
ALTER TABLE public.autopilot_lock ENABLE ROW LEVEL SECURITY;
INSERT INTO public.autopilot_lock (id) VALUES (1);