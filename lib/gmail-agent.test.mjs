import test from "node:test";
import assert from "node:assert/strict";
import { extractMessage, moveToAbyss } from "./gmail-agent.mjs";

test("reads bounded plain text and preserves Gmail unread state", () => {
  const message = extractMessage({
    id: "m1", labelIds: ["INBOX", "UNREAD"],
    payload: { headers: [{ name: "Subject", value: "Hello" }], mimeType: "text/plain", body: { data: Buffer.from("Short note").toString("base64url") } },
  });
  assert.equal(message.body, "Short note");
  assert.equal(message.unread, true);
  assert.equal(message.inInbox, true);
});

test("moving mail changes only the Inbox and The Abyss labels", async () => {
  const originalFetch = globalThis.fetch;
  let request;
  globalThis.fetch = async (url, init) => {
    request = { url: String(url), init };
    return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    await moveToAbyss("test-token", "message/1", "Label_123");
  } finally { globalThis.fetch = originalFetch; }
  assert.match(request.url, /messages\/message%2F1\/modify$/);
  assert.deepEqual(JSON.parse(request.init.body), { addLabelIds: ["Label_123"], removeLabelIds: ["INBOX"] });
  assert.equal(/UNREAD|trash|delete|send/i.test(request.init.body), false);
});

test('initial sweep lists only Inbox with bounded pages and no spam/trash',async()=>{
 const {listInbox}=await import('./gmail-agent.mjs');const originalFetch=globalThis.fetch;let requested;
 globalThis.fetch=async(url)=>{requested=new URL(url);return new Response('{"messages":[]}');};
 try{await listInbox('fixture-token','next-page');}finally{globalThis.fetch=originalFetch;}
 assert.equal(requested.searchParams.get('labelIds'),'INBOX');assert.equal(requested.searchParams.get('includeSpamTrash'),'false');
 assert.equal(requested.searchParams.get('maxResults'),'500');assert.equal(requested.searchParams.get('pageToken'),'next-page');
});

test('complete plain text survives a large decorative HTML alternative', () => {
 const body='We help teams with lead generation. Open to a 15-minute call?';
 const msg=extractMessage({labelIds:['INBOX','UNREAD'],payload:{mimeType:'multipart/alternative',parts:[
  {mimeType:'text/plain',body:{data:Buffer.from(body).toString('base64url'),size:body.length}},
  {mimeType:'text/html',body:{data:'a'.repeat(400000),size:300000}},
 ]}});
 assert.equal(msg.body,body);assert.equal(msg.incomplete,false);assert.equal(msg.unread,true);
});
test('HTML decoration is bounded and removed before measuring usable text', () => {
 const html='<html><head><style>'+'.example { color: black; }'.repeat(2000)+'</style></head><body>We help teams with lead generation. Open to a 15-minute call?</body></html>';
 const msg=extractMessage({labelIds:['INBOX'],payload:{mimeType:'text/html',body:{data:Buffer.from(html).toString('base64url'),size:Buffer.byteLength(html)}}});
 assert.equal(msg.incomplete,false);assert.match(msg.body,/We help teams/);assert.equal(msg.body.includes('color'),false);
});
test('missing or oversized chosen content and missing MIME branches remain uncertain', () => {
 for(const payload of [
  {mimeType:'text/plain',body:{size:100,attachmentId:'fixture'}},
  {mimeType:'text/plain',body:{data:Buffer.from('x'.repeat(13000)).toString('base64url')}},
  {mimeType:'text/html',body:{data:'a'.repeat(400000),size:300000}},
  {mimeType:'multipart/mixed'},
 ]) assert.equal(extractMessage({payload}).incomplete,true);
});

test('relationship evidence short-circuits known outbound and keeps mailbox searches bounded', async () => {
 const {relationshipEvidence}=await import('./gmail-agent.mjs');const original=globalThis.fetch;const requests=[];
 globalThis.fetch=async(url)=>{requests.push(new URL(url));return new Response(JSON.stringify({messages:[{id:'sent-fixture'}]}));};
 try {const evidence=await relationshipEvidence('fixture',{id:'incoming',from:'Sales <seller@example.test>',headers:{}});assert.equal(evidence.outboundToSender,true);assert.equal(requests.length,1);assert.equal(requests[0].searchParams.get('maxResults'),'1');assert.match(requests[0].searchParams.get('q'),/in:sent/);}finally{globalThis.fetch=original;}
});
test('unknown sender is corroborated by queries; shared Gmail domains never get domain-wide reputation', async () => {
 const {relationshipEvidence}=await import('./gmail-agent.mjs');const original=globalThis.fetch;const qs=[];
 globalThis.fetch=async(url)=>{const q=new URL(url).searchParams.get('q');qs.push(q);return new Response(JSON.stringify(q.startsWith('from:')?{messages:[{id:'current'}]}:{messages:[]}));};
 try {const e=await relationshipEvidence('fixture',{id:'current',from:'seller@gmail.com',headers:{}});assert.equal(e.senderSeen,false);assert.equal(e.outboundToSender,false);assert.equal(e.domainSeen,undefined);assert.equal(e.domainSpam,undefined);assert.equal(qs.some(q=>q.includes('"gmail.com"')),false);}finally{globalThis.fetch=original;}
});
test('calendar and tracking features inspect URLs locally without clicking them', () => {
 const html='<a href="https://calendly.com/fixture/demo">Book time</a><img src="https://tracking.example.test/pixel/open?contact_id=fixture">';
 const m=extractMessage({payload:{mimeType:'text/html',body:{data:Buffer.from(html).toString('base64url')}}});
 assert.equal(m.links.calendar,true);assert.equal(m.links.tracking,true);assert.equal(m.body.includes('contact_id'),false);
});
