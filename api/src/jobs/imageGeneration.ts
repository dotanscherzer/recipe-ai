import { Queue, Worker } from 'bullmq';
import { redis } from '../config/redis';
import { prisma } from '../config/db';
import { s3 } from '../config/s3';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { env } from '../config/env';
import { v4 as uuid } from 'uuid';

interface ImageJobData {
  recipeId: string;
  prompt: string;
}

export const imageGenerationQueue = new Queue<ImageJobData>('image-generation', {
  connection: redis,
});

export function startImageGenerationWorker() {
  const worker = new Worker<ImageJobData>(
    'image-generation',
    async (job) => {
      const { recipeId, prompt } = job.data;

      try {
        // Use Pollinations.ai for free AI image generation
        const imagePrompt = encodeURIComponent(
          `Professional food photography of ${prompt}, appetizing, well-lit, shallow depth of field, on a beautiful plate`
        );
        const pollinationsUrl = `https://image.pollinations.ai/prompt/${imagePrompt}?width=800&height=600&nologo=true`;

        // Fetch the generated image
        const response = await fetch(pollinationsUrl);
        if (!response.ok) {
          throw new Error(`Pollinations API returned ${response.status}`);
        }

        const imageBuffer = Buffer.from(await response.arrayBuffer());
        const key = `recipes/${uuid()}.jpg`;

        // Upload to S3/MinIO
        await s3.send(
          new PutObjectCommand({
            Bucket: env.S3_BUCKET,
            Key: key,
            Body: imageBuffer,
            ContentType: 'image/jpeg',
          })
        );

        // Update recipe with image URL
        const imageUrl = `${env.S3_ENDPOINT}/${env.S3_BUCKET}/${key}`;
        await prisma.recipe.update({
          where: { id: recipeId },
          data: { imageUrl },
        });

        return { success: true, imageUrl };
      } catch (error) {
        console.error(`Image generation failed for recipe ${recipeId}:`, error);
        throw error;
      }
    },
    {
      connection: redis,
      concurrency: 2,
    }
  );

  worker.on('completed', (job) => {
    console.log(`Image generated for recipe ${job.data.recipeId}`);
  });

  worker.on('failed', (job, err) => {
    console.error(`Image generation failed for recipe ${job?.data.recipeId}:`, err.message);
  });

  return worker;
}
