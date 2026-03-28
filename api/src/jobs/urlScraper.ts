import { Queue, Worker } from 'bullmq';
import { redis } from '../config/redis';
import { env } from '../config/env';
import * as cheerio from 'cheerio';
import { TEXT_IMPORT_PROMPT } from '../modules/ai/ai.prompts';

interface UrlScraperJobData {
  url: string;
  userId: string;
}

interface ScrapedRecipe {
  title: string;
  description?: string;
  ingredients: { name: string; amount: string; unit: string }[];
  steps: string[];
  tags: string[];
  prepTime?: number;
  cookTime?: number;
  servings?: number;
  difficulty?: string;
  cuisine?: string;
}

export const urlScraperQueue = new Queue<UrlScraperJobData>('url-scraper', {
  connection: redis,
});

export function startUrlScraperWorker() {
  const worker = new Worker<UrlScraperJobData>(
    'url-scraper',
    async (job) => {
      const { url } = job.data;

      try {
        // Fetch and parse HTML
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; RecipeAI/1.0)',
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch URL: ${response.status}`);
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        // Remove non-content elements
        $('script, style, nav, footer, header, aside, .ads, .comments').remove();

        // Extract main content
        const text = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 8000);

        if (!env.ANTHROPIC_API_KEY) {
          throw new Error('ANTHROPIC_API_KEY is not configured');
        }

        // Send to Claude for parsing
        const Anthropic = (await import('@anthropic-ai/sdk')).default;
        const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

        const message = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4000,
          system: TEXT_IMPORT_PROMPT,
          messages: [
            {
              role: 'user',
              content: `Extract the recipe from this webpage content:\n\n${text}`,
            },
          ],
        });

        const responseText =
          message.content[0].type === 'text' ? message.content[0].text : '';

        const recipe: ScrapedRecipe = JSON.parse(responseText);
        return { success: true, recipe };
      } catch (error) {
        console.error(`URL scraping failed for ${url}:`, error);
        throw error;
      }
    },
    {
      connection: redis,
      concurrency: 3,
    }
  );

  worker.on('completed', (job) => {
    console.log(`URL scraped successfully: ${job.data.url}`);
  });

  worker.on('failed', (job, err) => {
    console.error(`URL scraping failed for ${job?.data.url}:`, err.message);
  });

  return worker;
}
