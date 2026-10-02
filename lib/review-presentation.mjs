import { explainDecision } from './explain.mjs';
const protections = new Set(['incomplete_message','transactional_message','rescued_sender','existing_relationship','known_commercial_relationship','sender_in_contacts','existing_thread','subscription_context']);
const protectionText = {rescued_sender:'Your Rescue correction protects this sender.',existing_relationship:'Prior outbound or reply history protects this relationship.',transactional_message:'Important transactional or account content stays protected.',incomplete_message:'Content could not be inspected completely; left alone.',subscription_context:'Subscription context keeps this mail protected.',existing_thread:'Existing conversation is protected.',known_commercial_relationship:'Known commercial relationship is protected.',sender_in_contacts:'Contact evidence protects this sender.'};
export function reviewPresentation(row) {
 const decision=row.decision||{};
 const factors=explainDecision(decision).factors;
 const protectedMail=protections.has(decision.reason);
 const kind=row.inAbyss?'abyss':!row.inInbox?'elsewhere':row.wasMoved?'rescued':protectedMail?'protected':'kept';
 const destination={abyss:'The Abyss',elsewhere:'Elsewhere in Gmail',rescued:'Back in Inbox',protected:'Protected · Inbox',kept:'Kept in Inbox'}[kind];
 const scoreLabel=decision.reason==='explicit_rejection'?'Your Abyss correction':Number.isFinite(decision.score)?`${row.stage==='screening'?'Screening score':'Spammish Score'} ${decision.score}`:'Score not assigned';
 const evidence=protectionText[decision.reason]||factors.filter(f=>f.points>0).slice(0,2).map(f=>f.label).join(' · ')||'Not enough supported evidence to move this mail.';
 return {kind,destination,scoreLabel,evidence};
}
