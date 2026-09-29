import {fetchJson,configured,required} from './http.mjs';
let cache={token:null,expiresAt:0,refresh:null};
const root='https://openapi.etsy.com/v3/application';
function apiKey(){return `${required('ETSY_KEYSTRING')}:${required('ETSY_SHARED_SECRET')}`}
export async function etsyAccessToken(){
  if(process.env.ETSY_ACCESS_TOKEN)return process.env.ETSY_ACCESS_TOKEN;
  if(cache.token&&Date.now()<cache.expiresAt-60000)return cache.token;
  if(!configured('ETSY_KEYSTRING','ETSY_REFRESH_TOKEN'))throw new Error('Etsy OAuth is not configured');
  const body=new URLSearchParams({grant_type:'refresh_token',client_id:required('ETSY_KEYSTRING'),refresh_token:cache.refresh||required('ETSY_REFRESH_TOKEN')});
  const r=await fetchJson('https://api.etsy.com/v3/public/oauth/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body});
  cache={token:r.access_token,expiresAt:Date.now()+Number(r.expires_in||3600)*1000,refresh:r.refresh_token||cache.refresh};return cache.token;
}
async function authHeaders(extra={}){return {Authorization:`Bearer ${await etsyAccessToken()}`,'x-api-key':apiKey(),...extra}}
export async function createDraftListing(shopId,input){const body=new URLSearchParams();for(const[k,v]of Object.entries(input))if(v!==undefined&&v!==null)body.set(k,String(v));return fetchJson(`${root}/shops/${shopId}/listings`,{method:'POST',headers:await authHeaders({'content-type':'application/x-www-form-urlencoded'}),body})}
export async function updateListing(shopId,listingId,input){const body=new URLSearchParams();for(const[k,v]of Object.entries(input))if(v!==undefined&&v!==null)body.set(k,String(v));return fetchJson(`${root}/shops/${shopId}/listings/${listingId}`,{method:'PATCH',headers:await authHeaders({'content-type':'application/x-www-form-urlencoded'}),body})}
export async function uploadListingImage(shopId,listingId,bytes,name='image.png',mime='image/png'){const f=new FormData();f.append('image',new Blob([bytes],{type:mime}),name);return fetchJson(`${root}/shops/${shopId}/listings/${listingId}/images`,{method:'POST',headers:await authHeaders(),body:f},120000)}
export async function uploadListingFile(shopId,listingId,bytes,name='download.png',mime='image/png'){const f=new FormData();f.append('file',new Blob([bytes],{type:mime}),name);f.append('name',name);return fetchJson(`${root}/shops/${shopId}/listings/${listingId}/files`,{method:'POST',headers:await authHeaders(),body:f},120000)}
