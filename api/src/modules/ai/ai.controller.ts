import { Response } from 'express';
import { prisma } from '../../config/db';
import { AuthRequest } from '../../middleware/auth';
import { AppError } from '../../middleware/errorHandler';
import { parseJsonFromAiText } from '../../lib/parseAiJson';
import { assertSafeHttpsUrl, fetchTextFromSafeUrl } from '../../lib/safeUrl';
import { invokeLLM } from '../../lib/invokeLLM';
import {
  RECIPE_GENERATION_PROMPT,
  RECIPE_MODIFICATION_PROMPT,
  TEXT_IMPORT_PROMPT,
  IMAGE_IMPORT_PROMPT,
  CHAT_PROMPT,
} from './ai.prompts';

function parseJsonResponse(text: string) {
  try {
    return parseJsonFromAiText(text);
  } catch {
    throw new AppError(500, 'Failed to parse AI response as JSON');
  }
}

export async function generate(req: AuthRequest, res: Response) {
  const { prompt, cuisine, difficulty, servings, dietaryRestrictions, model } = req.body;

  let userMessage = prompt;
  if (cuisine) userMessage += `\nCuisine: ${cuisine}`;
  if (difficulty) userMessage += `\nDifficulty: ${difficulty}`;
  if (servings) userMessage += `\nServings: ${servings}`;
  if (dietaryRestrictions?.length) {
    userMessage += `\nDietary restrictions: ${dietaryRestrictions.join(', ')}`;
  }

  const text = await invokeLLM({
    system: RECIPE_GENERATION_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
    model,
  });

  const recipe = parseJsonResponse(text);

  res.json({ recipe });
}

export async function modify(req: AuthRequest, res: Response) {
  const { recipeId, modification, model } = req.body;

  const recipe = await prisma.recipe.findUnique({ where: { id: recipeId } });
  if (!recipe) {
    throw new AppError(404, 'Recipe not found');
  }

  if (recipe.createdById !== req.userId && req.userRole !== 'ADMIN') {
    throw new AppError(403, 'You do not have permission to modify this recipe');
  }

  const text = await invokeLLM({
    system: RECIPE_MODIFICATION_PROMPT,
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

  const text = await invokeLLM({
    system: TEXT_IMPORT_PROMPT,
    messages: [{ role: 'user', content: recipeText }],
    model,
  });

  const recipe = parseJsonResponse(text);

  res.json({ recipe });
}

export async function importUrl(req: AuthRequest, res: Response) {
  const { url, model } = req.body;

  const html = await fetchTextFromSafeUrl(url);
  const cheerio = await import('cheerio');
  const $ = cheerio.load(html);
  $('script, style, nav, footer, header').remove();
  const pageText = $('body').text().replace(/\s+/g, ' ').trim();

  if (!pageText) {
    throw new AppError(400, 'No text content found at the provided URL');
  }

  const text = await invokeLLM({
    system: TEXT_IMPORT_PROMPT,
    messages: [{ role: 'user', content: pageText }],
    model,
    add_context_from_internet: true,
    internetContextLength: pageText.length,
  });

  const recipe = parseJsonResponse(text);

  res.json({ recipe });
}

export async function importImage(req: AuthRequest, res: Response) {
  const { imageUrl, model } = req.body;

  assertSafeHttpsUrl(imageUrl);

  const text = await invokeLLM({
    system: IMAGE_IMPORT_PROMPT,
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

  let systemPrompt = CHAT_PROMPT;

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
