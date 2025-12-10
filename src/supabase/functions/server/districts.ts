import { Hono } from "npm:hono";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const app = new Hono();

// Create Supabase client with service role (bypasses RLS)
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

/**
 * GET /districts - Get all districts for a user's organization
 */
app.get("/", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    
    if (!accessToken) {
      return c.json({ error: 'Authorization required' }, 401);
    }

    // Get the authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    
    if (authError || !user) {
      return c.json({ error: 'Invalid authorization' }, 401);
    }

    // Get user's organization
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('organization_id')
      .eq('auth_user_id', user.id)
      .single();

    if (userError || !userData) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Get all districts for the organization
    const { data: districts, error: districtsError } = await supabase
      .from('districts')
      .select('*')
      .eq('organization_id', userData.organization_id)
      .order('name');

    if (districtsError) {
      console.error('Error fetching districts:', districtsError);
      return c.json({ error: 'Failed to fetch districts' }, 500);
    }

    return c.json({ districts });
  } catch (error: any) {
    console.error('Error in GET /districts:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * POST /districts - Create a new district
 */
app.post("/", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    
    if (!accessToken) {
      return c.json({ error: 'Authorization required' }, 401);
    }

    // Get the authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    
    if (authError || !user) {
      return c.json({ error: 'Invalid authorization' }, 401);
    }

    // Get user's organization and role
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select(`
        id,
        organization_id,
        role_id,
        roles!inner(name)
      `)
      .eq('auth_user_id', user.id)
      .single();

    if (userError || !userData) {
      console.error('User lookup error:', userError);
      return c.json({ error: 'User not found' }, 404);
    }

    // Check if user has permission (Admin, District Manager, or Trike Super Admin)
    const roleName = (userData.roles as any)?.name;
    const allowedRoles = ['Admin', 'District Manager', 'Trike Super Admin'];
    
    if (!allowedRoles.includes(roleName)) {
      return c.json({ 
        error: 'Insufficient permissions. Only Admins and District Managers can create districts.' 
      }, 403);
    }

    // Get request body
    const body = await c.req.json();
    const { name, code } = body;

    if (!name || !code) {
      return c.json({ error: 'Name and code are required' }, 400);
    }

    // Create the district (service role bypasses RLS)
    const { data: newDistrict, error: insertError } = await supabase
      .from('districts')
      .insert([{
        organization_id: userData.organization_id,
        name: name.trim(),
        code: code.trim().toUpperCase(),
        status: 'active'
      }])
      .select()
      .single();

    if (insertError) {
      console.error('Error creating district:', insertError);
      return c.json({ error: `Failed to create district: ${insertError.message}` }, 500);
    }

    console.log('District created successfully:', newDistrict);
    return c.json({ district: newDistrict });
  } catch (error: any) {
    console.error('Error in POST /districts:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * PUT /districts/:id - Update a district
 */
app.put("/:id", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    
    if (!accessToken) {
      return c.json({ error: 'Authorization required' }, 401);
    }

    // Get the authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    
    if (authError || !user) {
      return c.json({ error: 'Invalid authorization' }, 401);
    }

    const districtId = c.req.param('id');
    const body = await c.req.json();

    // Get user's organization and role
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select(`
        id,
        organization_id,
        roles!inner(name)
      `)
      .eq('auth_user_id', user.id)
      .single();

    if (userError || !userData) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Check permissions
    const roleName = (userData.roles as any)?.name;
    const allowedRoles = ['Admin', 'District Manager', 'Trike Super Admin'];
    
    if (!allowedRoles.includes(roleName)) {
      return c.json({ error: 'Insufficient permissions' }, 403);
    }

    // Update the district
    const { data: updatedDistrict, error: updateError } = await supabase
      .from('districts')
      .update(body)
      .eq('id', districtId)
      .eq('organization_id', userData.organization_id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating district:', updateError);
      return c.json({ error: `Failed to update district: ${updateError.message}` }, 500);
    }

    return c.json({ district: updatedDistrict });
  } catch (error: any) {
    console.error('Error in PUT /districts/:id:', error);
    return c.json({ error: error.message }, 500);
  }
});

export default app;
