
-- Create project_manifests table
CREATE TABLE IF NOT EXISTS public.project_manifests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    pitch TEXT,
    manifest JSONB DEFAULT '{}'::jsonb NOT NULL,
    monopoly_score INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS on project_manifests
ALTER TABLE public.project_manifests ENABLE ROW LEVEL SECURITY;

-- Create policies for project_manifests
CREATE POLICY "Users can view their own projects" 
    ON public.project_manifests FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own projects" 
    ON public.project_manifests FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own projects" 
    ON public.project_manifests FOR UPDATE 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own projects" 
    ON public.project_manifests FOR DELETE 
    USING (auth.uid() = user_id);

-- Create lens_discussions table for agent debates
CREATE TABLE IF NOT EXISTS public.lens_discussions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES public.project_manifests(id) ON DELETE CASCADE NOT NULL,
    lens_id TEXT NOT NULL,
    agent_id TEXT NOT NULL, -- e.g., 'visionary', 'skeptic', 'gp_jury'
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS on lens_discussions
ALTER TABLE public.lens_discussions ENABLE ROW LEVEL SECURITY;

-- Create policies for lens_discussions (via project ownership)
CREATE POLICY "Users can view discussions for their projects" 
    ON public.lens_discussions FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM public.project_manifests 
            WHERE id = lens_discussions.project_id 
            AND user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert discussions for their projects" 
    ON public.lens_discussions FOR INSERT 
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.project_manifests 
            WHERE id = project_id 
            AND user_id = auth.uid()
        )
    );

-- Add updated_at trigger for project_manifests
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
BEFORE UPDATE ON public.project_manifests
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();
