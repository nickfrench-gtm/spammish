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
