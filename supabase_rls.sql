-- Enable RLS on the table
ALTER TABLE project_manifests ENABLE ROW LEVEL SECURITY;

-- Policy to allow users to SELECT their own projects
CREATE POLICY "Users can view own projects" 
ON project_manifests 
FOR SELECT 
USING (auth.uid() = user_id);

-- Policy to allow users to INSERT their own projects
CREATE POLICY "Users can insert own projects" 
ON project_manifests 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Policy to allow users to UPDATE their own projects
CREATE POLICY "Users can update own projects" 
ON project_manifests 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Policy to allow users to DELETE their own projects
CREATE POLICY "Users can delete own projects" 
ON project_manifests 
FOR DELETE 
USING (auth.uid() = user_id);
