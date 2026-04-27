const _SUPABASE_URL = "https://pwrrfsgnkxronosyyirn.supabase.co";
const _SUPABASE_KEY = "sb_publishable_wF1sNNonwFYmm1SoXUuudA_Yz13a-v7";

const _client = window.supabase.createClient(
  _SUPABASE_URL,
  _SUPABASE_KEY,
  { auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: false } }
);

// Expose URL and key on the client object so app.js can build the Edge Function URL
_client.supabaseUrl = _SUPABASE_URL;
_client.supabaseKey = _SUPABASE_KEY;

window._supabase = window._supabase || _client;
