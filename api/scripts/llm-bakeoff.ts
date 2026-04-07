import { RECIPE_GENERATION_PROMPT } from '../src/modules/ai/ai.prompts';
import { parseJsonFromAiText } from '../src/lib/parseAiJson';

type Candidate = {
  id: string;
  model: string;
  providerHint: string;
};

type PromptCase = {
  id: string;
  prompt: string;
  expectsHebrew: boolean;
};

type ParsedRecipe = {
  title?: unknown;
  description?: unknown;
  ingredients?: unknown;
  steps?: unknown;
  tags?: unknown;
  prepTime?: unknown;
  cookTime?: unknown;
  servings?: unknown;
  difficulty?: unknown;
  cuisine?: unknown;
};

const CANDIDATES: Candidate[] = [
  { id: 'gemini_flash_lite', model: 'gemini_flash_lite', providerHint: 'Gemini free-tier' },
  { id: 'groq_quality', model: 'groq_quality', providerHint: 'Groq free-tier' },
  { id: 'openrouter_free', model: 'openrouter_free', providerHint: 'OpenRouter free router' },
];

const PROMPTS: PromptCase[] = [
  { id: 'en-01', prompt: 'Quick chicken garlic dinner under 30 minutes for 2 people.', expectsHebrew: false },
  { id: 'en-02', prompt: 'Vegetarian high-protein lunch with chickpeas and spinach.', expectsHebrew: false },
  { id: 'en-03', prompt: 'One-pot family pasta with no cream and mild spices.', expectsHebrew: false },
  { id: 'en-04', prompt: 'Low-carb salmon dinner with lemon and herbs.', expectsHebrew: false },
  { id: 'en-05', prompt: 'Budget meal using rice, eggs, and frozen vegetables.', expectsHebrew: false },
  { id: 'en-06', prompt: 'Kid-friendly soup for winter with carrots and potatoes.', expectsHebrew: false },
  { id: 'en-07', prompt: 'Gluten-free breakfast bake with oats and banana.', expectsHebrew: false },
  { id: 'en-08', prompt: 'Middle Eastern vegan dinner with tahini sauce.', expectsHebrew: false },
  { id: 'en-09', prompt: 'Post-workout meal prep chicken and quinoa, 4 portions.', expectsHebrew: false },
  { id: 'en-10', prompt: 'Elegant but easy date-night mushroom dish.', expectsHebrew: false },
  { id: 'he-01', prompt: 'תן לי מתכון מהיר לארוחת ערב עם עוף ושום בפחות מ-30 דקות.', expectsHebrew: true },
  { id: 'he-02', prompt: 'אני צריך מתכון טבעוני עשיר בחלבון עם עדשים ותרד.', expectsHebrew: true },
  { id: 'he-03', prompt: 'מתכון ידידותי לילדים עם ירקות מוסתרים ורוטב עדין.', expectsHebrew: true },
  { id: 'he-04', prompt: 'יש לי אורז, ביצים ובצל. תציע מתכון חסכוני וטעים.', expectsHebrew: true },
  { id: 'he-05', prompt: 'מתכון ללא גלוטן לארוחת בוקר עם שיבולת שועל ובננה.', expectsHebrew: true },
  { id: 'he-06', prompt: 'תבנה מתכון לסיר אחד לכל המשפחה בלי שמנת.', expectsHebrew: true },
  { id: 'he-07', prompt: 'מחפש מתכון דל פחמימה עם סלמון ולימון.', expectsHebrew: true },
  { id: 'he-08', prompt: 'תן מתכון ים תיכוני טבעוני עם טחינה וזמן הכנה קצר.', expectsHebrew: true },
  { id: 'he-09', prompt: 'אני רוצה הכנה מראש ל-4 מנות עם עוף וקינואה אחרי אימון.', expectsHebrew: true },
  { id: 'he-10', prompt: 'תציע מנה קצת חגיגית אבל פשוטה עם פטריות לערב זוגי.', expectsHebrew: true },
];

function hasHebrew(text: string): boolean {
  return /[\u0590-\u05FF]/.test(text);
}

function scoreJsonValidity(parsed: ParsedRecipe): number {
  const required = ['title', 'description', 'ingredients', 'steps', 'tags', 'prepTime', 'cookTime', 'servings', 'difficulty', 'cuisine'] as const;
  let present = 0;
  for (const key of required) {
    if (parsed[key] !== undefined && parsed[key] !== null) present += 1;
  }
  return present / required.length;
}

