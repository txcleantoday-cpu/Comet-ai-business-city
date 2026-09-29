import {fetchJson,required} from './http.mjs';
const version=()=>required('META_GRAPH_VERSION');
const root=()=>`https://graph.facebook.com/${version()}`;
export async function publishFacebookText({message}){const page=required('META_PAGE_ID'),token=required('META_ACCESS_TOKEN');const body=new URLSearchParams({message,access_token:token});return fetchJson(`${root()}/${page}/feed`,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body})}
export async function createInstagramImageContainer({imageUrl,caption}){const user=required('META_IG_USER_ID'),token=required('META_ACCESS_TOKEN');const body=new URLSearchParams({image_url:imageUrl,caption,access_token:token});return fetchJson(`${root()}/${user}/media`,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body})}
export async function publishInstagramContainer(creationId){const user=required('META_IG_USER_ID'),token=required('META_ACCESS_TOKEN');const body=new URLSearchParams({creation_id:creationId,access_token:token});return fetchJson(`${root()}/${user}/media_publish`,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body})}
