import { supabase } from '../supabase';

const TRIKE_SERVER_URL = import.meta.env.VITE_TRIKE_SERVER_URL ||
  `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/trike-server`;

async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session?.access_token || ''}`,
  };
}

export async function sendContract(params: {
  deal_id: string;
  template_id: string;
  signer_name: string;
  signer_email: string;
}) {
  const headers = await getAuthHeaders();
  const response = await fetch(`${TRIKE_SERVER_URL}/contracts/send`, {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Failed to send contract');
  }
  return response.json();
}

export async function getContractStatus(contractId: string) {
  const headers = await getAuthHeaders();
  const response = await fetch(`${TRIKE_SERVER_URL}/contracts/${contractId}/status`, {
    method: 'GET',
    headers,
  });
  return response.json();
}
