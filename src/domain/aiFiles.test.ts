/* The files AI assistants read (public/ai/) must keep matching what the app accepts. */
import skill from '../../public/ai/skill-v1.md?raw';
import latest from '../../public/ai/skill.md?raw';
import schemaText from '../../public/ai/plan-schema-v1.json?raw';
import exampleText from '../../public/ai/example-plan-v1.json?raw';
import robots from '../../public/robots.txt?raw';
import { AI_SKILL_HEADING } from './aiPrompt';
import { PHASE_COLORS, RESOURCE_TYPES } from './constants';
import { metrics } from './metrics';
import { readPlanText } from './planText';
import { previewImport } from './schema';
import { MAX_TAGS, MAX_TAG_LENGTH } from './share';

const example = JSON.parse(exampleText);
const schema = JSON.parse(schemaText);

describe('public/ai', () => {
  it('has an example that imports with no repairs', () => {
    const r = previewImport(example);
    expect(r.ok && r.preview.notes).toEqual([]);
    expect(r.ok && r.preview.resources).toBe(example.goals[0].resources.length);
    // Its own time budget: five days at one hour, no more than 80% of it.
    expect(r.ok && metrics(r.preview.data.goals[0]!.resources).total).toBeLessThanOrEqual(240);
  });

  it('loses nothing from the example on import', () => {
    const r = previewImport(example);
    const goal = r.ok ? r.preview.data.goals[0]! : null;
    expect(goal).toMatchObject(example.goals[0]);
  });

  it('starts the skill with the heading the app looks for', () => {
    expect(skill.startsWith(`${AI_SKILL_HEADING}\n`)).toBe(true);
  });

  it('inlines the same example in the skill', () => {
    expect(skill).toContain(`\`\`\`json\n${exampleText}\`\`\``);
  });

  it('would import the skill’s example if an AI copied it into a reply', () => {
    const block = /## Example[\s\S]*?```json\n([\s\S]*?)```/.exec(skill)![1]!;
    expect(readPlanText(block).ok).toBe(true);
  });

  it('names every resource type and phase colour in the skill', () => {
    for (const word of [...RESOURCE_TYPES, ...PHASE_COLORS]) expect(skill).toContain(`\`${word}\``);
  });

  it('asks for the closing line that names the button in the app', () => {
    expect(skill).toContain(
      '"Click Copy on the box above, then paste it into Road to Goals → Paste plan."',
    );
  });

  it('keeps skill.md a copy of the latest version (run `npm run sync-skill` if this fails)', () => {
    expect(latest).toBe(skill);
  });

  it('has a JSON Schema with the app’s types, colours and limits', () => {
    const { plan, phase, resource } = schema.$defs;
    expect(resource.properties.type.enum).toEqual(RESOURCE_TYPES);
    expect(phase.properties.color.enum).toEqual(PHASE_COLORS);
    expect(plan.properties.sharing.properties.tags).toMatchObject({
      maxItems: MAX_TAGS,
      items: { maxLength: MAX_TAG_LENGTH },
    });
    // The limits are the ones the importer cuts text and numbers to.
    const long = 'x'.repeat(2000);
    const r = previewImport({
      goals: [
        {
          name: long,
          description: long,
          hoursPerDay: 999,
          phases: [{ id: 'p', name: long, description: long }],
          resources: [{ title: 'a', minutes: 999999 }],
        },
      ],
    });
    const goal = r.ok ? r.preview.data.goals[0]! : null;
    expect(goal!.name).toHaveLength(plan.properties.name.maxLength);
    expect(goal!.description).toHaveLength(plan.properties.description.maxLength);
    expect(goal!.hoursPerDay).toBe(plan.properties.hoursPerDay.maximum);
    expect(goal!.phases[0]!.name).toHaveLength(phase.properties.name.maxLength);
    expect(goal!.phases[0]!.description).toHaveLength(phase.properties.description.maxLength);
    expect(goal!.resources[0]!.minutes).toBe(resource.properties.minutes.maximum);
  });

  it('describes every key the example uses', () => {
    const missing = (value: object, props: object) =>
      Object.keys(value).filter((k) => !(k in props));
    const { plan, phase, resource } = schema.$defs;
    expect(missing(example, schema.properties)).toEqual([]);
    for (const g of example.goals) {
      expect(missing(g, plan.properties)).toEqual([]);
      for (const p of g.phases) expect(missing(p, phase.properties)).toEqual([]);
      for (const r of g.resources) expect(missing(r, resource.properties)).toEqual([]);
    }
  });

  it('lets AI fetchers read /ai/', () => {
    for (const agent of [
      'ChatGPT-User',
      'OAI-SearchBot',
      'Claude-User',
      'Claude-SearchBot',
      'Google-Extended',
      'PerplexityBot',
    ])
      expect(robots).toContain(`User-agent: ${agent}\n`);
    expect(robots).toContain('Allow: /ai/');
    expect(robots).not.toMatch(/^Disallow:\s*\S/m);
  });
});
