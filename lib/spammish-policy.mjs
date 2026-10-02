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

export const COLD_SCORE_THRESHOLD = 70;
export const POLICY_VERSION = 2;
export const senderAddress = (value) => text(value).match(/<([^<>\s]+@[^<>\s]+)>/)?.[1]
  || text(value).match(/[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+/)?.[0] || '';
export const isWbxWarmupTell = (subject) => /\bwbx\s+[a-z]{3}\s*$/i.test(String(subject || '').trim());
const OPENING = /\b(?:came across|stumbled across|found you on linkedin|saw (?:your|you on)|noticed (?:your|you|that your)|been following your|impressed by what you|love what you|congrats on|congratulations on)\b/i;
const PAIN = /\b(?:struggling with|challenges with|looking to (?:improve|scale|grow)|trying to (?:grow|scale)|how (?:are you handling|do you currently)|curious (?:how|whether)|top of mind|on your radar)\b/i;
const VALUE = /\b(?:we help|we offer|we provide|we work with|we specialize|our team helps?|our team speciali[sz]es?|our (?:platform|software|solution|agency)|done.for.you|fully managed|save time|reduce costs|cut costs|increase revenue|generate (?:qualified )?(?:pipeline|leads)|reduce manual work|sales enablement|appointment setters|nearshore|offshore)\b/i;
const CATEGORY = /\b(?:pipeline|qualified leads|lead generation|demand gen(?:eration)?|prospecting|outbound|customer acquisition|sales (?:team|process|motion)|revops|gtm|sdrs?|bdrs?|seo|recruiting|staffing|software development|engineering talent|ai automation|revenue growth)\b/i;
const CTA = /\b(?:(?:quick|brief|short) (?:call|chat|conversation)|(?:15|20|30)[- ](?:minute|mins?)|(?:hop|jump) on (?:a )?(?:quick )?call|(?:open|interested) (?:to|in) (?:a )?(?:call|chat|conversation|demo|connect(?:ing)?|learn(?:ing)? more)|would you (?:be open|have time)|have (?:a few|15) minutes|worth (?:a )?(?:quick )?(?:chat|conversation|exploring)|(?:book|schedule|grab|find|pick) (?:a |some )?(?:time|call|demo)|here(?:'s| is) my calendar|calendar link|would you be against|should i send|can i send over|free (?:audit|assessment))\b/i;
const PROOF = /\b(?:companies like|similar (?:companies|teams|businesses)|recently helped|one of our clients|our customers|case stud(?:y|ies)|within (?:30|60|90) days|\d+% (?:increase|growth)|\d+x roi|\d+ meetings|pipeline generated)\b/i;
const FOLLOWUP = /\b(?:following up|circle back|circling back|checking in|touching base|bumping (?:this|my)|my (?:last|previous) (?:email|note|message)|close the loop|stop reaching out|haven't heard back|final attempt|last attempt|buried in your inbox)\b/i;
const PROMOTION = /\b(?:exclusive offer|limited[- ]time offer|special offer|(?:get|save) \d+% (?:off|discount)|buy now|shop now|claim (?:your|this) (?:offer|discount)|investment opportunity|weight loss offer)\b/i;
const TRANSACTIONAL = /\b(?:password reset|(?:2fa|otp|verification|security) code|invoice|receipt|order confirmation|shipping|delivery|bank alert|security alert|account (?:recovery|notification|suspended|locked)|support ticket|calendar invitation|legal notice|failed payment|unauthorized (?:charge|transaction)|credentials? (?:exposed|compromised))\b/i;
const SUBSCRIBED = /\b(?:newsletter|weekly digest|monthly digest|you (?:are|'re) receiving this because you subscribed|you signed up for|manage your subscription)\b/i;

/** An explainable rule score, never a calibrated probability. Unknown context adds zero. */
export function classifyForAbyss(message = {}, relationship = message.relationship || {}) {
  const headers = Object.fromEntries(Object.entries(message.headers || {}).map(([key, value]) => [key.toLowerCase(), String(value || '')]));
  const subject = text(message.subject || headers.subject), body = text(message.body);
  const haystack = `${subject} ${body}`;
  const links = message.links || {};
  const realThreadMarker = Boolean(headers['in-reply-to'] || headers.references);
  const importantGuard = IMPORTANT_GUARD.test(haystack) || TRANSACTIONAL.test(haystack);
  const signals = {
    obviousSpam: SPAM_LANGUAGE.test(haystack), warmup: isWbxWarmupTell(subject),
    listUnsubscribe: Boolean(headers['list-unsubscribe'] || headers['list-unsubscribe-post'] || headers['list-id']),
    bulkPrecedence: BULK_HEADER.test(headers.precedence || ''),
    salesOffer: SALES_OFFER.test(haystack) || VALUE.test(haystack) || PROMOTION.test(haystack),
    salesCategory: SALES_CATEGORY.test(haystack) || CATEGORY.test(haystack) || PROMOTION.test(haystack),
    salesCallToAction: SALES_CTA.test(haystack) || CTA.test(haystack) || /\b(?:buy now|shop now|claim (?:your|this) (?:offer|discount))\b/i.test(body),
    coldOpening: OPENING.test(body), businessPain: PAIN.test(body), socialProof: PROOF.test(body),
    coldSubjectPhrase: COLD_EMAIL_SUBJECT_PATTERNS.some(p => p.test(subject)),
    coldBodyPhraseCount: COLD_EMAIL_BODY_PATTERNS.filter(p => p.test(body)).length,
    followup: FOLLOWUP.test(haystack), realThreadMarker, replyLikeSubject: REAL_THREAD.test(subject), importantGuard,
    calendarLink: links.calendar === true || /https?:\/\/(?:www\.)?(?:calendly\.com|cal\.com)\//i.test(body),
    trackingLink: links.tracking === true,
    unknownSender: relationship.senderSeen === false,
    unknownDomain: relationship.domainSeen === false,
    noPriorOutbound: relationship.outboundToSender === false,
    noPriorReply: relationship.repliedToSender === false,
    senderSpam: relationship.senderSpam === true,
    senderRejected: relationship.senderRejected === true,
    domainSpam: relationship.domainSpam === true,
    sender: senderAddress(message.from || headers.from) || null,
  };
  // Reply headers alone cannot prove the user participated. Only bypass that
  // protection for a verified unanswered sales sequence with complete evidence.
  const unansweredSequence = signals.followup && relationship.priorSolicitation === true
    && relationship.outboundToSender === false && relationship.threadParticipated === false;
  const protectedReason = message.incomplete ? 'incomplete_message'
    : importantGuard ? 'transactional_message'
    : relationship.rescued === true ? 'rescued_sender'
    : relationship.outboundToSender === true || relationship.repliedToSender === true ? 'existing_relationship'
    : relationship.outboundToDomain === true || relationship.knownTransactionalDomain === true ? 'known_commercial_relationship'
    : relationship.inContacts === true ? 'sender_in_contacts'
    : relationship.threadParticipated === true || (realThreadMarker && !unansweredSequence) ? 'existing_thread'
    : SUBSCRIBED.test(subject) || /you (?:are|'re) receiving this because you subscribed|you signed up for|manage your subscription/i.test(body) ? 'subscription_context' : null;
  const evidence = [];
  const add = (code, family, points, present) => { if (present) evidence.push({ code, family, points }); };
  add('unknown_sender','relationship',10,signals.unknownSender);
  add('unknown_domain','relationship',8,signals.unknownDomain);
  // No outbound implies no reply: count that observation once.
  add('no_prior_reply','relationship',5,signals.noPriorReply && !signals.noPriorOutbound);
  add('no_prior_outbound','relationship',8,signals.noPriorOutbound);
  add('cold_opening','personalization',8,signals.coldOpening);
  add('business_pain','pain',7,signals.businessPain);
  add('value_proposition','commercial',8,signals.salesOffer);
  add('commercial_category','commercial',15,signals.salesCategory);
  add('social_proof','proof',6,signals.socialProof);
  add('meeting_cta','cta',15,signals.salesCallToAction);
  add('cold_subject','subject',8,signals.coldSubjectPhrase);
  add('calendar_link','structure',8,signals.calendarLink);
  add('tracking_link','structure',4,signals.trackingLink);
  add('commercial_headers','bulk',5,signals.listUnsubscribe || signals.bulkPrecedence);
  // No header is not proof of a fake reply; mailbox evidence must corroborate it.
  add('fake_reply_subject','subject',30,signals.replyLikeSubject && !realThreadMarker && signals.unknownSender && signals.noPriorOutbound);
  add('unanswered_followup','sequence',15,unansweredSequence);
  add('prior_sender_spam','reputation',50,signals.senderSpam);
  add('explicit_sender_rejection','reputation',50,signals.senderRejected);
  add('prior_domain_spam','reputation',30,signals.domainSpam);
  const commercial = signals.salesOffer && signals.salesCategory;
  const coldSequence = commercial && signals.salesCallToAction && (signals.unknownSender || signals.coldSubjectPhrase || signals.coldOpening);
  add('cold_sales_sequence','compound',25,coldSequence);
  // Receiving repeated mail is not a reciprocal relationship. Require verified
  // absence of outbound plus commercial, CTA, bulk and booking/tracking evidence.
  const bulkInvitation = signals.noPriorOutbound && signals.salesCategory && signals.salesCallToAction
    && (signals.listUnsubscribe || signals.bulkPrecedence) && (signals.calendarLink || signals.trackingLink);
  // Alternative to the existing offer-pattern bonus: never stack both bonuses.
  add('unreciprocated_bulk_invitation','compound',25,bulkInvitation && !coldSequence);
  add('automated_personalized_outreach','compound',35,signals.unknownDomain && signals.coldOpening && signals.businessPain && signals.salesCallToAction && (signals.trackingLink || signals.listUnsubscribe));
  add('sequenced_followup','compound',40,unansweredSequence && commercial);
  add('obvious_spam','spam',100,signals.obviousSpam);
  add('warmup_marker','spam',100,signals.warmup);
  add('prior_outbound','protection',-60,relationship.outboundToSender === true);
  add('prior_reply','protection',-50,relationship.repliedToSender === true && relationship.outboundToSender !== true);
  add('existing_thread','protection',-60,relationship.threadParticipated === true || realThreadMarker && !unansweredSequence);
  add('contact','protection',-40,relationship.inContacts === true);
  add('known_transactional_relationship','protection',-30,relationship.knownTransactionalDomain === true || relationship.outboundToDomain === true);
  add('transactional_message','protection',-80,importantGuard);
  const rawScore = evidence.reduce((sum, item) => sum + item.points, 0);
  const score = Math.max(0, Math.min(100, rawScore));
  const families = new Set(evidence.filter(item => item.points > 0 && item.family !== 'compound').map(item => item.family));
  const sufficient = (families.size >= 3 && (signals.salesCallToAction || signals.senderSpam || signals.senderRejected || signals.domainSpam))
    || signals.obviousSpam || signals.warmup || ((signals.senderSpam || signals.senderRejected) && commercial && signals.salesCallToAction);
  const divert = !protectedReason && sufficient && score >= COLD_SCORE_THRESHOLD;
  return Object.freeze({ divert, destination: divert ? 'The Abyss' : 'Inbox', score, rawScore,
    threshold: COLD_SCORE_THRESHOLD, evidence, signals,
    reason: protectedReason || (divert ? signals.warmup ? 'synthetic_warmup' : signals.obviousSpam ? 'obvious_spam' : 'corroborated_unwanted_outreach' : 'insufficient_confidence'),
    confidence: divert ? 'high' : 'uncertain' });
}
