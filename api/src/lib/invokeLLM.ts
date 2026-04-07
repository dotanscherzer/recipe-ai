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
  | { provider: 'gemini'; modelId: string }
  | { provider: 'groq'; modelId: string }
  | { provider: 'openrouter'; modelId: string };

type ProviderName = Resolved['provider'];

const providerHealth: Record<ProviderName, { success: number; quota429: number; parseFail: number; lastError: string | null }> = {
  openai: { success: 0, quota429: 0, parseFail: 0, lastError: null },
  gemini: { success: 0, quota429: 0, parseFail: 0, lastError: null },
  groq: { success: 0, quota429: 0, parseFail: 0, lastError: null },
  openrouter: { success: 0, quota429: 0, parseFail: 0, lastError: null },
};

function maybeLogProviderHealth() {
  const totals = Object.values(providerHealth).reduce(
    (acc, row) => acc + row.success + row.quota429 + row.parseFail,
    0,
  );
  if (totals > 0 && totals % 25 === 0) {
    console.info('[llm-health]', JSON.stringify(getLLMProviderHealth()));
  }
}

function markProviderSuccess(provider: ProviderName) {
  providerHealth[provider].success += 1;
  maybeLogProviderHealth();
}

function markProviderError(provider: ProviderName, err: unknown) {
  const message = String((err as { message?: unknown })?.message ?? 'unknown error');
  providerHealth[provider].lastError = message;
  if (isQuotaOrRateLimited(err)) {
    providerHealth[provider].quota429 += 1;
  } else {
    providerHealth[provider].parseFail += 1;
  }
  maybeLogProviderHealth();
}

export function getLLMProviderHealth() {
  return {
    timestamp: new Date().toISOString(),
    ...providerHealth,
  };
}

function parseProviderList(raw: string): ProviderName[] {
  const allowed: ProviderName[] = ['openai', 'gemini', 'groq', 'openrouter'];
  return raw
    .split(',')
    .map((v) => v.trim().toLowerCase())
    .filter((v): v is ProviderName => allowed.includes(v as ProviderName));
}

function getConfiguredProviderChain(opts: InvokeLLMOptions): ProviderName[] {
  if (opts.add_context_from_internet) {
    const chain = ['gemini', ...parseProviderList(env.LLM_FALLBACK_PROVIDERS)];
    return Array.from(new Set(chain)) as ProviderName[];
  }
  const chain = [env.LLM_DEFAULT_PROVIDER, ...parseProviderList(env.LLM_FALLBACK_PROVIDERS)];
  return Array.from(new Set(chain)) as ProviderName[];
}

function hasProviderCredentials(provider: ProviderName): boolean {
  if (provider === 'openai') return Boolean(env.OPENAI_API_KEY);
  if (provider === 'gemini') return Boolean(env.GOOGLE_AI_API_KEY);
  if (provider === 'groq') return Boolean(env.GROQ_API_KEY);
  return Boolean(env.OPENROUTER_API_KEY);
}

function providerFromExplicitModel(explicit: string): Resolved | null {
  const lower = explicit.toLowerCase();
  if (lower === 'gemini_3_flash') return { provider: 'gemini', modelId: env.GEMINI_MODEL_FLASH };
  if (lower === 'gemini_3_1_pro') return { provider: 'gemini', modelId: env.GEMINI_MODEL_PRO };
  if (lower === 'gemini_flash_lite') return { provider: 'gemini', modelId: env.GEMINI_MODEL_FLASH_LITE };
  if (lower === 'groq_quality') return { provider: 'groq', modelId: env.GROQ_MODEL_DEFAULT };
  if (lower === 'groq_fast') return { provider: 'groq', modelId: env.GROQ_MODEL_FAST };
  if (lower === 'openrouter_free') return { provider: 'openrouter', modelId: env.OPENROUTER_MODEL_DEFAULT };
  if (lower.startsWith('gemini')) return { provider: 'gemini', modelId: explicit };
  if (lower.startsWith('gpt-') || lower.startsWith('o1') || lower.startsWith('o3') || lower.startsWith('chatgpt-')) {
    return { provider: 'openai', modelId: explicit };
  }
  if (lower.startsWith('llama') || lower.startsWith('mixtral') || lower.startsWith('qwen')) {
    return { provider: 'groq', modelId: explicit };
  }
  if (explicit.includes('/')) {
    return { provider: 'openrouter', modelId: explicit };
  }
  return null;
}

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
    const resolved = providerFromExplicitModel(explicit);
    if (resolved) return resolved;
    throw new AppError(400, `Unsupported model: ${explicit}. Try automatic, gemini_flash_lite, groq_quality, groq_fast, or openrouter_free.`);
  }

  if (opts.add_context_from_internet) {
    const len = opts.internetContextLength ?? 0;
    return { provider: 'gemini', modelId: pickInternetGeminiModel(len) };
  }

  const preferred = getConfiguredProviderChain(opts).find(hasProviderCredentials);
  if (!preferred) {
    throw new AppError(503, 'AI service is not configured (no provider API keys found)');
  }
  if (preferred === 'openai') return { provider: 'openai', modelId: env.OPENAI_MODEL_DEFAULT };
  if (preferred === 'gemini') return { provider: 'gemini', modelId: env.GEMINI_MODEL_FLASH_LITE || env.GEMINI_MODEL_FLASH };
  if (preferred === 'groq') return { provider: 'groq', modelId: env.GROQ_MODEL_DEFAULT };
  return { provider: 'openrouter', modelId: env.OPENROUTER_MODEL_DEFAULT };
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

