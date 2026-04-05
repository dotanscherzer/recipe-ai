import { Response } from 'express';
import { env } from '../../config/env';
import { prisma } from '../../config/db';
import { AuthRequest } from '../../middleware/auth';
import { AppError } from '../../middleware/errorHandler';
import { parseJsonFromAiText } from '../../lib/parseAiJson';
import { assertSafeHttpsUrl, fetchTextFromSafeUrl } from '../../lib/safeUrl';
import {
  RECIPE_GENERATION_PROMPT,
  RECIPE_MODIFICATION_PROMPT,
  TEXT_IMPORT_PROMPT,
  IMAGE_IMPORT_PROMPT,
  CHAT_PROMPT,
} from './ai.prompts';

function requireAnthropicKey(): string {
  if (!env.ANTHROPIC_API_KEY) {
    throw new AppError(503, 'AI service is not configured');
  }
  return env.ANTHROPIC_API_KEY;
}

async function getAnthropicClient() {
  const Anthropic = (await import('@anthropic-ai/sdk')).default;
  return new Anthropic({ apiKey: requireAnthropicKey() });
}

function parseJsonResponse(text: string) {
  try {
    return parseJsonFromAiText(text);
  } catch {
    throw new AppError(500, 'Failed to parse AI response as JSON');
  }
}

function getFirstTextFromContent(content: { type: string; text?: string }[]): string {
  for (const block of content) {
    if (block.type === 'text' && typeof block.text === 'string') {
      return block.text;
    }
  }
  return '';
}

export async function generate(req: AuthRequest, res: Response) {
  const { prompt, cuisine, difficulty, servings, dietaryRestrictions } = req.body;

  let userMessage = prompt;
  if (cuisine) userMessage += `\nCuisine: ${cuisine}`;
  if (difficulty) userMessage += `\nDifficulty: ${difficulty}`;
  if (servings) userMessage += `\nServings: ${servings}`;
  if (dietaryRestrictions?.length) {
    userMessage += `\nDietary restrictions: ${dietaryRestrictions.join(', ')}`;
  }

  const anthropic = await getAnthropicClient();
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    system: RECIPE_GENERATION_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });

  const text = getFirstTextFromContent(message.content as { type: string; text?: string }[]);
  if (!text) {
    throw new AppError(502, 'AI returned no text response');
  }
  const recipe = parseJsonResponse(text);

  res.json({ recipe });
}

export async function modify(req: AuthRequest, res: Response) {
  const { recipeId, modification } = req.body;

  const recipe = await prisma.recipe.findUnique({ where: { id: recipeId } });
  if (!recipe) {
    throw new AppError(404, 'Recipe not found');
  }

  if (recipe.createdById !== req.userId && req.userRole !== 'ADMIN') {
    throw new AppError(403, 'You do not have permission to modify this recipe');
  }

  const anthropic = await getAnthropicClient();
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    system: RECIPE_MODIFICATION_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Original recipe:\n${JSON.stringify(recipe, null, 2)}\n\nRequested modification: ${modification}`,
      },
    ],
  });

  const text = getFirstTextFromContent(message.content as { type: string; text?: string }[]);
  if (!text) {
    throw new AppError(502, 'AI returned no text response');
  }
  const modifiedRecipe = parseJsonResponse(text);

  res.json({ recipe: modifiedRecipe });
}

export async function importText(req: AuthRequest, res: Response) {
  const { text: recipeText } = req.body;

  const anthropic = await getAnthropicClient();
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    system: TEXT_IMPORT_PROMPT,
    messages: [{ role: 'user', content: recipeText }],
  });

  const text = getFirstTextFromContent(message.content as { type: string; text?: string }[]);
  if (!text) {
    throw new AppError(502, 'AI returned no text response');
  }
  const recipe = parseJsonResponse(text);

  res.json({ recipe });
}

export async function importUrl(req: AuthRequest, res: Response) {
  const { url } = req.body;

  const html = await fetchTextFromSafeUrl(url);
  const cheerio = await import('cheerio');
  const $ = cheerio.load(html);
  $('script, style, nav, footer, header').remove();
  const pageText = $('body').text().replace(/\s+/g, ' ').trim();

  if (!pageText) {
    throw new AppError(400, 'No text content found at the provided URL');
  }

  const anthropic = await getAnthropicClient();
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    system: TEXT_IMPORT_PROMPT,
    messages: [{ role: 'user', content: pageText }],
  });

  const text = getFirstTextFromContent(message.content as { type: string; text?: string }[]);
  if (!text) {
    throw new AppError(502, 'AI returned no text response');
  }
  const recipe = parseJsonResponse(text);

  res.json({ recipe });
}

export async function importImage(req: AuthRequest, res: Response) {
  const { imageUrl } = req.body;

  assertSafeHttpsUrl(imageUrl);

  const anthropic = await getAnthropicClient();
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    system: IMAGE_IMPORT_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'url',
              url: imageUrl,
            },
          },
          {
            type: 'text',
            text: 'Extract the recipe from this image.',
          },
        ],
      },
    ],
  });

  const text = getFirstTextFromContent(message.content as { type: string; text?: string }[]);
  if (!text) {
    throw new AppError(502, 'AI returned no text response');
  }
  const recipe = parseJsonResponse(text);

  res.json({ recipe });
}

export async function chat(req: AuthRequest, res: Response) {
  const { recipeId, message: userMessage, history } = req.body;

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

  const anthropic = await getAnthropicClient();
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    system: systemPrompt,
    messages,
  });

  const text = getFirstTextFromContent(response.content as { type: string; text?: string }[]);
  if (!text) {
    throw new AppError(502, 'AI returned no text response');
  }

  res.json({ message: text });
}
