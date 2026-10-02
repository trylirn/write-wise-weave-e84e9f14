CREATE TABLE public.sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  url text NOT NULL DEFAULT '',
  endpoint_url text NOT NULL DEFAULT '',
  api_key text NOT NULL DEFAULT '',
  default_author text NOT NULL DEFAULT '',
  default_category text NOT NULL DEFAULT '',
  analysis jsonb,
  analyzed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.sites TO service_role;
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  persona text NOT NULL DEFAULT '',
  tone text NOT NULL DEFAULT '',
  writing_style text NOT NULL DEFAULT '',
  target_length int NOT NULL DEFAULT 1200,
  formatting_rules text NOT NULL DEFAULT '',
  site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.agents TO service_role;
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid REFERENCES public.agents(id) ON DELETE SET NULL,
  site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL,
  topic text NOT NULL DEFAULT '',
  keywords text NOT NULL DEFAULT '',
  title text NOT NULL DEFAULT '',
  seo_title text NOT NULL DEFAULT '',
  slug text NOT NULL DEFAULT '',
  meta_description text NOT NULL DEFAULT '',
  excerpt text NOT NULL DEFAULT '',
  content_markdown text NOT NULL DEFAULT '',
  cover_image_prompt text NOT NULL DEFAULT '',
  tags text[] NOT NULL DEFAULT '{}',
  citations jsonb NOT NULL DEFAULT '[]',
  status text NOT NULL DEFAULT 'draft',
  scheduled_at timestamptz,
  published_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.articles TO service_role;
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;
CREATE INDEX articles_due_idx ON public.articles (status, scheduled_at);

CREATE TABLE public.publish_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid REFERENCES public.articles(id) ON DELETE CASCADE,
  site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL,
  success boolean NOT NULL,
  http_status int,
  message text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.publish_logs TO service_role;
ALTER TABLE public.publish_logs ENABLE ROW LEVEL SECURITY;