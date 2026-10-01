import test from "node:test";
import assert from "node:assert/strict";
import { classifyForAbyss } from "./spammish-policy.mjs";

test("diverts a corroborated cold B2B sales pitch deterministically", () => {
  const message = {
    from: "Alex <alex@agency.example>",
    subject: "Re: quick question",
    body: "We help teams with lead generation. Open to a 15-minute call next week?",
  };
  const first = classifyForAbyss(message);
  assert.equal(first.divert, true);
  assert.equal(first.destination, "The Abyss");
  assert.deepEqual(first, classifyForAbyss(message));
});

test("recognizes common scripted subject/body variants only when cues corroborate", () => {
  const examples = [
    { subject: "Quick question", body: "Saw your company website. Our team helps companies like yours book more meetings. Book a 15-minute call?" },
    { subject: "Following up on my last email", body: "We help teams with lead generation. Open to a quick call next week?" },
    { subject: "Re: quick question", body: "We provide SEO search rankings. Would you be against a 15-minute conversation?" },
    { subject: "An idea for your team", body: "I noticed your team is growing. We work with companies like yours on qualified leads. Worth a quick chat?" },
  ];
  for (const message of examples) assert.equal(classifyForAbyss(message).divert, true, message.subject);
});

test("keeps uncertain mail and plausible real conversations in the inbox", () => {
  assert.equal(classifyForAbyss({ subject: "Re: quick question", body: "Can we talk?" }).divert, false);
  assert.equal(classifyForAbyss({ subject: "Your invoice", body: "Payment due tomorrow" }).divert, false);
  assert.equal(classifyForAbyss({ subject: "Project update", body: "We help teams with lead generation. Open to a call?", headers: { "in-reply-to": "<known-thread>" } }).divert, false);
});

test("diverts obvious spam, but protects security and account messages", () => {
  assert.equal(classifyForAbyss({ subject: "You have won a crypto giveaway", headers: { precedence: "bulk" } }).divert, true);
  assert.equal(classifyForAbyss({ subject: "Urgent account suspension", body: "Click here immediately to restore your password" }).divert, false);
});

test("uses no model or network configuration", () => {
  assert.equal(classifyForAbyss({ subject: "Hello" }).confidence, "uncertain");
});

test('weighted scores are deterministic, explainable and never percentages', () => {
 const m={subject:'Re: quick question',body:'Saw your company website. We help teams with qualified leads. Open to a 15-minute call?',from:'seller@example.test'};
 const context={senderSeen:false,domainSeen:false,outboundToSender:false,repliedToSender:false};
 const a=classifyForAbyss(m,context);assert.deepEqual(a,classifyForAbyss(m,context));
 assert.equal(a.divert,true);assert.ok(a.score>=70);assert.equal(a.rawScore,a.evidence.reduce((sum,x)=>sum+x.points,0));
 assert.ok(a.evidence.some(x=>x.code==='fake_reply_subject'));
 assert.equal(classifyForAbyss({subject:'Re: quick question',body:'Can we talk?'}).divert,false);
 assert.equal(classifyForAbyss(m).evidence.some(x=>x.code==='unknown_sender'),false);
});
test('strong protections defeat even high-score outreach and scam language', () => {
 const m={subject:'Quick question',body:'We help with lead generation. Open to a 15-minute call? Claim your prize. Your invoice is ready.'};
 assert.equal(classifyForAbyss(m).divert,false);
 const pitch={...m,body:'We help with lead generation. Open to a 15-minute call?'};
 for(const context of [{outboundToSender:true},{repliedToSender:true},{outboundToDomain:true},{inContacts:true},{knownTransactionalDomain:true},{rescued:true},{threadParticipated:true}])assert.equal(classifyForAbyss(pitch,context).divert,false);
 assert.equal(classifyForAbyss({subject:'Weekly newsletter',body:'We help with lead generation. Book a demo. Unsubscribe.'}).divert,false);
});
test('non-B2B unsolicited promotions, scams and exact warmup markers can qualify', () => {
 const context={senderSeen:false,domainSeen:false,outboundToSender:false,repliedToSender:false};
 assert.equal(classifyForAbyss({subject:'Exclusive offer',body:'Limited-time offer. Get 50% off. Shop now.',headers:{'list-unsubscribe':'fixture'}},context).divert,true);
 assert.equal(classifyForAbyss({subject:'Claim your prize',body:'You have won a crypto giveaway.'}).divert,true);
 assert.equal(classifyForAbyss({subject:'Reserve a slot - wbx abc',body:'Synthetic warmup copy.'}).divert,true);
 assert.equal(classifyForAbyss({subject:'WBX conference update',body:'Please review the agenda.'}).divert,false);
});
test('verified unanswered sales sequences can qualify; actual user replies stay protected', () => {
 const m={subject:'Following up',body:'We help with lead generation. Open to a quick call?',headers:{'in-reply-to':'fixture'}};
 const context={outboundToSender:false,threadParticipated:false,priorSolicitation:true};
 const a=classifyForAbyss(m,context);assert.equal(a.divert,true);assert.ok(a.evidence.some(x=>x.code==='sequenced_followup'));
 assert.equal(classifyForAbyss(m).divert,false);assert.equal(classifyForAbyss(m,{...context,outboundToSender:true}).divert,false);
});
test('bulk, tracking and first-contact signals alone never divert legitimate introductions', () => {
 for(const m of [{subject:'Hello',body:'Have 15 minutes?',links:{calendar:true,tracking:true}},{subject:'Product updates',body:'Manage preferences',headers:{'list-unsubscribe':'fixture'}},{subject:'Quick question',body:'Do you have time to discuss the invoice?'}])assert.equal(classifyForAbyss(m,{senderSeen:false,domainSeen:false,outboundToSender:false}).divert,false);
});


test('one outbound-history observation is never scored twice as reply history',()=>{
 const message={subject:'Hello',body:'We provide software development. Have 15 minutes?'};
 const noOutbound=classifyForAbyss(message,{outboundToSender:false,repliedToSender:false});
 assert.equal(noOutbound.evidence.filter(e=>['no_prior_reply','no_prior_outbound'].includes(e.code)).length,1);
 const priorOutbound=classifyForAbyss(message,{outboundToSender:true,repliedToSender:true});
 assert.equal(priorOutbound.evidence.filter(e=>['prior_reply','prior_outbound'].includes(e.code)).length,1);
 assert.equal(priorOutbound.divert,false);
});
