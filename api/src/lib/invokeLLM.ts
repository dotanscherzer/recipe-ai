import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from '../config/env';
import { AppError } from '../middleware/errorHandler';

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

export type InvokeLLMOptions = {
  system: string;
  messages: ChatMessage[];
  /** Explicit model id or alias: `automatic`, `gemini_3_flash`, `gemini_3_1_pro`, or raw `gpt-*` / `gemini-*`. */
  model?: string;
  /** When true, route to Gemini (internet-capable path). */
  add_context_from_internet?: boolean;
  maxTokens?: number;
  /** Vision: image URL + text (OpenAI or Gemini depending on resolved model). */
  vision?: { imageUrl: string; text: string };
  /** For internet path: used with threshold to pick Flash vs Pro. */
  internetContextLength?: number;
};

type Resolved =
  | { provider: 'openai'; modelId: string }
  | { provider: 'gemini'; modelId: string };

function isQuotaOrRateLimited(err: unknown): boolean {
  const code = (err as { code?: unknown })?.code;
  const status = (err as { status?: unknown })?.status;
  const type = (err as { type?: unknown })?.type;
  const msg = String((err as { message?: unknown })?.message ?? '').toLowerCase();
  return (
    code === 'insufficient_quota' ||
    type === 'insufficient_quota' ||
    status === 429 ||
    msg.includes('quota') ||
    msg.includes('rate limit')
  );
}

function pickInternetGeminiModel(contextLength: number): string {
  if (env.LLM_INTERNET_PREFER === 'pro') {
    return env.GEMINI_MODEL_PRO;
  }
  if (contextLength >= env.LLM_INTERNET_USE_PRO_THRESHOLD) {
    return env.GEMINI_MODEL_PRO;
  }
  return env.GEMINI_MODEL_FLASH;
}

export function resolveLLMModel(opts: InvokeLLMOptions): Resolved {
  const explicit = opts.model?.trim();

  if (explicit && explicit.toLowerCase() !== 'automatic') {
    const lower = explicit.toLowerCase();
    if (lower === 'gemini_3_flash') {
      return { provider: 'gemini', modelId: env.GEMINI_MODEL_FLASH };
    }
    if (lower === 'gemini_3_1_pro') {
      return { provider: 'gemini', modelId: env.GEMINI_MODEL_PRO };
    }
    if (lower.startsWith('gemini')) {
      return { provider: 'gemini', modelId: explicit };
    }
    if (
      lower.startsWith('gpt-') ||
      lower.startsWith('o1') ||
      lower.startsWith('o3') ||
      lower.startsWith('chatgpt-')
    ) {
      return { provider: 'openai', modelId: explicit };
    }
    throw new AppError(400, `Unsupported model: ${explicit}`);
  }

  if (opts.add_context_from_internet) {
    const len = opts.internetContextLength ?? 0;
    return { provider: 'gemini', modelId: pickInternetGeminiModel(len) };
  }

  return { provider: 'openai', modelId: 'gpt-4o-mini' };
}

function requireOpenAI(): OpenAI {
  if (!env.OPENAI_API_KEY) {
    throw new AppError(503, 'AI service is not configured (OPENAI_API_KEY missing)');
  }
  return new OpenAI({ apiKey: env.OPENAI_API_KEY });
}

function requireGemini(): GoogleGenerativeAI {
  if (!env.GOOGLE_AI_API_KEY) {
    throw new AppError(503, 'AI service is not configured (GOOGLE_AI_API_KEY missing for Gemini)');
  }
  return new GoogleGenerativeAI(env.GOOGLE_AI_API_KEY);
}

