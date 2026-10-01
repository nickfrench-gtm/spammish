const labels = {
 unknown_sender:'No previous mail from this sender',unknown_domain:'No previous mail from this domain',
 no_prior_reply:'No prior reply to this sender',no_prior_outbound:'You have not emailed this sender',
 cold_opening:'Cold-personalization opening',business_pain:'Business pain-point pitch',value_proposition:'Commercial offer',
 commercial_category:'Commercial sales language',social_proof:'Sales results or social proof',meeting_cta:'Call, demo or purchase request',
 cold_subject:'Common outreach subject',calendar_link:'Calendar booking link',tracking_link:'Tracking or redirect structure',
 commercial_headers:'Bulk or commercial-mail headers',fake_reply_subject:'Reply-like subject without a matching relationship',
 unanswered_followup:'Unanswered solicitation follow-up',prior_sender_spam:'Prior Spam-labeled mail from this sender',
 prior_domain_spam:'Multiple Spam-labeled emails from this domain',explicit_sender_rejection:'You explicitly rejected this sender',
 cold_sales_sequence:'Combined relationship, offer and outreach pattern',automated_personalized_outreach:'Combined personalization, pain, CTA and bulk pattern',
 sequenced_followup:'Verified unanswered sales sequence',obvious_spam:'Obvious scam or spam language',warmup_marker:'Exact synthetic warmup marker',
 prior_outbound:'You previously emailed this sender',prior_reply:'You previously replied',existing_thread:'Existing conversation',
 contact:'Known contact',known_transactional_relationship:'Known commercial relationship',transactional_message:'Important transactional content',
};
export function explainDecision(decision = {}) {
 const explicit = decision.reason === 'explicit_rejection';
 return { title: explicit ? 'You chose Abyss' : `Outreach score: ${decision.score ?? 'unavailable'}`,
   summary: explicit ? 'An explicit rejection, not an automatic classification.' : 'A deterministic rule score, not a probability.',
   factors: (decision.evidence || []).map(({code,points}) => ({ label:labels[code] || code.replace(/_/g,' '),points })) };
}
