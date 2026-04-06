/** Map AI JSON to POST /recipes body (Zod expects string amount/unit, enum difficulty). */
export function normalizeAiRecipeForCreate(r: Record<string, unknown>) {
  const rawIngr = Array.isArray(r.ingredients) ? r.ingredients : [];
  const ingredients = rawIngr
    .map((ing: unknown) => {
      const o = ing && typeof ing === 'object' ? (ing as Record<string, unknown>) : {};
      return {
        name: String(o.name ?? '').trim(),
        amount: String(o.amount ?? '').trim(),
        unit: String(o.unit ?? '').trim(),
      };
    })
    .filter((ing) => ing.name.length > 0);

  const steps = (Array.isArray(r.steps) ? r.steps : [])
    .map((s) => String(s).trim())
    .filter(Boolean);

  const tags = (Array.isArray(r.tags) ? r.tags : []).map((t) => String(t)).filter(Boolean);

  const d = r.difficulty;
  const difficulty =
    d === 'EASY' || d === 'MEDIUM' || d === 'HARD' ? d : undefined;

  const title = String(r.title ?? '').trim().slice(0, 200) || 'Recipe';

  return {
    title,
    description: r.description != null ? String(r.description) : undefined,
    ingredients,
    steps,
    tags,
    prepTime: typeof r.prepTime === 'number' && r.prepTime > 0 ? r.prepTime : undefined,
    cookTime: typeof r.cookTime === 'number' && r.cookTime > 0 ? r.cookTime : undefined,
    servings: typeof r.servings === 'number' && r.servings > 0 ? r.servings : undefined,
    difficulty,
    cuisine: r.cuisine != null ? String(r.cuisine) : undefined,
    imageUrl:
      typeof r.imageUrl === 'string' && /^https?:\/\//i.test(r.imageUrl) ? r.imageUrl : undefined,
  };
}