async function fetchImageAsBase64(imageUrl: string): Promise<{ mimeType: string; data: string }> {
  const res = await fetch(imageUrl);
  if (!res.ok) {
    throw new AppError(400, `Failed to fetch image: ${res.status}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const mimeType = res.headers.get('content-type')?.split(';')[0]?.trim() || 'image/jpeg';
  return { mimeType, data: buf.toString('base64') };
}

async function callOpenAI(resolved: { provider: 'openai'; modelId: string }, opts: InvokeLLMOptions): Promise<string> {
  const openai = requireOpenAI();
  const maxTokens = opts.maxTokens ?? 4096;

  if (opts.vision) {
    const res = await openai.chat.completions.create({
      model: resolved.modelId,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: opts.system },
        {
          role: 'user',
          content: [
            { type: 'text', text: opts.vision.text },
            { type: 'image_url', image_url: { url: opts.vision.imageUrl } },
          ],
        },
      ],
    });
    const text = res.choices[0]?.message?.content;
    if (!text) throw new AppError(502, 'AI returned no text response');
    return text;
  }

  if (opts.messages.length === 0) {
    throw new AppError(500, 'invokeLLM: no messages');
  }

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: opts.system },
    ...opts.messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  ];

  const res = await openai.chat.completions.create({
    model: resolved.modelId,
    max_tokens: maxTokens,
    messages,
  });
  const text = res.choices[0]?.message?.content;
  if (!text) throw new AppError(502, 'AI returned no text response');
  return text;
}

async function callGemini(resolved: { provider: 'gemini'; modelId: string }, opts: InvokeLLMOptions): Promise<string> {
  const genAI = requireGemini();
  const maxTokens = opts.maxTokens ?? 8192;

  const model = genAI.getGenerativeModel({
    model: resolved.modelId,
    systemInstruction: opts.system,
    generationConfig: {
      maxOutputTokens: maxTokens,
    },
  });

  if (opts.vision) {
    const { mimeType, data } = await fetchImageAsBase64(opts.vision.imageUrl);
    const result = await model.generateContent([
      { inlineData: { mimeType, data } },
      { text: opts.vision.text },
    ]);
    const text = result.response.text();
    if (!text?.trim()) throw new AppError(502, 'AI returned no text response');
    return text;
  }

  if (opts.messages.length === 0) {
    throw new AppError(500, 'invokeLLM: no messages');
  }

  if (opts.messages.length === 1) {
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: opts.messages[0].content }] }],
    });
    const text = result.response.text();
    if (!text?.trim()) throw new AppError(502, 'AI returned no text response');
    return text;
  }

  const history = opts.messages.slice(0, -1).map((m) => ({
    role: m.role === 'assistant' ? ('model' as const) : ('user' as const),
    parts: [{ text: m.content }],
  }));

  const last = opts.messages[opts.messages.length - 1];
  if (last.role !== 'user') {
    throw new AppError(500, 'Last chat message must be from user');
  }

  const chat = model.startChat({ history });
  const result = await chat.sendMessage(last.content);
  const text = result.response.text();
  if (!text?.trim()) throw new AppError(502, 'AI returned no text response');
  return text;
}

/**
 * Central LLM entry: default `automatic` → OpenAI gpt-4o-mini;
 * `add_context_from_internet` → Gemini (flash/pro by env + content length).
 */
export async function invokeLLM(opts: InvokeLLMOptions): Promise<string> {
  const resolved = resolveLLMModel(opts);
  if (resolved.provider === 'openai') {
    try {
      return await callOpenAI(resolved, opts);
    } catch (err) {
      // Auto-fallback when OpenAI quota is exhausted/rate-limited and Gemini is configured.
      if (env.GOOGLE_AI_API_KEY && isQuotaOrRateLimited(err)) {
        try {
          return callGemini({ provider: 'gemini', modelId: env.GEMINI_MODEL_FLASH }, opts);
        } catch (geminiErr) {
          if (isQuotaOrRateLimited(geminiErr)) {
            throw new AppError(503, 'AI service is temporarily unavailable (provider quota exceeded). Please try again later.');
          }
          throw geminiErr;
        }
      }
      if (isQuotaOrRateLimited(err)) {
        throw new AppError(503, 'AI service is temporarily unavailable (provider quota exceeded). Please try again later.');
      }
      throw err;
    }
  }
  try {
    return await callGemini(resolved, opts);
  } catch (err) {
    if (isQuotaOrRateLimited(err)) {
      throw new AppError(503, 'AI service is temporarily unavailable (provider quota exceeded). Please try again later.');
    }
    throw err;
  }
}
