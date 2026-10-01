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
