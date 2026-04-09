import { Response } from 'express';
import { prisma } from '../../config/db';
import { AuthRequest } from '../../middleware/auth';
import { AppError } from '../../middleware/errorHandler';
import { parseJsonFromAiText } from '../../lib/parseAiJson';
import { assertSafeHttpsUrl, fetchTextFromSafeUrl } from '../../lib/safeUrl';
import { invokeLLM } from '../../lib/invokeLLM';
import type { RecipeAiLocale } from './ai.prompts';
import {
  recipeGenerationSystem,
  recipeModificationSystem,
  textImportSystem,
  urlImportSystem,
  imageImportSystem,
  chatSystem,
} from './ai.prompts';
import { buildImportUrlUserContent, fetchSocialEmbedForUrl } from '../../lib/socialUrlEnrichment';

function parseLocale(raw: unknown): RecipeAiLocale {
  return raw === 'he' ? 'he' : 'en';
}

function parseJsonResponse(text: string) {
  try {
    return parseJsonFromAiText(text);
  } catch {
    throw new AppError(500, 'Failed to parse AI response as JSON');
  }
}

export async function generate(req: AuthRequest, res: Response) {
  const { prompt, cuisine, difficulty, servings, dietaryRestrictions, model } = req.body;
  const locale = parseLocale(req.body.locale);

  let userMessage = prompt;
  if (cuisine) userMessage += `\nCuisine: ${cuisine}`;
  if (difficulty) userMessage += `\nDifficulty: ${difficulty}`;
  if (servings) userMessage += `\nServings: ${servings}`;
  if (dietaryRestrictions?.length) {
    userMessage += `\nDietary restrictions: ${dietaryRestrictions.join(', ')}`;
  }

  const text = await invokeLLM({
    system: recipeGenerationSystem(locale),
    messages: [{ role: 'user', content: userMessage }],
    model,
  });

  const recipe = parseJsonResponse(text);

  res.json({ recipe });
}

export async function modify(req: AuthRequest, res: Response) {
  const { recipeId, modification, model } = req.body;
  const locale = parseLocale(req.body.locale);

  const recipe = await prisma.recipe.findUnique({ where: { id: recipeId } });
  if (!recipe) {
    throw new AppError(404, 'Recipe not found');
  }

  if (recipe.createdById !== req.userId && req.userRole !== 'ADMIN') {
    throw new AppError(403, 'You do not have permission to modify this recipe');
  }

  const text = await invokeLLM({
    system: recipeModificationSystem(locale),
    messages: [
      {
        role: 'user',
        content: `Original recipe:\n${JSON.stringify(recipe, null, 2)}\n\nRequested modification: ${modification}`,
      },
    ],
    model,
  });

  const modifiedRecipe = parseJsonResponse(text);

  res.json({ recipe: modifiedRecipe });
}

export async function importText(req: AuthRequest, res: Response) {
  const { text: recipeText, model } = req.body;
  const locale = parseLocale(req.body.locale);

  const text = await invokeLLM({
    system: textImportSystem(locale),
    messages: [{ role: 'user', content: recipeText }],
    model,
  });

  const recipe = parseJsonResponse(text);

  res.json({ recipe });
}

export async function importUrl(req: AuthRequest, res: Response) {
  const { url: normalizedUrl, model } = req.body;
  const locale = parseLocale(req.body.locale);

  assertSafeHttpsUrl(normalizedUrl);

  let html = '';
  try {
    html = await fetchTextFromSafeUrl(normalizedUrl);
  } catch {
    html = '';
  }

  const cheerio = await import('cheerio');
  const $ = cheerio.load(html || '<html><body></body></html>');
  $('script, style, nav, footer, header').remove();
  const pageText = $('body').text().replace(/\s+/g, ' ').trim();

  const embed = await fetchSocialEmbedForUrl(normalizedUrl);
  const userContent = buildImportUrlUserContent(normalizedUrl, pageText, embed);
  const contextLen = Math.max(500, userContent.length);

  const text = await invokeLLM({
    system: urlImportSystem(locale),
    messages: [{ role: 'user', content: userContent }],
    model,
    add_context_from_internet: true,
    internetContextLength: contextLen,
  });

  const recipe = parseJsonResponse(text);

  res.json({ recipe });
}

export async function importImage(req: AuthRequest, res: Response) {
  const { imageUrl, model } = req.body;
  const locale = parseLocale(req.body.locale);

  assertSafeHttpsUrl(imageUrl);

  const text = await invokeLLM({
    system: imageImportSystem(locale),
    messages: [],
    model,
    vision: {
      imageUrl,
      text: 'Extract the recipe from this image.',
    },
  });

  const recipe = parseJsonResponse(text);

  res.json({ recipe });
}

export async function chat(req: AuthRequest, res: Response) {
  const { recipeId, message: userMessage, history, model } = req.body;
  const locale = parseLocale(req.body.locale);

  let systemPrompt = chatSystem(locale);

  if (recipeId) {
    const recipe = await prisma.recipe.findUnique({ where: { id: recipeId } });
    if (recipe) {
      const canUseContext =
        recipe.isPublic ||
        recipe.createdById === req.userId ||
        req.userRole === 'ADMIN';
      if (canUseContext) {
        systemPrompt += `\n\nCurrent recipe context:\n${JSON.stringify(recipe, null, 2)}`;
      }
    }
  }

  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  if (history?.length) {
    messages.push(...history);
  }
  messages.push({ role: 'user', content: userMessage });

  const text = await invokeLLM({
    system: systemPrompt,
    messages,
    model,
  });

  res.json({ message: text });
}
