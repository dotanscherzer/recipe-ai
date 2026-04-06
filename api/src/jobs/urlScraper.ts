import { Queue, Worker } from 'bullmq';
import { redis } from '../config/redis';
import * as cheerio from 'cheerio';
import { parseJsonFromAiText } from '../lib/parseAiJson';
import { assertSafeHttpsUrl } from '../lib/safeUrl';
import { invokeLLM } from '../lib/invokeLLM';
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
        assertSafeHttpsUrl(url);

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

        const responseText = await invokeLLM({
          system: TEXT_IMPORT_PROMPT,
          messages: [
            {
              role: 'user',
              content: `Extract the recipe from this webpage content:\n\n${text}`,
            },
          ],
          add_context_from_internet: true,
          internetContextLength: text.length,
        });

        const recipe = parseJsonFromAiText(responseText) as ScrapedRecipe;
        return { success: true, recipe };
      } catch (error) {
        console.error(`URL scraping failed for ${url}:`, error);
        throw error;
      }
    },
    {
      connection: redis,
      concurrency: 2,
    }
  );

  worker.on('completed', (job) => {
    console.log(`URL scrape completed for ${job.data.url}`);
  });

  worker.on('failed', (job, err) => {
    console.error(`URL scrape failed for ${job?.data.url}:`, err.message);
  });

  return worker;
}
