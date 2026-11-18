// Copies the plan-file format document into the create-roadtogoals-plan skill, so the
// skill never works from an out-of-date copy. Run with `npm run sync-skill`.
import { copyFileSync } from 'node:fs';

copyFileSync(
  'docs/agent-plan-format.md',
  '.claude/skills/create-roadtogoals-plan/references/agent-plan-format.md',
);
console.log('Skill reference updated from docs/agent-plan-format.md');
