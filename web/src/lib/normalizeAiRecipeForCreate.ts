/** Map AI JSON to POST /recipes body (Zod expects string amount/unit, enum difficulty). */
export function normalizeAiRecipeForCreate(r: Record<string, unknown>) {
  const rawIngr = Array.isArray(r.ingredients) ? r.ingredients : [];
  const ingredients = rawIngr
    .map((ing: unknown) => {
      const o = ing && typeof ing === 'object' ? (ing as Record<string, unknown>) : {};
      let amount = String(o.amount ?? '').trim();
      let unit = String(o.unit ?? '').trim();
      if (!amount) amount = '1';
      if (!unit) unit = 'portion';
      return {
        name: String(o.name ?? '').trim(),
        amount,
        unit,
      };
    })
    .filter((ing) => ing.name.length > 0);

  const steps = (Array.isArray(r.steps) ? r.steps : [])
    .map((s) => String(s).trim())
    .filter(Boolean);

  const tags = (Array.isArray(r.tags) ? r.tags : []).map((t) => String(t)).filter(Boolean);

  const d = r.difficulty;
  let difficulty: 'EASY' | 'MEDIUM' | 'HARD' | undefined;
  if (typeof d === 'string') {
    const u = d.trim().toUpperCase();
    if (u === 'EASY' || u === 'MEDIUM' || u === 'HARD') difficulty = u;
  } else if (d === 'EASY' || d === 'MEDIUM' || d === 'HARD') {
    difficulty = d;
  }

  const title = String(r.title ?? '').trim().slice(0, 200) || 'Recipe';

  const asNumber = (n: unknown): number | undefined => {
    if (typeof n === 'number' && Number.isFinite(n)) return n;
    if (typeof n === 'string' && n.trim() !== '') {
      const v = Number(n);
      if (Number.isFinite(v)) return v;
    }
    return undefined;
  };
  const posInt = (n: unknown) => {
    const x = asNumber(n);
    if (x === undefined) return undefined;
    const v = Math.max(1, Math.round(x));
    return v > 0 ? v : undefined;
  };

  return {
    title,
    description: r.description != null ? String(r.description) : undefined,
    ingredients,
    steps,
    tags,
    prepTime: posInt(r.prepTime),
    cookTime: posInt(r.cookTime),
    servings: posInt(r.servings),
    difficulty,
    cuisine: r.cuisine != null ? String(r.cuisine) : undefined,
    imageUrl:
      typeof r.imageUrl === 'string' && /^https?:\/\//i.test(r.imageUrl) ? r.imageUrl : undefined,
  };
}