async function callGroq(resolved: { provider: 'groq'; modelId: string }, opts: InvokeLLMOptions): Promise<string> {
  if (!env.GROQ_API_KEY) {
    throw new AppError(503, 'AI service is not configured (GROQ_API_KEY missing)');
  }
  if (opts.vision) {
    throw new AppError(400, 'Vision is not supported for Groq path in this app');
  }
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: resolved.modelId,
      temperature: 0.4,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: opts.system },
        ...opts.messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    }),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new AppError(response.status, `Groq request failed: ${body || response.statusText}`);
  }
  const body = await response.json() as any;
  const text = body?.choices?.[0]?.message?.content;
  if (!text || typeof text !== 'string') throw new AppError(502, 'AI returned no text response');
  return text;
}

async function callOpenRouter(resolved: { provider: 'openrouter'; modelId: string }, opts: InvokeLLMOptions): Promise<string> {
  if (!env.OPENROUTER_API_KEY) {
    throw new AppError(503, 'AI service is not configured (OPENROUTER_API_KEY missing)');
  }
  if (opts.vision) {
    throw new AppError(400, 'Vision is not supported for OpenRouter path in this app');
  }
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      'HTTP-Referer': env.APP_URL,
      'X-Title': 'Recipe AI',
    },
    body: JSON.stringify({
      model: resolved.modelId,
      temperature: 0.4,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: opts.system },
        ...opts.messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    }),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new AppError(response.status, `OpenRouter request failed: ${body || response.statusText}`);
  }
  const body = await response.json() as any;
  const text = body?.choices?.[0]?.message?.content;
  if (!text || typeof text !== 'string') throw new AppError(502, 'AI returned no text response');
  return text;
}

async function callProvider(resolved: Resolved, opts: InvokeLLMOptions): Promise<string> {
  if (resolved.provider === 'openai') return callOpenAI(resolved, opts);
  if (resolved.provider === 'gemini') return callGemini(resolved, opts);
  if (resolved.provider === 'groq') return callGroq(resolved, opts);
  return callOpenRouter(resolved, opts);
}

/**
 * Central LLM entry: default `automatic` → OpenAI gpt-4o-mini;
 * `add_context_from_internet` → Gemini (flash/pro by env + content length).
 */
export async function invokeLLM(opts: InvokeLLMOptions): Promise<string> {
  const explicit = opts.model?.trim();
  if (explicit && explicit.toLowerCase() !== 'automatic') {
    const resolved = resolveLLMModel(opts);
    try {
      const text = await callProvider(resolved, opts);
      markProviderSuccess(resolved.provider);
      return text;
    } catch (err) {
      markProviderError(resolved.provider, err);
      if (isQuotaOrRateLimited(err)) {
        throw new AppError(503, 'AI service is temporarily unavailable (provider quota exceeded). Please try again later.');
      }
      throw err;
    }
  }

  const providerChain = getConfiguredProviderChain(opts).filter(hasProviderCredentials);
  if (providerChain.length === 0) {
    throw new AppError(503, 'AI service is not configured (no provider API keys found)');
  }

  const attempted: string[] = [];
  for (const provider of providerChain) {
    const resolved: Resolved =
      provider === 'openai'
        ? { provider, modelId: env.OPENAI_MODEL_DEFAULT }
        : provider === 'gemini'
          ? {
              provider,
              modelId: opts.add_context_from_internet
                ? pickInternetGeminiModel(opts.internetContextLength ?? 0)
                : (env.GEMINI_MODEL_FLASH_LITE || env.GEMINI_MODEL_FLASH),
            }
          : provider === 'groq'
            ? { provider, modelId: env.GROQ_MODEL_DEFAULT }
            : { provider, modelId: env.OPENROUTER_MODEL_DEFAULT };
    try {
      const text = await callProvider(resolved, opts);
      markProviderSuccess(provider);
      return text;
    } catch (err) {
      markProviderError(provider, err);
      attempted.push(`${provider}:${String((err as { message?: unknown })?.message ?? 'error')}`);
      if (!isQuotaOrRateLimited(err)) {
        throw err;
      }
    }
  }

  throw new AppError(
    503,
    `AI service is temporarily unavailable (provider quota exceeded). Tried: ${attempted.map((a) => a.split(':')[0]).join(', ')}.`
  );
}
