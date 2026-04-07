# Free LLM candidates (low traffic)

For current app needs (recipe generation quality first, <=100 generations/day), these are the selected free candidates:

1. `gemini_flash_lite` (Gemini free tier)
2. `groq_quality` (`llama-3.3-70b-versatile`)
3. `openrouter_free` (`openrouter/free`)

## Why these three

- Gemini Flash-Lite usually gives the best structured output for recipe JSON at low cost.
- Groq 70B is a strong quality fallback when Gemini is quota-limited.
- OpenRouter free router is a best-effort backup when both direct providers fail.

## Bake-off command

Run from `api/`:

`npm run llm:bakeoff`

The script runs 20 fixed prompts (Hebrew + English), scores practical recipe quality, relevance, JSON validity, and language quality, then prints a ranked winner.

## Runtime provider policy

- Primary provider is controlled by `LLM_DEFAULT_PROVIDER` (recommended: `gemini`).
- Automatic fallback order is controlled by `LLM_FALLBACK_PROVIDERS`.
- Current recommended order: `gemini -> openai -> groq -> openrouter`.
- On quota/rate-limit errors, the runtime tries the next provider once per chain.
- If all providers are exhausted, API returns `503` with a clear quota message.

## Weekly monitoring

- Runtime emits `[llm-health]` logs every 25 LLM outcomes with counters per provider:
  - `success`
  - `quota429`
  - `parseFail`
  - `lastError`
- Review these logs weekly to confirm:
  - primary provider still has low `quota429`
  - fallback usage is not increasing unexpectedly
  - `parseFail` stays near zero
- If fallback usage or parse failures climb, rerun bake-off and update defaults.
