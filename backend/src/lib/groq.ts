import { env } from "../config/env.js";

const GROQ = "https://api.groq.com/openai/v1/chat/completions";

export async function groqChat(opts: {
  model: string;
  messages: Array<{ role: "system" | "user"; content: string }>;
  jsonMode?: boolean;
  timeoutMs?: number;
  extra?: Record<string, unknown>;
  retries?: number;
}): Promise<string | null> {
  const key = env.GROQ_API_KEY?.trim();
  if (!key) return null;
  const retries = opts.retries ?? 2;

  const body: Record<string, unknown> = {
    model: opts.model,
    temperature: 0.7,
    messages: opts.messages,
    ...opts.extra,
  };
  if (opts.jsonMode) {
    body.response_format = { type: "json_object" };
  }

  const res = await fetch(GROQ, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(opts.timeoutMs ?? 40_000),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.warn("[groq]", opts.model, res.status, errText.slice(0, 400));
    if (res.status === 429 && retries > 0) {
      await new Promise((r) => setTimeout(r, 7000));
      return groqChat({ ...opts, retries: retries - 1 });
    }
    if (opts.jsonMode && (res.status === 400 || res.status === 422)) {
      return groqChat({ ...opts, jsonMode: false, retries });
    }
    return null;
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content ?? null;
}

export function extractJson(raw: string): unknown {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = (fenced?.[1] ?? trimmed).trim();
  try {
    return JSON.parse(body);
  } catch {
    const start = body.indexOf("{");
    const end = body.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(body.slice(start, end + 1));
    }
    throw new Error("AI did not return JSON");
  }
}
