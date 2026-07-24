import type {
  CreateRecommendationInput,
  Mission,
  MissionResearchResult,
} from "@nexus/shared";
import type { Agent, AgentInput, AgentResult } from "./index";

interface Candidate {
  title: string;
  summary: string;
  score: number;
  rationale: string;
  fingerprint: string;
}

export class RecommendationAgent
  implements Agent<CreateRecommendationInput[]>
{
  readonly id = "recommendation-agent";
  readonly capabilities = ["recommendations"] as const;

  async run(
    input: AgentInput,
  ): Promise<AgentResult<CreateRecommendationInput[]>> {
    const candidates = deduplicateCandidates(
      input.mission.researchResults.flatMap((result) =>
        extractCandidates(result, input.mission),
      ),
    )
      .sort((left, right) => right.score - left.score)
      .slice(0, 3);

    if (candidates.length === 0) {
      return {
        status: "BLOCKED",
        summary:
          "Recommendations are waiting for comparable provider evidence. NEXUS will not generate template advice.",
      };
    }

    return {
      status: "COMPLETED",
      summary: `Ranked ${candidates.length} recommendation candidate(s) from persisted evidence.`,
      data: candidates.map((candidate, index) => ({
        rank: index + 1,
        title: candidate.title,
        summary: candidate.summary,
        rationale: candidate.rationale,
      })),
    };
  }
}

function extractCandidates(
  result: MissionResearchResult,
  mission: Mission,
): Candidate[] {
  if (result.capability === "flights" && Array.isArray(result.data.offers)) {
    const offers = result.data.offers.filter(isFlightOffer);
    const maxPrice = Math.max(...offers.map((offer) => offer.totalPrice), 1);
    return offers.map((offer) => ({
      title: `${offer.validatingAirlines.join("/") || "Airline"} flight: ${formatMoney(offer.totalPrice, offer.currency)}`,
      summary: `${offer.stops === 0 ? "Direct" : `${offer.stops} stop(s)`}, duration ${offer.duration}. Departure ${offer.segments[0]?.departureAt ?? "not supplied"}.`,
      score: 100 - (offer.totalPrice / maxPrice) * 50 - offer.stops * 5,
      rationale: `Live offer from ${result.providerId}, retrieved ${result.retrievedAt.toISOString()}. Availability and price require human verification.`,
      fingerprint: `flight:${offer.validatingAirlines.join("-")}:${offer.totalPrice}:${offer.duration}`,
    }));
  }

  if (Array.isArray(result.data.items)) {
    const missionTerms = missionTopicTerms(mission);
    const requiredTerms = requiredTopicTerms(mission);
    return result.data.items
      .filter(isEvidenceItem)
      .map((item) =>
        toEvidenceCandidate(item, result, missionTerms, requiredTerms),
      )
      .filter((candidate): candidate is Candidate => Boolean(candidate));
  }

  if (result.capability === "places" && Array.isArray(result.data.places)) {
    return result.data.places
      .filter(isPlace)
      .map((place) => ({
        title: place.title,
        summary: `${place.category}; ${formatDistance(place.distanceMeters)} from the resolved destination center.`,
      score: Math.max(0, 1 - place.distanceMeters / 20_000),
      rationale: `OpenStreetMap evidence from ${result.providerId}, retrieved ${result.retrievedAt.toISOString()}.`,
      fingerprint: `place:${place.title.toLowerCase()}`,
    }));
  }

  return [];
}

function toEvidenceCandidate(
  item: { title: string; excerpt: string; score: number; url: string },
  result: MissionResearchResult,
  missionTerms: Set<string>,
  requiredTerms: Set<string>,
): Candidate | undefined {
  const hostname = safeHostname(item.url);
  if (isExcludedRecommendationDomain(hostname)) return undefined;

  const itemTerms = tokenize(`${item.title} ${item.excerpt}`);
  const matchedTerms = [...missionTerms].filter((term) => itemTerms.has(term));
  const matchedRequiredTerms = [...requiredTerms].filter((term) =>
    itemTerms.has(term),
  );
  if (requiredTerms.size > 0 && matchedRequiredTerms.length === 0) {
    return undefined;
  }
  if (requiredTerms.size === 0 && missionTerms.size > 0 && matchedTerms.length === 0) {
    return undefined;
  }

  const focus = (
    matchedRequiredTerms.length > 0 ? matchedRequiredTerms : matchedTerms
  ).slice(0, 2);
  const topic =
    focus.length > 0
      ? focus.map(titleCase).join(" + ")
      : humanize(result.capability);
  return {
    title: `${humanize(result.capability)} evidence for ${topic} (${hostname})`,
    summary:
      `Why this matters: this ${hostname} source addresses ${topic.toLowerCase()} ` +
      `for the mission and should be checked for current requirements or options.`,
    score: item.score + matchedTerms.length * 0.2,
    rationale: `Distinct source-backed lead from ${item.url}, retrieved ${result.retrievedAt.toISOString()}; relevance matched ${matchedTerms.join(", ") || "the mission topic"}.`,
    fingerprint: `evidence:${result.capability}:${hostname}:${focus.sort().join("-")}`,
  };
}

