import { ApiError } from "@/lib/errors";

const ALLOWED_TONES = ["curious", "direct", "compliment"] as const;

type AllowedTone = (typeof ALLOWED_TONES)[number];

export type PersonalizedLine = {
  tone: AllowedTone;
  text: string;
};

type GenerateLinesInput = {
  contextSummary: string;
};

function getModelName() {
  return process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";
}

function getApiKey() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new ApiError(500, "GENERATION_FAILED", "Missing GEMINI_API_KEY environment variable.");
  }

  return key;
}

function normalizeLines(lines: unknown): PersonalizedLine[] {
  if (!Array.isArray(lines)) {
    return [];
  }

  const normalized = lines
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const tone = (entry as { tone?: string }).tone;
      const text = (entry as { text?: string }).text;

      if (!tone || !text) {
        return null;
      }

      if (!ALLOWED_TONES.includes(tone as AllowedTone)) {
        return null;
      }

      return {
        tone: tone as AllowedTone,
        text: text.trim(),
      };
    })
    .filter((entry): entry is PersonalizedLine => Boolean(entry?.text));

  if (normalized.length >= 3) {
    return normalized.slice(0, 3);
  }

  return [];
}

function fallbackLines(contextSummary: string): PersonalizedLine[] {
  return [
    {
      tone: "curious",
      text: `I noticed this context about your team: ${contextSummary.slice(0, 150)}. Curious what your top priority is this quarter?`,
    },
    {
      tone: "direct",
      text: "Looks like you are in a high-leverage role right now, so I wanted to reach out with a relevant idea based on your recent context.",
    },
    {
      tone: "compliment",
      text: "The public signals around your role and company show strong momentum, and I really liked the clarity of your positioning.",
    },
  ];
}

export async function generateLines(input: GenerateLinesInput): Promise<PersonalizedLine[]> {
  const apiKey = getApiKey();
  const model = getModelName();
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const prompt = [
    "You are an expert cold email copywriter.",
    "Given the following context, write exactly 3 opening lines for a cold email.",
    "Requirements:",
    "- 1 to 2 sentences each",
    "- reference specific context",
    "- do not mention sender product or pitch",
    "- natural, human tone",
    "Return only a JSON array with objects: { tone, text }.",
    "Allowed tones: curious, direct, compliment.",
    `Context: ${input.contextSummary}`,
  ].join("\n");

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          responseMimeType: "application/json",
        },
      }),
    });
  } catch {
    throw new ApiError(500, "GENERATION_FAILED", "Gemini API request failed.");
  }

  if (!response.ok) {
    throw new ApiError(500, "GENERATION_FAILED", "Gemini API returned an error.");
  }

  const body = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  const text = body.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("\n").trim();

  if (!text) {
    return fallbackLines(input.contextSummary);
  }

  try {
    const parsed = JSON.parse(text) as unknown;
    const normalized = normalizeLines(parsed);
    if (normalized.length === 3) {
      return normalized;
    }
  } catch {
    return fallbackLines(input.contextSummary);
  }

  return fallbackLines(input.contextSummary);
}
