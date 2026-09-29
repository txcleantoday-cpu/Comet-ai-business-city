export async function fetchJson(url,init={},timeoutMs=45000){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const r=await fetch(url,{...init,signal:controller.signal});
    const text=await r.text();
    let body=null;
    try{body=text?JSON.parse(text):null}catch{body=text}
    if(!r.ok){
      const msg=typeof body==='string'?body:JSON.stringify(body);
      const e=new Error(`${r.status} ${r.statusText}: ${msg}`);
      e.status=r.status;e.body=body;throw e;
    }
    return body;
  }finally{clearTimeout(timer)}
}

export function required(name){const v=process.env[name];if(!v)throw new Error(`${name} is not configured`);return v}
export function configured(...names){return names.every(n=>Boolean(process.env[n]))}
