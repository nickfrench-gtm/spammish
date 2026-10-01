/**
 * Conservative, deterministic local classifier for Spammish.
 * It only returns divert=true when multiple independent signals agree.
 * No network, model, or user API key is used by this module.
 */
const text = (value) => String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
const matches = (pattern, value) => pattern.test(value);

const SALES_OFFER = /\b(?:our|we)\s+(?:help|helping|helped|offer|provide|speciali[sz]e|work with|support)|\b(?:we can|we could|we help|we've helped|our platform|our software|our solution|our service)\b/;
const SALES_CATEGORY = /\b(?:lead generation|appointment setting|sales pipeline|outbound|cold email|seo|search rankings|digital marketing|recruiting|staffing|software development|ai automation|cost savings|revenue growth|book more meetings|qualified leads)\b/;
const SALES_CTA = /\b(?:worth a (?:quick )?(?:call|chat)|open to (?:a )?(?:call|chat|meeting)|book (?:a )?(?:call|demo)|schedule (?:a )?(?:call|demo)|15[- ]minute|quick (?:call|chat)|calendar link|should i send|interested in learning|would you be against|can i send over|free audit|free assessment)\b/;
const BULK_HEADER = /\b(?:bulk|list|junk)\b/i;
const SPAM_LANGUAGE = /\b(?:you have won|claim your prize|verify your wallet|crypto giveaway|wire funds now|urgent account suspension|click here immediately|miracle cure|risk[- ]free returns|guaranteed returns|inheritance funds|dear beneficiary)\b/i;
const IMPORTANT_GUARD = /\b(?:invoice|receipt|payment|security alert|password|verification code|one[- ]time code|legal notice|delivery|shipping|order confirmation|account recovery|medical|school|family|your appointment|your reservation)\b/i;
const REAL_THREAD = /\b(?:re|fwd|fw):/i;

// Deliberately broad phrase lists feed a narrow multi-signal decision below.
// A subject phrase alone can never cause a message to be moved.
export const COLD_EMAIL_SUBJECT_PATTERNS = Object.freeze([
  /\bquick question\b/i, /\bquestion about (?:your|the) (?:team|company|business)\b/i,
  /\bcan we connect\b/i, /\bworth a conversation\b/i, /\b10 minutes?\b/i,
  /\bthought you might be interested\b/i, /\bidea for (?:your|the) (?:team|company)\b/i,
  /\bhelping (?:your|the) (?:team|company)\b/i, /\bgrow(?:ing)? your (?:pipeline|revenue|business)\b/i,
  /\b(?:following up|follow up) on my last email\b/i, /\b(?:following up|follow up) on (?:my|our) (?:note|message)\b/i,
  /\b(?:did you see|did you get) my (?:last )?(?:email|note|message)\b/i, /\b(?:bumping|bringing) this to the top\b/i,
  /\b(?:reaching|reached) out\b/i, /\b(?:connect|connecting) with (?:you|your team)\b/i,
  /\b(?:partnership|synergy) opportunity\b/i, /\b(?:scale|scaling) your (?:team|business|pipeline)\b/i,
  /\b(?:cut|reduce) your (?:costs|spend|expenses)\b/i, /\b(?:more|better) qualified leads\b/i,
  /\b(?:improve|increase) your conversion\b/i, /\b(?:your|the) sales process\b/i,
  /\b(?:automate|automating) your (?:workflow|outreach|sales)\b/i, /\b(?:ai|artificial intelligence) for (?:your|the) (?:team|business)\b/i,
  /\b(?:intro|introduction)\s*:?\s*(?:company|agency|platform)\b/i, /\b(?:request|asking) for (?:15|20|30) minutes\b/i,
  /\b(?:re|fwd|fw):\s*(?:quick question|following up|checking in|touching base)\b/i,
  /\bfollow(?:ing)? up\b/i, /\btouching base\b/i, /\bchecking in\b/i,
  /\bjust bumping this\b/i, /\b(?:last|one last) try\b/i,
]);

export const COLD_EMAIL_BODY_PATTERNS = Object.freeze([
  /\b(?:saw|noticed|came across) (?:your|the) (?:company|website|linkedin|profile|team)\b/i,
  /\b(?:we|our team) (?:help|helped|work with|speciali[sz]e in)\b/i,
  /\b(?:increase|boost|grow|improve) (?:your|the) (?:revenue|pipeline|leads|conversions|rankings)\b/i,
  /\b(?:generate|deliver|provide) (?:more |qualified )?(?:leads|meetings|appointments|pipeline)\b/i,
  /\b(?:book|schedule) (?:a )?(?:15|20|30)[- ]minute (?:call|chat|demo)\b/i,
  /\bopen to (?:a )?(?:quick )?(?:call|chat|conversation|demo)\b/i,
  /\bworth (?:a )?(?:quick )?(?:call|chat|conversation)\b/i,
  /\bwould you be against\b/i, /\bshould i send (?:you )?(?:more|details|a case study)\b/i,
  /\b(?:free|complimentary) (?:audit|assessment|consultation)\b/i,
  /\b(?:no obligation|guaranteed results|case study)\b/i,
  /\b(?:we|our team) (?:work with|partner with) (?:companies|teams|businesses)\b/i,
  /\b(?:companies|clients|customers) like yours\b/i, /\b(?:similar|comparable) (?:companies|teams|businesses)\b/i,
  /\b(?:help|helped) (?:companies|teams|businesses) (?:like|such as) yours\b/i,
  /\b(?:set up|setting up) a (?:quick )?(?:call|meeting|demo)\b/i,
  /\b(?:grab|take) (?:15|20|30) minutes\b/i, /\b(?:send|share) (?:over )?(?:a )?(?:case study|one pager|deck)\b/i,
  /\b(?:our|the) (?:proprietary|proven) (?:platform|process|system)\b/i,
  /\b(?:fill|add) your (?:sales )?pipeline\b/i, /\b(?:get|generate) more (?:customers|clients|bookings)\b/i,
  /\b(?:rank|ranking) on (?:google|search engines)\b/i,
  /\b(?:recruit|hire) top talent\b/i, /\b(?:source|sourcing) candidates\b/i,
  /\b(?:outsource|offshore) your (?:development|engineering|support)\b/i,
]);

export function classifyForAbyss(message = {}) {
  if (message.incomplete) return Object.freeze({ divert: false, destination: 'Inbox', reason: 'incomplete_message', confidence: 'uncertain', signals: {} });
  const headers = Object.fromEntries(Object.entries(message.headers || {}).map(([key, value]) => [key.toLowerCase(), String(value || "")]));
  const subject = text(message.subject || headers.subject);
  const body = text(message.body);
  const sender = text(message.from || headers.from);
  const haystack = `${subject} ${body}`;
  const signals = {
    obviousSpam: matches(SPAM_LANGUAGE, haystack),
    listUnsubscribe: Boolean(headers["list-unsubscribe"] || headers["list-id"]),
    bulkPrecedence: BULK_HEADER.test(headers.precedence || ""),
    salesOffer: SALES_OFFER.test(haystack),
    salesCategory: SALES_CATEGORY.test(haystack),
    salesCallToAction: SALES_CTA.test(haystack),
    realThreadMarker: Boolean(headers["in-reply-to"] || headers.references),
    replyLikeSubject: REAL_THREAD.test(subject),
    importantGuard: IMPORTANT_GUARD.test(haystack),
    sender: sender || null,
  };

  // Clear, corroborated unsolicited sales intent or unmistakable spam only.
  // A Re: subject alone is not proof of a real relationship or of spam.
  signals.coldSubjectPhrase = COLD_EMAIL_SUBJECT_PATTERNS.some((pattern) => pattern.test(subject));
  signals.coldBodyPhraseCount = COLD_EMAIL_BODY_PATTERNS.filter((pattern) => pattern.test(body)).length;
  const coldSales = signals.salesOffer && signals.salesCategory && signals.salesCallToAction
    && !signals.realThreadMarker && !signals.importantGuard;
  // Phrase-list path catches common scripted outreach variants. It still
  // requires multiple independent body cues plus a recognizable subject.
  const phraseMatchedColdSales = signals.coldSubjectPhrase && signals.coldBodyPhraseCount >= 2
    && !signals.realThreadMarker && !signals.importantGuard;
  const confirmedBulkSpam = signals.obviousSpam && (signals.listUnsubscribe || signals.bulkPrecedence);
  const divert = coldSales || phraseMatchedColdSales || confirmedBulkSpam || (signals.obviousSpam && !signals.importantGuard);
  return Object.freeze({
    divert,
    destination: divert ? "The Abyss" : "Inbox",
    reason: coldSales || phraseMatchedColdSales ? "corroborated_unsolicited_b2b_sales"
      : confirmedBulkSpam ? "obvious_bulk_spam"
        : signals.obviousSpam && !signals.importantGuard ? "obvious_spam"
          : "insufficient_confidence",
    confidence: coldSales || phraseMatchedColdSales || confirmedBulkSpam || (signals.obviousSpam && !signals.importantGuard) ? "high" : "uncertain",
    signals,
  });
}
