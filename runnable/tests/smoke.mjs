import {spawn} from 'node:child_process';
import {setTimeout as sleep} from 'node:timers/promises';

const port=8799;
const child=spawn(process.execPath,['server.mjs'],{
  cwd:new URL('..',import.meta.url).pathname,
  env:{...process.env,ABC_PORT:String(port),SIMULATION_MODE:'true'},
  stdio:['ignore','inherit','inherit']
});

let startupError;
child.on('error',error=>{startupError=error});

async function waitForHealth(base){
  const deadline=Date.now()+10_000;
  let lastError;
  while(Date.now()<deadline){
    if(startupError)throw startupError;
    if(child.exitCode!==null||child.signalCode!==null){
      throw new Error(`server exited before health check (code: ${child.exitCode}, signal: ${child.signalCode})`);
    }
    try{
      const r=await fetch(`${base}/api/health`,{
        signal:AbortSignal.timeout(Math.max(1,Math.min(500,deadline-Date.now())))
      });
      await r.body?.cancel();
      if(r.ok)return;
      lastError=new Error(`health returned HTTP ${r.status}`);
    }catch(e){lastError=e}
    await sleep(Math.max(0,Math.min(200,deadline-Date.now())));
  }
  throw new Error(`server did not become ready within 10s: ${lastError?.message||'timeout'}`);
}

try{
  const base=`http://127.0.0.1:${port}`;
  await waitForHealth(base);

  let r=await fetch(`${base}/api/commands`,{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({text:'Find 5 medical practices in Plano and prepare outreach'})
  });
  const job=await r.json();
  if(!job.id)throw new Error('job not created');

  for(let i=0;i<7;i++)await fetch(`${base}/api/worker/tick`,{method:'POST'});

  const s=await (await fetch(`${base}/api/state`)).json();
  const j=s.jobs.find(x=>x.id===job.id);
  if(j.status!=='waiting_approval')throw new Error(`expected waiting_approval, got ${j.status}`);

  const a=s.approvals.find(x=>x.job_id===job.id&&x.status==='pending');
  if(!a)throw new Error('approval missing');

  await fetch(`${base}/api/approvals/${a.id}`,{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({decision:'approved'})
  });
  await fetch(`${base}/api/worker/tick`,{method:'POST'});

  const s2=await (await fetch(`${base}/api/state`)).json();
  const j2=s2.jobs.find(x=>x.id===job.id);
  if(j2.status!=='completed')throw new Error(`expected completed, got ${j2.status}`);

  console.log(JSON.stringify({ok:true,jobId:job.id,status:j2.status,events:s2.events.length}));
}finally{
  child.kill('SIGTERM');
}