function isExcludedRecommendationDomain(hostname: string): boolean {
  return [
    "stackoverflow.com",
    "stackexchange.com",
    "superuser.com",
    "serverfault.com",
  ].some(
    (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
  );
}

function requiredTopicTerms(mission: Mission): Set<string> {
  const keysByMissionType: Record<Mission["type"], string[]> = {
    TRAVEL: ["destination", "origin"],
    RELOCATE: ["destination", "workStatus"],
    STUDY_ABROAD: ["destination", "subject", "studyLevel"],
    BUY_RENT_PROPERTY: ["location", "propertyGoal"],
    NEW_JOB: ["targetRole", "location"],
    PLAN_EVENT: ["eventType", "location"],
    MEDICAL_TRIP: ["destination", "appointmentType"],
    MOVE_GOODS: ["destination", "items"],
    CUSTOM: ["desiredOutcome"],
  };
  return tokenize(
    keysByMissionType[mission.type]
      .map((key) => mission.setupAnswers[key] ?? "")
      .join(" "),
  );
}

function missionTopicTerms(mission: Mission): Set<string> {
  const topicKeys = [
    "destination",
    "location",
    "movingFrom",
    "origin",
    "targetRole",
    "subject",
    "eventType",
    "appointmentType",
    "items",
    "desiredOutcome",
    "workStatus",
  ];
  const values = [
    mission.goal,
    ...topicKeys.map((key) => mission.setupAnswers[key] ?? ""),
  ];
  return tokenize(values.join(" "));
}

function tokenize(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(/\s+/)
      .filter(
        (term) =>
          term.length >= 3 &&
          !stopWords.has(term) &&
          !/^\d+$/.test(term),
      ),
  );
}

function deduplicateCandidates(candidates: Candidate[]): Candidate[] {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    if (seen.has(candidate.fingerprint)) return false;
    seen.add(candidate.fingerprint);
    return true;
  });
}

const stopWords = new Set([
  "and",
  "the",
  "for",
  "from",
  "with",
  "this",
  "that",
  "into",
  "find",
  "plan",
  "mission",
  "current",
  "research",
  "travel",
  "trip",
  "role",
  "work",
  "want",
  "need",
]);

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "external source";
  }
}

function humanize(value: string): string {
  return value
    .replaceAll("-", " ")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function titleCase(value: string): string {
  return value.replace(/\b\w/g, (character) => character.toUpperCase());
}

function isEvidenceItem(
  value: unknown,
): value is { title: string; excerpt: string; score: number; url: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { title?: unknown }).title === "string" &&
    typeof (value as { excerpt?: unknown }).excerpt === "string" &&
    typeof (value as { score?: unknown }).score === "number" &&
    typeof (value as { url?: unknown }).url === "string"
  );
}

function isFlightOffer(
  value: unknown,
): value is {
  totalPrice: number;
  currency: string;
  validatingAirlines: string[];
  stops: number;
  duration: string;
  segments: Array<{ departureAt: string }>;
} {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { totalPrice?: unknown }).totalPrice === "number" &&
    typeof (value as { currency?: unknown }).currency === "string" &&
    Array.isArray((value as { validatingAirlines?: unknown }).validatingAirlines) &&
    typeof (value as { stops?: unknown }).stops === "number" &&
    typeof (value as { duration?: unknown }).duration === "string" &&
    Array.isArray((value as { segments?: unknown }).segments)
  );
}

function isPlace(
  value: unknown,
): value is { title: string; category: string; distanceMeters: number } {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { title?: unknown }).title === "string" &&
    typeof (value as { category?: unknown }).category === "string" &&
    typeof (value as { distanceMeters?: unknown }).distanceMeters === "number"
  );
}

function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
  }).format(amount);
}

function formatDistance(meters: number): string {
  return meters < 1000
    ? `${meters} m`
    : `${(meters / 1000).toFixed(1)} km`;
}
