import {fetchJson,configured,required} from './http.mjs';
let cache={token:null,expiresAt:0};
export async function googleAccessToken(){
  if(cache.token&&Date.now()<cache.expiresAt-60000)return cache.token;
  if(!configured('GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET','GOOGLE_REFRESH_TOKEN'))throw new Error('Google OAuth is not configured');
  const body=new URLSearchParams({client_id:required('GOOGLE_CLIENT_ID'),client_secret:required('GOOGLE_CLIENT_SECRET'),refresh_token:required('GOOGLE_REFRESH_TOKEN'),grant_type:'refresh_token'});
  const r=await fetchJson('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body});
  cache={token:r.access_token,expiresAt:Date.now()+Number(r.expires_in||3600)*1000};return cache.token;
}
function b64url(s){return Buffer.from(s).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
export async function createGmailDraft({to,subject,body,replyTo}){
  const token=await googleAccessToken();
  const lines=[`To: ${to}`,`Subject: ${subject}`,'Content-Type: text/plain; charset="UTF-8"'];
  if(replyTo)lines.push(`Reply-To: ${replyTo}`);lines.push('',body);
  return fetchJson('https://gmail.googleapis.com/gmail/v1/users/me/drafts',{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify({message:{raw:b64url(lines.join('\r\n'))}})});
}
export async function sendGmailDraft(draftId){const token=await googleAccessToken();return fetchJson('https://gmail.googleapis.com/gmail/v1/users/me/drafts/send',{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify({id:draftId})})}
export async function createCalendarEvent(event){const token=await googleAccessToken();const id=encodeURIComponent(process.env.GOOGLE_CALENDAR_ID||'primary');return fetchJson(`https://www.googleapis.com/calendar/v3/calendars/${id}/events`,{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify(event)})}
