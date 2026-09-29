import {fetchJson,configured,required} from './http.mjs';
let cache={token:null,expiresAt:0};
const apiBase=()=>process.env.ZOHO_API_BASE_URL||'https://www.zohoapis.com/crm/v8';
const accounts=()=>process.env.ZOHO_ACCOUNTS_URL||'https://accounts.zoho.com';

export async function zohoAccessToken(){
  if(process.env.ZOHO_ACCESS_TOKEN) return process.env.ZOHO_ACCESS_TOKEN;
  if(cache.token && Date.now()<cache.expiresAt-60000) return cache.token;
  if(!configured('ZOHO_REFRESH_TOKEN','ZOHO_CLIENT_ID','ZOHO_CLIENT_SECRET')) throw new Error('Zoho OAuth is not configured');
  const body=new URLSearchParams({grant_type:'refresh_token',refresh_token:required('ZOHO_REFRESH_TOKEN'),client_id:required('ZOHO_CLIENT_ID'),client_secret:required('ZOHO_CLIENT_SECRET')});
  const r=await fetchJson(`${accounts()}/oauth/v2/token`,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body});
  if(!r?.access_token) throw new Error('Zoho token refresh returned no access token');
  cache={token:r.access_token,expiresAt:Date.now()+Number(r.expires_in||3600)*1000};
  return cache.token;
}
async function authHeaders(extra={}){return {Authorization:`Zoho-oauthtoken ${await zohoAccessToken()}`,...extra}}
export async function searchLeads(criteria){return fetchJson(`${apiBase()}/Leads/search?criteria=${encodeURIComponent(criteria)}`,{headers:await authHeaders()})}
export async function createLead(data){return fetchJson(`${apiBase()}/Leads`,{method:'POST',headers:await authHeaders({'content-type':'application/json'}),body:JSON.stringify({data:[data]})})}
export async function updateLead(id,data){return fetchJson(`${apiBase()}/Leads/${encodeURIComponent(id)}`,{method:'PUT',headers:await authHeaders({'content-type':'application/json'}),body:JSON.stringify({data:[data]})})}
export async function createTask(data){return fetchJson(`${apiBase()}/Tasks`,{method:'POST',headers:await authHeaders({'content-type':'application/json'}),body:JSON.stringify({data:[data]})})}