function scorePracticality(parsed: ParsedRecipe): number {
  const ingredients = Array.isArray(parsed.ingredients) ? parsed.ingredients : [];
  const steps = Array.isArray(parsed.steps) ? parsed.steps : [];
  const servings = typeof parsed.servings === 'number' && parsed.servings > 0 ? 1 : 0;
  const difficulty = typeof parsed.difficulty === 'string' ? 1 : 0;
  const shape = ingredients.length >= 4 && steps.length >= 3 ? 1 : 0;
  return (servings + difficulty + shape) / 3;
}

function scoreRelevance(prompt: string, parsed: ParsedRecipe): number {
  const text = `${String(parsed.title ?? '')} ${String(parsed.description ?? '')} ${Array.isArray(parsed.steps) ? parsed.steps.join(' ') : ''}`.toLowerCase();
  const keyWords = prompt
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4)
    .slice(0, 6);
  if (keyWords.length === 0) return 0.5;
  const hits = keyWords.filter((k) => text.includes(k)).length;
  return hits / keyWords.length;
}

function scoreLanguageQuality(parsed: ParsedRecipe, expectsHebrew: boolean): number {
  const blob = `${String(parsed.title ?? '')} ${String(parsed.description ?? '')} ${Array.isArray(parsed.steps) ? parsed.steps.join(' ') : ''}`;
  if (expectsHebrew) return hasHebrew(blob) ? 1 : 0;
  return hasHebrew(blob) ? 0.3 : 1;
}

function weightedScore(practicality: number, relevance: number, jsonValidity: number, languageQuality: number): number {
  return practicality * 0.5 + relevance * 0.25 + jsonValidity * 0.15 + languageQuality * 0.1;
}

async function runCandidate(candidate: Candidate) {
  const rows: Array<{ caseId: string; score: number; status: 'ok' | 'fail'; error?: string }> = [];
  const { invokeLLM } = await import('../src/lib/invokeLLM');
  for (const c of PROMPTS) {
    try {
      const text = await invokeLLM({
        system: RECIPE_GENERATION_PROMPT,
        messages: [{ role: 'user', content: c.prompt }],
        model: candidate.model,
      });
      const parsed = parseJsonFromAiText(text) as ParsedRecipe;
      const jsonValidity = scoreJsonValidity(parsed);
      const practicality = scorePracticality(parsed);
      const relevance = scoreRelevance(c.prompt, parsed);
      const languageQuality = scoreLanguageQuality(parsed, c.expectsHebrew);
      const score = weightedScore(practicality, relevance, jsonValidity, languageQuality);
      rows.push({ caseId: c.id, score, status: 'ok' });
      console.log(`[${candidate.id}] ${c.id}: ${score.toFixed(3)}`);
    } catch (err) {
      const error = String((err as { message?: unknown })?.message ?? err);
      rows.push({ caseId: c.id, score: 0, status: 'fail', error });
      console.log(`[${candidate.id}] ${c.id}: fail - ${error}`);
    }
  }
  const ok = rows.filter((r) => r.status === 'ok');
  const avg = ok.length ? ok.reduce((acc, r) => acc + r.score, 0) / ok.length : 0;
  return {
    ...candidate,
    total: rows.length,
    ok: ok.length,
    failed: rows.length - ok.length,
    avgScore: avg,
    rows,
  };
}

async function main() {
  // Allow running this script without full API env loaded.
  process.env.DATABASE_URL ??= 'postgresql://local/local@localhost:5432/local';
  process.env.JWT_ACCESS_SECRET ??= 'dev-access';
  process.env.JWT_REFRESH_SECRET ??= 'dev-refresh';
  process.env.S3_ENDPOINT ??= 'http://localhost:9000';
  process.env.S3_ACCESS_KEY ??= 'dev';
  process.env.S3_SECRET_KEY ??= 'dev';

  console.log(`Running bake-off: ${PROMPTS.length} prompts x ${CANDIDATES.length} candidates`);
  const results = [];
  for (const candidate of CANDIDATES) {
    const result = await runCandidate(candidate);
    results.push(result);
  }
  results.sort((a, b) => b.avgScore - a.avgScore);
  console.log('\n=== Bake-off results ===');
  for (const r of results) {
    console.log(`${r.id} (${r.providerHint}) => avg=${r.avgScore.toFixed(3)}, ok=${r.ok}/${r.total}, failed=${r.failed}`);
  }
  if (results[0]) {
    console.log(`\nWinner: ${results[0].id}`);
  }
}

void main();
