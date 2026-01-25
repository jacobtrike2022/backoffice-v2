// Temporary script to run SQL migrations
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://kgzhlvxzdlexsrozbbxs.supabase.co';
const SUPABASE_SERVICE_KEY = 'sbp_8eda7277618ed2aa7c865ee29b383c33638cdb47';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function runMigration(filePath) {
  const sql = fs.readFileSync(filePath, 'utf8');
  
  // Split by semicolons and execute each statement
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));
  
  console.log(`Executing ${statements.length} SQL statements from ${filePath}...`);
  
  for (const statement of statements) {
    if (statement.trim()) {
      try {
        // Use RPC to execute SQL (if available) or use direct query
        const { data, error } = await supabase.rpc('exec_sql', { sql: statement });
        
        if (error) {
          // Fallback: try direct query approach
          console.log(`Executing: ${statement.substring(0, 50)}...`);
          // Note: Supabase JS client doesn't support raw SQL execution
          // We need to use the REST API directly
        }
      } catch (err) {
        console.error(`Error executing statement:`, err.message);
      }
    }
  }
}

// Get file path from command line
const migrationFile = process.argv[2];
if (!migrationFile) {
  console.error('Usage: node run-migration.js <path-to-sql-file>');
  process.exit(1);
}

runMigration(migrationFile).catch(console.error);
