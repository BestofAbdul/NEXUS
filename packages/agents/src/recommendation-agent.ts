import type {
  CreateRecommendationInput,
  MissionResearchResult,
} from "@nexus/shared";
import type { Agent, AgentInput, AgentResult } from "./index";

interface Candidate {
  title: string;
  summary: string;
  score: number;
  rationale: string;
}

export class RecommendationAgent
  implements Agent<CreateRecommendationInput[]>
{
  readonly id = "recommendation-agent";
  readonly capabilities = ["recommendations"] as const;

  async run(
    input: AgentInput,
  ): Promise<AgentResult<CreateRecommendationInput[]>> {
    const candidates = input.mission.researchResults
      .flatMap(extractCandidates)
      .sort((left, right) => right.score - left.score)
      .slice(0, 5);

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

function extractCandidates(result: MissionResearchResult): Candidate[] {
  if (result.capability === "flights" && Array.isArray(result.data.offers)) {
    const offers = result.data.offers.filter(isFlightOffer);
    const maxPrice = Math.max(...offers.map((offer) => offer.totalPrice), 1);
    return offers.map((offer) => ({
      title: `${offer.validatingAirlines.join("/") || "Airline"} flight: ${formatMoney(offer.totalPrice, offer.currency)}`,
      summary: `${offer.stops === 0 ? "Direct" : `${offer.stops} stop(s)`}, duration ${offer.duration}. Departure ${offer.segments[0]?.departureAt ?? "not supplied"}.`,
      score: 100 - (offer.totalPrice / maxPrice) * 50 - offer.stops * 5,
      rationale: `Live offer from ${result.providerId}, retrieved ${result.retrievedAt.toISOString()}. Availability and price require human verification.`,
    }));
  }

  if (Array.isArray(result.data.items)) {
    return result.data.items
      .filter(isEvidenceItem)
      .map((item) => ({
        title: item.title,
        summary: item.excerpt,
        score: item.score,
        rationale: `Current external evidence from ${item.url}, retrieved ${result.retrievedAt.toISOString()}.`,
      }));
  }

  if (result.capability === "places" && Array.isArray(result.data.places)) {
    return result.data.places
      .filter(isPlace)
      .map((place) => ({
        title: place.title,
        summary: `${place.category}; ${formatDistance(place.distanceMeters)} from the resolved destination center.`,
        score: Math.max(0, 1 - place.distanceMeters / 20_000),
        rationale: `OpenStreetMap evidence from ${result.providerId}, retrieved ${result.retrievedAt.toISOString()}.`,
      }));
  }

  return [];
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
