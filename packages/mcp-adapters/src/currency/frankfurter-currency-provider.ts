import type { MCPProvider, MCPRequest, MCPResponse } from "../index";

export interface CurrencyEvidence {
  source: "Frankfurter";
  base: string;
  quote: string;
  rate: number;
  date: string;
  sourceUrl: string;
}

export class FrankfurterCurrencyProvider implements MCPProvider {
  readonly id = "frankfurter-currency";
  readonly capabilities = ["currency"] as const;

  async invoke(request: MCPRequest): Promise<MCPResponse<CurrencyEvidence>> {
    if (request.capability !== "currency" || request.operation !== "rate") {
      return {
        ok: false,
        error: `Unsupported currency request: ${request.capability}/${request.operation}`,
      };
    }
    const base = normalizeCode(request.input.base);
    const quote = normalizeCode(request.input.quote);
    if (!base || !quote) {
      return {
        ok: false,
        error:
          "Frankfurter requires verified three-letter base and quote currency codes.",
      };
    }

    const url = new URL("https://api.frankfurter.dev/v1/latest");
    url.searchParams.set("base", base);
    url.searchParams.set("symbols", quote);
    const response = await fetch(url, {
      headers: { "user-agent": "NEXUS/1.0 currency provider" },
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) {
      return {
        ok: false,
        error: `Frankfurter request failed with HTTP ${response.status}.`,
      };
    }
    const payload = (await response.json()) as {
      date?: unknown;
      rates?: Record<string, unknown>;
    };
    const rate = payload.rates?.[quote];
    if (typeof payload.date !== "string" || typeof rate !== "number") {
      return { ok: false, error: `No ${base}/${quote} rate was returned.` };
    }
    return {
      ok: true,
      data: {
        source: "Frankfurter",
        base,
        quote,
        rate,
        date: payload.date,
        sourceUrl: url.toString(),
      },
      metadata: { protocol: "HTTPS", operation: "latest-rate" },
    };
  }
}

function normalizeCode(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const code = value.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(code) ? code : undefined;
}
