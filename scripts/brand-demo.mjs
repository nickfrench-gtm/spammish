// Synthetic mail only. Regenerate the illustrative scores from the real policy.
import { writeFileSync } from 'node:fs';
import { classifyForAbyss } from '../lib/spammish-policy.mjs';
const messages=[
 {from:'Demo outreach <outreach@example.com>',subject:'Quick question',body:'We help teams with lead generation and increase revenue. Open to a 15-minute call? Book a demo: https://calendly.com/demo',inInbox:true},
 {from:'Demo colleague <colleague@example.com>',subject:'Re: Thursday’s draft',body:'Thanks for the draft. I added my comments.',inInbox:true,relationship:{outboundToSender:true,threadParticipated:true}},
 {from:'Demo contact <contact@example.com>',subject:'A question about your project',body:'Can you tell me whether this works on Linux?',inInbox:true}
];
writeFileSync(new URL('../marketing/assets/demo-decisions.json',import.meta.url),JSON.stringify(messages.map((message,index)=>({id:`demo${index}`,subject:message.subject,from:message.from,accountId:'demo-account',accountEmail:'demo@example.com',time:3-index,stage:index===2?'screening':'full',wasMoved:index===0,inAbyss:index===0,inInbox:index!==0,decision:classifyForAbyss(message)})),null,2)+'\n');
