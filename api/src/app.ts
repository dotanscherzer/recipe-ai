import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';

// Routes
import authRoutes from './modules/auth/auth.routes';
import recipesRoutes from './modules/recipes/recipes.routes';
import savedRecipesRoutes from './modules/saved-recipes/saved-recipes.routes';
import categoriesRoutes from './modules/categories/categories.routes';
import aiRoutes from './modules/ai/ai.routes';
import uploadsRoutes from './modules/uploads/uploads.routes';

// Jobs
import { startImageGenerationWorker } from './jobs/imageGeneration';
import { startUrlScraperWorker } from './jobs/urlScraper';

const app = express();

// Trust proxy (Traefik reverse proxy sends X-Forwarded-For)
app.set('trust proxy', 1);
// Avoid 304 + empty body on JSON fetches (breaks clients that call response.json()).
app.set('etag', false);

// Middleware
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(helmet());
app.use(express.json({ limit: '10mb' }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 200 }));

app.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  next();
});

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/auth', authRoutes);
app.use('/recipes', recipesRoutes);
app.use('/saved-recipes', savedRecipesRoutes);
app.use('/categories', categoriesRoutes);
app.use('/ai', aiRoutes);
app.use('/uploads', uploadsRoutes);

// Error handler
app.use(errorHandler);

// Start server
const port = parseInt(env.PORT);
app.listen(port, () => {
  console.log(`Recipe AI API running on port ${port} [${env.NODE_ENV}]`);

  // Start background workers
  if (env.NODE_ENV !== 'test') {
    startImageGenerationWorker();
    startUrlScraperWorker();
    console.log('Background workers started');
  }
});

export default app;
