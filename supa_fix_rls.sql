-- Enable RLS on the table (if not already enabled)
ALTER TABLE project_manifests ENABLE ROW LEVEL SECURITY;
ALTER TABLE lens_discussions ENABLE ROW LEVEL SECURITY;

-- Policy to allow ANYONE (including anonymous) to INSERT projects
CREATE POLICY "Allow anonymous insert projects"
ON project_manifests
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Policy to allow ANYONE to SELECT (view) projects
-- (Note: In a real production app, you might restrict this to own projects,
-- but for this demo without login, we need to allow access)
CREATE POLICY "Allow anonymous select projects"
ON project_manifests
FOR SELECT
TO anon, authenticated
USING (true);

-- Policy to allow updating own projects
-- Since we are anonymous, we can't easily track "ownership" without cookie/auth.
-- For this demo, we will allow updating ANY project to ensure editable fields work.
CREATE POLICY "Allow anonymous update projects"
ON project_manifests
FOR UPDATE
TO anon, authenticated
USING (true);

-- Repeat for lens_discussions
CREATE POLICY "Allow anonymous insert discussions"
ON lens_discussions
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Allow anonymous select discussions"
ON lens_discussions
FOR SELECT
TO anon, authenticated
USING (true);
