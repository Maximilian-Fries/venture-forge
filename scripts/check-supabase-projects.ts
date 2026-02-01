
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load .env from root
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkProjects() {
    console.log('Connecting to Supabase:', supabaseUrl);

    const { data: projects, error } = await supabase
        .from('project_manifests')
        .select('id, title, created_at')
        .order('created_at', { ascending: true }); // Oldest first

    if (error) {
        console.error('Error fetching projects:', error);
        process.exit(1);
    }

    console.log(`\nTotal Projects in Supabase: ${projects.length}`);

    // Check for duplicates
    const titleMap = new Map<string, any[]>();
    projects.forEach((p: any) => {
        if (!titleMap.has(p.title)) {
            titleMap.set(p.title, []);
        }
        titleMap.get(p.title)?.push(p);
    });

    let duplicateCount = 0;
    const idsToDelete: string[] = [];

    titleMap.forEach((items, title) => {
        if (items.length > 1) {
            console.log(`- Duplicate Title: "${title}" (${items.length} copies)`);
            duplicateCount++;

            // Keep the NEWEST one? Or the OLDEST?
            // Usually keeping the newest is safer if they made edits, 
            // but if the sync was "dumb" (just copy), they are identical.
            // Let's keep the NEWEST one (last in the list since we sorted by created_at asc?? No wait).
            // We sorted by created_at ASC (Oldest -> Newest).
            // So the LAST item is the Newest.

            // Let's mark all but the last one for deletion.
            for (let i = 0; i < items.length - 1; i++) {
                idsToDelete.push(items[i].id);
            }
        }
    });

    if (duplicateCount === 0) {
        console.log("No duplicates found based on title.");
    } else {
        console.log(`\nFound ${duplicateCount} titles with duplicate entries.`);
        console.log(`Identified ${idsToDelete.length} redundant records to delete.`);

        // Uncomment to actually delete
        if (process.argv.includes('--delete')) {
            console.log("Deleting...");
            const { error: delError } = await supabase
                .from('project_manifests')
                .delete()
                .in('id', idsToDelete);

            if (delError) console.error("Delete failed:", delError);
            else console.log("Deletion complete.");
        } else {
            console.log("Run with --delete to remove them.");
        }
    }
}

checkProjects();
