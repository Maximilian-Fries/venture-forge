
import { createClient } from "@supabase/supabase-js";
import 'dotenv/config';

// Load environment variables manually if dotenv doesn't work out of the box with bun/ts-node
// Alternatively, run with `bun run scripts/list-users.ts` which loads .env automatically

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Missing Supabase credentials in .env");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function listUsers() {
    const { data: { users }, error } = await supabase.auth.admin.listUsers();

    if (error) {
        console.error("Error listing users:", error.message);
        return;
    }

    console.log("Registered Users:");
    users.forEach((user) => {
        console.log(`- ${user.email} (ID: ${user.id})`);
    });
}

listUsers();
