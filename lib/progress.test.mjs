import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanupInstruction, quotaNotice } from '../desktop/ui/progress.mjs';
test('cleanup status separates enumeration, actual processing, quota waits and completion',()=>{
 assert.match(cleanupInstruction({enabled:true,sweepPhase:'collecting'}),/Finding existing inbox/);
 const waiting={enabled:true,sweepPhase:'processing',sweepProgress:{processed:1200,total:5000},error:'connection_interrupted',failureReason:'rateLimitExceeded',retryAt:Date.now()+60000};
 assert.match(cleanupInstruction(waiting),/1,200 of 5,000/);assert.match(quotaNotice(waiting),/Next retry after/);
 assert.match(cleanupInstruction({enabled:true,sweepPhase:'complete'}),/Initial inbox check complete/);
 assert.match(cleanupInstruction({...waiting,enabled:false}),/Paused/);
 assert.equal(quotaNotice({...waiting,failureReason:'forbidden'}),'');
});
