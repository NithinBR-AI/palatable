// Wrapper around AWS Bedrock (via the Mantle OpenAI-compatible gateway) used by the agent loop.
// Pattern adapted from a known-working personal project (Folkore), confirmed live 2026-10-06.
// No AWS SDK / Secrets Manager needed here - plain env var + fetch, matching Vercel's
// serverless model. No TLS override needed either (confirmed working with default cert
// validation when called from outside Intuit's network).

const MANTLE_BASE_URL = process.env.MANTLE_BASE_URL ?? "https://bedrock-mantle.us-east-1.api.aws/v1";
const MANTLE_MODEL = process.env.MANTLE_MODEL ?? "deepseek.v3.2";

function apiKey(): string {
  const key = process.env.MANTLE_API_KEY;
  if (!key) throw new Error("MANTLE_API_KEY is not set");
  return key;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema object
}

export interface ToolExecutor {
  [name: string]: (args: Record<string, unknown>) => Promise<unknown>;
}

export interface AgentConfig {
  systemPrompt: string;
  tools: ToolDefinition[];
  executors: ToolExecutor;
  maxIterations?: number;
}

export interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
}

interface OAIMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }>;
  tool_call_id?: string;
}

const MAX_RETRIES = 3;
const RETRY_BASE_MS = 500;

function isRetryable(err: unknown): boolean {
  if (err instanceof Error) {
    // Transient network errors
    if (/ECONNRESET|ETIMEDOUT|ENOTFOUND|socket hang up/i.test(err.message)) return true;
    // 429 rate limit or 5xx from Mantle
    if (/Mantle HTTP (429|5\d\d)/.test(err.message)) return true;
  }
  return false;
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === MAX_RETRIES || !isRetryable(err)) throw err;
      const delay = RETRY_BASE_MS * 2 ** attempt + Math.random() * 200;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error("withRetry: exhausted retries"); // unreachable
}

async function callLLM(messages: OAIMessage[], tools: ToolDefinition[]): Promise<OAIMessage> {
  const body: Record<string, unknown> = {
    model: MANTLE_MODEL,
    messages,
    temperature: 0.3,
  };

  if (tools.length > 0) {
    body.tools = tools.map((t) => ({
      type: "function",
      function: { name: t.name, description: t.description, parameters: t.parameters },
    }));
    body.tool_choice = "auto";
  }

  return withRetry(async () => {
    const res = await fetch(`${MANTLE_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey()}`,
        "openai-project": "default",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Mantle HTTP ${res.status}: ${text}`);
    }

    const json = (await res.json()) as { choices: Array<{ message: OAIMessage }> };
    return json.choices[0].message;
  });
}

/**
 * Agentic tool-calling loop: plan -> act (tool call) -> observe -> replan, repeat
 * until the model returns a plain-text final answer. Used by Negotiator/Advocate/Skeptic.
 *
 * `history` carries the full negotiation so far (taste anchors, prior proposals,
 * rejections, prior reasoning) - required per project decision 2026-10-06 so each
 * call reasons with real context, not a blind snapshot.
 */
export async function runAgentLoop(
  userMessage: string,
  config: AgentConfig,
  history: HistoryMessage[] = [],
): Promise<string> {
  const { systemPrompt, tools, executors, maxIterations = 8 } = config;

  const messages: OAIMessage[] = [
    { role: "system", content: systemPrompt },
    ...history.map((h) => ({ role: h.role, content: h.content })),
    { role: "user", content: userMessage },
  ];

  for (let i = 0; i < maxIterations; i++) {
    const response = await callLLM(messages, tools);
    messages.push(response);

    if (!response.tool_calls || response.tool_calls.length === 0) {
      return response.content ?? "";
    }

    // Execute independent tool calls in parallel — the model may batch multiple
    // calls in one response (e.g. several search_entity calls), no need to serialize.
    const toolResults = await Promise.all(
      response.tool_calls.map(async (tc) => {
        const fn = tc.function.name;
        const args = JSON.parse(tc.function.arguments) as Record<string, unknown>;
        let result: unknown;
        try {
          const executor = executors[fn];
          if (!executor) throw new Error(`Unknown tool: ${fn}`);
          result = await executor(args);
        } catch (err) {
          result = { error: (err as Error).message };
        }
        return { tool_call_id: tc.id, result };
      }),
    );

    for (const { tool_call_id, result } of toolResults) {
      messages.push({ role: "tool", tool_call_id, content: JSON.stringify(result) });
    }
  }

  throw new Error("Agent exceeded max iterations without a final answer");
}

/**
 * Plain completion, no tools, no Qloo context - used ONLY for the "LLM-only" side
 * of the side-by-side comparison feature (project decision 2026-10-06). Deliberately
 * has no access to Qloo data so it produces a genuine pattern-matching guess, proving
 * Qloo is load-bearing rather than decorative.
 */
export async function runPlainCompletion(
  systemPrompt: string,
  userMessage: string,
): Promise<string> {
  const response = await callLLM(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    [],
  );
  return response.content ?? "";
}

/**
 * Single-call structured completion — one LLM call, returns parsed JSON.
 * Used by Advocate and Skeptic: all data is pre-fetched in code and passed in
 * the prompt, so no tool-calling loop is needed. The LLM reasons once and returns
 * a structured verdict.
 *
 * The prompt must instruct the model to respond with valid JSON only.
 * Throws if the response cannot be parsed as JSON.
 */
export async function runStructuredCompletion<T>(
  systemPrompt: string,
  userMessage: string,
  history: HistoryMessage[] = [],
): Promise<T> {
  const response = await callLLM(
    [
      { role: "system", content: systemPrompt },
      ...history.map((h) => ({ role: h.role, content: h.content })),
      { role: "user", content: userMessage },
    ],
    [],
  );

  const raw = (response.content ?? "").trim();
  // Strip markdown code fences if present
  const json = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
  try {
    return JSON.parse(json) as T;
  } catch {
    throw new Error(`Structured completion returned non-JSON: ${raw.slice(0, 200)}`);
  }
}
