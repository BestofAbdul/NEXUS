import type { MCPProvider, MCPRequest, MCPResponse } from "../index";

export interface CountryResolution {
  source: "REST Countries";
  query: string;
  countryName: string;
  countryCode: string;
  currencyCode: string;
  matchedBy: "COUNTRY_NAME" | "LOCATION_GEOCODER";
  sourceUrl: string;
}

interface RestCountry {
  name?: {
    common?: unknown;
    official?: unknown;
  };
  cca2?: unknown;
  cca3?: unknown;
  altSpellings?: unknown;
  currencies?: Record<string, unknown>;
}

const countryDatasetUrl =
  "https://raw.githubusercontent.com/mledoze/countries/master/dist/countries-unescaped.json";
const restCountriesBaseUrl = "https://restcountries.com/v3.1";
let countryDatasetPromise: Promise<RestCountry[]> | undefined;

export class RestCountriesProvider implements MCPProvider {
  readonly id = "rest-countries";
  readonly capabilities = ["countries"] as const;

  async invoke(request: MCPRequest): Promise<MCPResponse<CountryResolution>> {
    if (request.capability !== "countries" || request.operation !== "resolve") {
      return {
        ok: false,
        error: `Unsupported countries request: ${request.capability}/${request.operation}`,
      };
    }
    const query =
      typeof request.input.name === "string"
        ? request.input.name.trim()
        : "";
    if (!query) {
      return {
        ok: false,
        error: "Country resolution requires a non-empty location name.",
      };
    }

    try {
      const direct = await resolveCountryName(query);
      if (direct) return success(query, direct, "COUNTRY_NAME");

      const geocodedCountryCode = await resolveLocationCountryCode(query);
      if (geocodedCountryCode) {
        const byCode = await resolveCountryCode(geocodedCountryCode);
        if (byCode) return success(query, byCode, "LOCATION_GEOCODER");
      }

      return {
        ok: false,
        error: `No country or currency could be resolved from "${query}".`,
        metadata: {
          serviceState: "NOT_FOUND",
          reason: "COUNTRY_NOT_FOUND",
        },
      };
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Country resolution provider failed.",
        metadata: { serviceState: "PROVIDER_ERROR" },
      };
    }
  }
}

async function resolveCountryName(
  query: string,
): Promise<{ country: RestCountry; sourceUrl: string } | undefined> {
  const apiUrl = new URL(
    `${restCountriesBaseUrl}/name/${encodeURIComponent(query)}`,
  );
  apiUrl.searchParams.set("fullText", "true");
  apiUrl.searchParams.set(
    "fields",
    "name,cca2,cca3,altSpellings,currencies",
  );
  const direct = await fetchRestCountries(apiUrl);
  if (direct.length > 0) {
    return { country: direct[0]!, sourceUrl: apiUrl.toString() };
  }

  const countries = await loadCountries();
  const normalized = query.toLowerCase();
  const country =
    countries.find(
      (item) =>
        item.name?.common?.toString().toLowerCase() === normalized ||
        item.name?.official?.toString().toLowerCase() === normalized ||
        item.cca2?.toString().toLowerCase() === normalized ||
        item.cca3?.toString().toLowerCase() === normalized ||
        (Array.isArray(item.altSpellings) &&
          item.altSpellings.some(
            (spelling) =>
              typeof spelling === "string" &&
              spelling.toLowerCase() === normalized,
          )),
    );
  return country ? { country, sourceUrl: countryDatasetUrl } : undefined;
}

