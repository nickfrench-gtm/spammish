import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewPresentation } from './review-presentation.mjs';
test('review describes score stages, protections and current labels without invented probabilities',()=>{
 const decision={score:81,reason:'corroborated_unwanted_outreach',evidence:[{code:'commercial_category',points:12}]};
 assert.equal(reviewPresentation({decision,inAbyss:true,inInbox:false,stage:'full'}).destination,'The Abyss');
 assert.equal(reviewPresentation({decision,inInbox:true,stage:'screening'}).scoreLabel,'Screening score 81');
 assert.equal(reviewPresentation({decision:{...decision,reason:'existing_relationship'},inInbox:true}).kind,'protected');
 assert.equal(reviewPresentation({decision:{score:null,reason:'rescued_sender'},inInbox:true}).scoreLabel,'Score not assigned');
 assert.equal(reviewPresentation({decision,inInbox:true,wasMoved:true}).destination,'Back in Inbox');
 assert.equal(reviewPresentation({decision,inInbox:false,inAbyss:false}).destination,'Elsewhere in Gmail');
 assert.equal(reviewPresentation({decision:{reason:'explicit_rejection',score:null},inAbyss:true}).scoreLabel,'Your Abyss correction');
});
