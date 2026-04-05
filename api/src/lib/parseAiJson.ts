/**
 * Parse JSON from model output that may wrap content in markdown fences.
 */
export function parseJsonFromAiText(text: string): unknown {
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text];
  const jsonStr = (jsonMatch[1] || text).trim();
  try {
    return JSON.parse(jsonStr);
  } catch {
    throw new Error('Failed to parse AI response as JSON');
  }
}