async function resolveCountryCode(
  code: string,
): Promise<{ country: RestCountry; sourceUrl: string } | undefined> {
  const apiUrl = new URL(
    `${restCountriesBaseUrl}/alpha/${encodeURIComponent(code)}`,
  );
  apiUrl.searchParams.set(
    "fields",
    "name,cca2,cca3,altSpellings,currencies",
  );
  const direct = await fetchRestCountries(apiUrl);
  if (direct.length > 0) {
    return { country: direct[0]!, sourceUrl: apiUrl.toString() };
  }

  const normalized = code.toUpperCase();
  const country = (await loadCountries()).find(
    (item) =>
      item.cca2?.toString().toUpperCase() === normalized ||
      item.cca3?.toString().toUpperCase() === normalized,
  );
  return country ? { country, sourceUrl: countryDatasetUrl } : undefined;
}

async function fetchRestCountries(url: URL): Promise<RestCountry[]> {
  try {
    const response = await fetch(url, {
      headers: { "user-agent": "NEXUS/1.0 countries provider" },
      signal: AbortSignal.timeout(12_000),
    });
    if (response.status === 404) return [];
    if (!response.ok) return [];
    const payload = (await response.json()) as unknown;
    return parseCountryPayload(payload);
  } catch {
    return [];
  }
}

function parseCountryPayload(payload: unknown): RestCountry[] {
  const candidates = Array.isArray(payload)
    ? payload
    : isRecord(payload) && Array.isArray(payload.data)
      ? payload.data
      : isRecord(payload) && isRecord(payload.data)
        ? [payload.data]
        : [payload];

  return candidates.filter(isCompleteCountry);
}

function isCompleteCountry(value: unknown): value is RestCountry {
  if (!isRecord(value)) return false;
  const name = isRecord(value.name) ? value.name : undefined;
  return (
    typeof name?.common === "string" &&
    typeof value.cca2 === "string" &&
    isRecord(value.currencies) &&
    Object.keys(value.currencies).length > 0
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function loadCountries(): Promise<RestCountry[]> {
  countryDatasetPromise ??= fetch(countryDatasetUrl, {
    headers: { "user-agent": "NEXUS/1.0 countries provider" },
    signal: AbortSignal.timeout(20_000),
  }).then(async (response) => {
    if (!response.ok) {
      throw new Error(
        `REST Countries open dataset request failed with HTTP ${response.status}.`,
      );
    }
    const payload = (await response.json()) as unknown;
    if (!Array.isArray(payload)) {
      throw new Error("REST Countries open dataset returned an invalid shape.");
    }
    return payload as RestCountry[];
  });
  try {
    return await countryDatasetPromise;
  } catch (error) {
    countryDatasetPromise = undefined;
    throw error;
  }
}

async function resolveLocationCountryCode(
  location: string,
): Promise<string | undefined> {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", location);
  url.searchParams.set("count", "1");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");
  const response = await fetch(url, {
    headers: { "user-agent": "NEXUS/1.0 country location resolver" },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) return undefined;
  const payload = (await response.json()) as {
    results?: Array<{ country_code?: unknown }>;
  };
  const code = payload.results?.[0]?.country_code;
  return typeof code === "string" && /^[A-Z]{2}$/i.test(code)
    ? code.toUpperCase()
    : undefined;
}

function success(
  query: string,
  resolved: { country: RestCountry; sourceUrl: string },
  matchedBy: CountryResolution["matchedBy"],
): MCPResponse<CountryResolution> {
  const countryCode =
    typeof resolved.country.cca2 === "string"
      ? resolved.country.cca2.toUpperCase()
      : undefined;
  const currencyCode = Object.keys(resolved.country.currencies ?? {})[0];
  const countryName =
    typeof resolved.country.name?.common === "string"
      ? resolved.country.name.common
      : undefined;
  if (!countryCode || !currencyCode || !countryName) {
    return {
      ok: false,
      error: `REST Countries returned incomplete country metadata for "${query}".`,
    };
  }
  return {
    ok: true,
    data: {
      source: "REST Countries",
      query,
      countryName,
      countryCode,
      currencyCode,
      matchedBy,
      sourceUrl: resolved.sourceUrl,
    },
    metadata: { protocol: "HTTPS", operation: "country-currency-resolution" },
  };
}
