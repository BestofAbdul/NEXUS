import type { Agent, AgentInput, AgentResult } from "./index";
import { getMissionWorkflow } from "./workflow-definitions";

export interface ConversationDecision {
  kind: "ASK" | "UPDATE_CONTEXT" | "RESEARCH";
  reply: string;
  researchQueries: string[];
  deepResearch: boolean;
  contextUpdates: Record<string, string>;
}

export class ConversationAgent implements Agent<ConversationDecision> {
  readonly id = "conversation-agent";
  readonly capabilities = ["conversation"] as const;

  async run(
    input: AgentInput,
  ): Promise<AgentResult<ConversationDecision>> {
    const message = stringValue(input.context?.message)?.trim();
    const pendingQuestions = stringArray(input.context?.pendingQuestions);
    if (!message) {
      return {
        status: "NEEDS_INPUT",
        summary: "Conversation requires a user message.",
      };
    }

    const contextUpdates = extractContextUpdates(
      input,
      message,
      pendingQuestions.length > 0,
    );
    const captured = Object.keys(contextUpdates);
    if (captured.length > 0) {
      const reply =
        `I've updated ${captured.map(humanize).join(", ")} and kept the correction with this mission. ` +
        "I'm rebuilding any affected research from the updated facts.";
      return {
        status: "COMPLETED",
        summary: reply,
        data: {
          kind: "UPDATE_CONTEXT",
          reply,
          researchQueries: [],
          deepResearch: false,
          contextUpdates,
        },
      };
    }

    if (pendingQuestions.length > 0) {
      const reply =
        `I've kept your request with this mission. Before I research it, ` +
        `I still need: ${pendingQuestions.join(" ")}`;
      return {
        status: "COMPLETED",
        summary: reply,
        data: {
          kind: "ASK",
          reply,
          researchQueries: [],
          deepResearch: false,
          contextUpdates: {},
        },
        pendingQuestions,
      };
    }

    const facts = Object.entries(input.mission.setupAnswers)
      .filter(([, value]) => value.trim())
      .map(([key, value]) => `${humanize(key)}: ${value}`)
      .join("; ");
    const deepResearch = /\b(deep|verify|compare|official|sources?|evidence|details?|explore|more)\b/i.test(
      message,
    );
    const primaryQuery =
      `${message}. Mission: ${input.mission.goal}. ${facts}`.trim();
    const researchQueries = [
      primaryQuery,
      `Current authoritative sources, requirements, dates, costs, and concrete options for: ${primaryQuery}`,
    ];
    const reply =
      "I've started researching that follow-up against current sources. " +
      "I'll keep the result attached to this mission rather than replacing earlier evidence.";

    return {
      status: "COMPLETED",
      summary: reply,
      data: {
        kind: "RESEARCH",
        reply,
        researchQueries: deepResearch
          ? researchQueries
          : researchQueries.slice(0, 1),
        deepResearch,
        contextUpdates: {},
      },
    };
  }
}

const aliases: Record<string, string[]> = {
  origin: ["origin", "from", "travelling from", "traveling from", "departing from"],
  destination: ["destination", "to", "moving to", "going to", "studying in"],
  departureDate: ["departure date", "depart", "leaving", "travel date"],
  movingFrom: ["moving from", "relocating from", "from"],
  workStatus: ["work status", "occupation", "job", "profession"],
  subject: ["subject", "course", "field"],
  studyLevel: ["study level", "degree", "level"],
  intake: ["intake", "start date"],
  propertyGoal: ["property goal", "buy or rent", "housing goal"],
  location: ["location", "where"],
  budget: ["budget", "maximum budget", "max budget"],
  targetRole: ["target role", "role", "job title"],
  eventType: ["event type", "event"],
  date: ["event date", "date"],
  guestCount: ["guest count", "guests", "attendees"],
  appointmentType: ["appointment type", "treatment", "procedure"],
  items: ["items", "goods", "shipment"],
  timeline: ["timeline", "arrival", "deadline"],
  desiredOutcome: ["desired outcome", "outcome", "success"],
};

function extractContextUpdates(
  input: AgentInput,
  message: string,
  allowUnlabeledAnswer: boolean,
): Record<string, string> {
  const workflow = getMissionWorkflow(input.mission.type);
  const missingInputs = workflow.requiredInputs.filter(({ key, validate }) => {
    const current = input.mission.setupAnswers[key]?.trim();
    return !current || (validate ? !validate(current) : false);
  });
  const candidateInputs = allowUnlabeledAnswer
    ? missingInputs
    : workflow.requiredInputs;
  const updates: Record<string, string> = {};

  for (const { key, validate } of candidateInputs) {
    const value = extractLabeledValue(message, aliases[key] ?? [humanize(key)]);
    if (value && (!validate || validate(value))) updates[key] = value;
  }

  if (input.mission.type === "TRAVEL") {
    const route = message.match(
      /\bfrom\s+(.+?)\s+to\s+(.+?)(?:\s+(?:on|departing|leaving)\s+(\d{4}-\d{2}-\d{2})|\s*$)/i,
    );
    if (route?.[1] && candidateInputs.some(({ key }) => key === "origin")) {
      updates.origin = cleanValue(route[1]);
    }
    if (route?.[2] && candidateInputs.some(({ key }) => key === "destination")) {
      updates.destination = cleanValue(route[2]);
    }
    if (
      route?.[3] &&
      candidateInputs.some(({ key }) => key === "departureDate")
    ) {
      updates.departureDate = route[3];
    }
  }

  const isoDate = message.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0];
  for (const { key, validate } of candidateInputs) {
    if (!updates[key] && isoDate && validate?.(isoDate)) updates[key] = isoDate;
  }

  if (
    allowUnlabeledAnswer &&
    missingInputs.length === 1 &&
    Object.keys(updates).length === 0
  ) {
    const [{ key, validate }] = missingInputs;
    const value = cleanValue(message);
    if (value && (!validate || validate(value))) updates[key] = value;
  }
  return updates;
}

function extractLabeledValue(
  message: string,
  labels: string[],
): string | undefined {
  for (const label of labels.sort((left, right) => right.length - left.length)) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = message.match(
      new RegExp(
        `(?:^|[;\\n,.])\\s*${escaped}\\s*(?::|=|is\\b)\\s*([^;\\n,.]+)`,
        "i",
      ),
    );
    if (match?.[1]) return cleanValue(match[1]);
  }
  return undefined;
}

function cleanValue(value: string): string {
  return value.trim().replace(/[.!?]+$/, "").trim();
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function humanize(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}
