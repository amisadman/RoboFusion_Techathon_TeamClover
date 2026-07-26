const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const MODEL = "gemini-2.0-flash";

export interface GeminiParseResult {
  zone_id: string | null;
  hazard_type: string | null;
  estimated_severity: "SAFE" | "WARNING" | "CRITICAL";
  raw?: string;
}

const SYSTEM_PROMPT = `You are a hazard report parser for a Smart Campus Safety system with these zones:
- "iot_lab" → IoT Lab (soldering/wiring fire risk, gas, high occupancy)
- "server_room" → Server Room (electrical fire, AC coolant leak, low occupancy)
- "data_science_lab" → Data Science Lab (GPU overheating, moderate occupancy)

Known hazard types: "fire" (flames, smoke, burning), "gas" (fumes, smell, chemical), "water" (leak, flood, moisture).

Given a free-text incident report from a staff member, extract structured data.
Return ONLY valid JSON with no markdown formatting, no code fences, no extra text:
{"zone_id": "<zone_id or null>", "hazard_type": "<hazard_type or null>", "estimated_severity": "SAFE"|"WARNING"|"CRITICAL"}

Use null for anything you can't confidently determine. Never guess zone or hazard type.`;

export async function parseWithGemini(
  text: string,
  apiKey: string,
  signal?: AbortSignal
): Promise<GeminiParseResult> {
  const res = await fetch(`${GEMINI_API_BASE}/${MODEL}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: `${SYSTEM_PROMPT}\n\nReport: "${text}"` }],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 256,
      },
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${errBody}`);
  }

  const data = await res.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

  if (!rawText) {
    throw new Error("Gemini returned empty response");
  }

  try {
    const parsed = JSON.parse(rawText) as GeminiParseResult;
    return { ...parsed, raw: rawText };
  } catch {
    throw new Error(`Gemini returned invalid JSON: ${rawText}`);
  }
}
