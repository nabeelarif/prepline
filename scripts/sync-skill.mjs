// Copies the files that must stay identical to a source file, so neither copy goes out of
// date. Run with `npm run sync-skill`; tests fail when they differ.
//  - The plan-file format document, into the create-roadtogoals-plan skill.
//  - The newest hosted skill, to the unversioned /ai/skill.md. Point it at the new file when
//    a skill-v2.md is added. Published versioned files are never changed in a breaking way.
import { copyFileSync } from 'node:fs';

copyFileSync(
  'docs/agent-plan-format.md',
  '.claude/skills/create-roadtogoals-plan/references/agent-plan-format.md',
);
copyFileSync('public/ai/skill-v1.md', 'public/ai/skill.md');
console.log('Skill reference and public/ai/skill.md updated');
