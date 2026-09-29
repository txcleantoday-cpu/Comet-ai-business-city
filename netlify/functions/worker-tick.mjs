import { claimNextStep } from '../../packages/db/src/index.mjs';
import { executeClaimedStep } from '../../packages/agents/src/index.mjs';

export default async () => {
  const results = [];
  const batch = Math.max(1, Math.min(10, Number(process.env.WEB_WORKER_BATCH || 4)));

  for (let i = 0; i < batch; i += 1) {
    const step = await claimNextStep('netlify-scheduled-worker');
    if (!step) break;

    const result = await executeClaimedStep(step);
    results.push({ stepId: step.id, type: step.type, result });

    if (result?.waiting || result?.status === 'waiting_approval') break;
  }

  return new Response(JSON.stringify({ processed: results.length, results }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
};

// Five-minute polling keeps the free-tier compute footprint modest.
// Manual/interactive processing is still available through /api/worker/tick.
export const config = {
  schedule: '*/5 * * * *'
};
