#!/usr/bin/env node
/**
 * Deploy Edge Function to Supabase projects
 * Usage: node scripts/deploy-edge-function.js <project-id>
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const projectId = process.argv[2];
const functionName = 'trike-server';

if (!projectId) {
  console.error('Usage: node scripts/deploy-edge-function.js <project-id>');
  console.error('Example: node scripts/deploy-edge-function.js czcpjmfiphffwetxqpjc');
  process.exit(1);
}

// Get access token from environment or prompt
const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
if (!accessToken) {
  console.error('Error: SUPABASE_ACCESS_TOKEN environment variable not set');
  console.error('Get your access token from: https://supabase.com/dashboard/account/tokens');
  process.exit(1);
}

async function deployFunction() {
  try {
    const functionDir = path.join(__dirname, '..', 'supabase', 'functions', functionName);
    const indexPath = path.join(functionDir, 'index.ts');
    const denoJsonPath = path.join(functionDir, 'deno.json');

    // Read files
    console.log('Reading function files...');
    const indexContent = fs.readFileSync(indexPath, 'utf-8');
    const denoJsonContent = fs.readFileSync(denoJsonPath, 'utf-8');

    // Prepare files for upload
    const files = [
      { name: 'index.ts', content: indexContent },
      { name: 'deno.json', content: denoJsonContent }
    ];

    // Use Supabase Management API
    const managementUrl = `https://api.supabase.com/v1/projects/${projectId}/functions/${functionName}`;
    
    console.log(`Deploying ${functionName} to project ${projectId}...`);
    
    const response = await fetch(managementUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        entrypoint_path: 'index.ts',
        verify_jwt: true,
        files: files
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Deployment failed: ${response.status} ${response.statusText}`);
      console.error(errorText);
      process.exit(1);
    }

    const result = await response.json();
    console.log('✅ Deployment successful!');
    console.log(result);
  } catch (error) {
    console.error('Deployment error:', error.message);
    process.exit(1);
  }
}

deployFunction();
