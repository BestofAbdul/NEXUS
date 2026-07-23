import type {
  Mission,
  MissionType,
  WorkflowTaskDefinition,
} from "@nexus/shared";

interface RequiredInput {
  key: string;
  question: string;
  validate?: (value: string) => boolean;
}

export interface MissionWorkflowDefinition {
  missionType: MissionType;
  requiredInputs: RequiredInput[];
  tasks: WorkflowTaskDefinition[];
}

const isoDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

const workflows: Record<MissionType, MissionWorkflowDefinition> = {
  TRAVEL: workflow("TRAVEL", [
    required("origin", "Where are you travelling from? Include a city or airport."),
    required(
      "destination",
      "What city or airport are you travelling to? A country alone is not precise enough.",
    ),
    required("departureDate", "What is your departure date?", isoDate),
  ], [
    task("resolve-airports", "Resolve airports", "Resolve origin and destination to real airport or city codes.", "airports"),
    task("research-flights", "Research flights", "Search real schedules, routes, availability, and fares.", "flights"),
    task("research-hotels", "Research hotels", "Search accommodation availability and prices for the selected dates.", "hotels", false),
    task("research-weather", "Research weather", "Check the destination forecast for the selected travel date.", "weather"),
    task("research-places", "Research destination places", "Find real nearby places matching the destination area.", "places", false),
    task("research-visa", "Research visa requirements", "Find current entry and visa requirements from authoritative sources.", "visa"),
    task("research-currency", "Research currency", "Resolve destination currency and current exchange-rate evidence.", "currency"),
    task("research-transportation", "Research local transportation", "Find nearby public transport and arrival options.", "transportation", false),
    task("generate-budget", "Build evidence-backed budget", "Aggregate only prices returned by providers.", "budget"),
    task("generate-recommendations", "Generate recommendations", "Compare verified evidence and rank actionable options.", "recommendations"),
  ]),
  RELOCATE: workflow("RELOCATE", [
    required("movingFrom", "Which country or city are you relocating from?"),
    required("destination", "Which country and preferred city are you relocating to?"),
    required("workStatus", "What is your occupation or intended work situation?"),
  ], [
    task("research-immigration", "Research immigration pathways", "Verify current immigration routes and eligibility sources.", "immigration"),
    task("research-jobs", "Research jobs", "Find live roles matching the user's occupation and location.", "jobs"),
    task("research-housing", "Research housing", "Find current housing options and asking prices.", "housing"),
    task("research-healthcare", "Research healthcare access", "Verify public and private healthcare access requirements.", "healthcare"),
    task("resolve-relocation-airports", "Resolve relocation airports", "Resolve the relocation route to airport or city codes.", "airports", false),
    task("research-relocation-flights", "Research relocation flights", "Search real flight schedules and fares.", "flights", false),
    task("research-schools", "Research schools", "Find schools when the household context requires them.", "schools", false),
    task("research-taxes", "Research taxes", "Verify official tax and payroll guidance.", "taxes"),
    task("generate-budget", "Build evidence-backed relocation budget", "Aggregate only provider-backed costs.", "budget"),
    task("generate-recommendations", "Generate relocation recommendations", "Rank pathways and locations using stored evidence.", "recommendations"),
  ]),
  STUDY_ABROAD: workflow("STUDY_ABROAD", [
    required("destination", "Which country or city do you want to study in?"),
    required("subject", "What subject do you want to study?"),
    required("studyLevel", "What study level are you applying for?"),
    required("intake", "Which intake or start date are you targeting?"),
  ], [
    task("research-universities", "Research universities", "Find institutions with relevant programs.", "universities"),
    task("research-programs", "Research programs", "Verify program curriculum, entry requirements, and deadlines.", "programs"),
    task("research-scholarships", "Research scholarships", "Find current scholarships and eligibility criteria.", "scholarships"),
    task("research-student-visa", "Research student visa", "Verify current student visa requirements.", "visa"),
    task("research-student-accommodation", "Research accommodation", "Find current student accommodation options and prices.", "accommodation"),
    task("generate-budget", "Build evidence-backed study budget", "Aggregate tuition, fees, housing, and travel evidence.", "budget"),
    task("generate-recommendations", "Generate study recommendations", "Rank programs using verified fit, deadlines, and costs.", "recommendations"),
  ]),
  BUY_RENT_PROPERTY: workflow("BUY_RENT_PROPERTY", [
    required("propertyGoal", "Are you buying or renting?"),
    required("location", "Which city or neighbourhood should NEXUS research?"),
    required("budget", "What is your maximum budget?"),
  ], [
    task("research-properties", "Research properties", "Find live property listings that match the brief.", "properties"),
    task("research-mortgage", "Research mortgage options", "Verify current mortgage rates and eligibility sources.", "mortgage", false),
    task("research-neighbourhood", "Research neighbourhood", "Gather maps, amenities, commute, and neighbourhood evidence.", "neighbourhood"),
    task("research-crime", "Research crime and safety", "Find current official crime or safety statistics.", "crime"),
    task("research-property-schools", "Research schools", "Find nearby schools and official performance evidence.", "schools", false),
    task("research-property-taxes", "Research property taxes", "Verify applicable taxes, fees, and recurring charges.", "taxes"),
    task("generate-budget", "Build evidence-backed property budget", "Aggregate only listing, mortgage, tax, and fee evidence.", "budget"),
    task("generate-recommendations", "Generate property recommendations", "Rank properties and neighbourhoods using stored evidence.", "recommendations"),
  ]),
  NEW_JOB: workflow("NEW_JOB", [
    required("targetRole", "What role are you targeting?"),
    required("location", "Which location or remote market should NEXUS search?"),
  ], [
    task("research-live-jobs", "Research live jobs", "Find current openings that match the role and location.", "jobs"),
    task("research-employers", "Research employers", "Gather current company and role evidence.", "employers"),
    task("research-salary", "Research compensation", "Find current salary ranges from reputable sources.", "salary"),
    task("research-work-authorization", "Research work authorization", "Verify work authorization constraints when relevant.", "immigration", false),
    task("generate-recommendations", "Generate job recommendations", "Rank live opportunities using verified fit evidence.", "recommendations"),
  ]),
  PLAN_EVENT: workflow("PLAN_EVENT", [
    required("eventType", "What type of event are you planning?"),
    required("location", "Where will the event take place?"),
    required("date", "What is the event date?"),
    required("guestCount", "How many guests should NEXUS plan for?"),
  ], [
    task("research-venues", "Research venues", "Find available venues matching date, capacity, and location.", "venues"),
    task("research-event-suppliers", "Research suppliers", "Find relevant catering, equipment, and service providers.", "suppliers"),
    task("research-event-weather", "Research event weather", "Check forecast availability for the event date.", "weather", false),
    task("research-event-transport", "Research guest transportation", "Find public transport and arrival options.", "transportation", false),
    task("generate-budget", "Build evidence-backed event budget", "Aggregate venue and supplier quotes only.", "budget"),
    task("generate-recommendations", "Generate event recommendations", "Rank venue and supplier options using evidence.", "recommendations"),
  ]),
  MEDICAL_TRIP: workflow("MEDICAL_TRIP", [
    required("origin", "Where will the patient travel from?"),
    required("destination", "Which city or country should NEXUS research for care?"),
    required("appointmentType", "What treatment or appointment type is being planned?"),
    required("departureDate", "What is the intended departure date?", isoDate),
  ], [
    task("research-hospitals", "Research hospitals", "Find accredited providers relevant to the requested care.", "hospitals"),
    task("research-doctors", "Research doctors", "Find licensed specialists and provider affiliations.", "doctors"),
    task("research-insurance", "Research insurance", "Verify coverage and pre-authorization information.", "insurance"),
    task("research-medical-visa", "Research medical visa", "Verify current medical-entry requirements.", "medical-visa"),
    task("resolve-medical-airports", "Resolve medical travel airports", "Resolve origin and destination to airport or city codes.", "airports"),
    task("research-medical-flights", "Research flights", "Search real schedules and fares.", "flights"),
    task("research-medical-hotels", "Research accessible hotels", "Search accommodation near selected providers.", "hotels"),
    task("research-recovery", "Research recovery logistics", "Find non-clinical accessibility and local support options.", "recovery"),
    task("generate-budget", "Build evidence-backed medical travel budget", "Aggregate only provider-backed logistics costs.", "budget"),
    task("generate-recommendations", "Generate medical logistics recommendations", "Rank logistics without providing clinical advice.", "recommendations"),
  ]),
  MOVE_GOODS: workflow("MOVE_GOODS", [
    required("origin", "Where will the shipment depart from?"),
    required("destination", "Where must the shipment be delivered?"),
    required("items", "What goods are being moved?"),
    required("timeline", "When must the goods arrive?"),
  ], [
    task("research-carriers", "Research carriers", "Find carriers serving the requested route and shipment type.", "freight"),
    task("research-customs", "Research customs", "Verify customs documents and restricted-goods guidance.", "customs"),
    task("research-shipping-insurance", "Research insurance", "Find shipment insurance requirements and options.", "insurance"),
    task("research-route", "Research route options", "Compare mode, transit time, and handoff points.", "transportation"),
    task("generate-budget", "Build evidence-backed shipping budget", "Aggregate carrier quotes and official fees only.", "budget"),
    task("generate-recommendations", "Generate shipping recommendations", "Rank route and carrier evidence.", "recommendations"),
  ]),
  CUSTOM: workflow("CUSTOM", [
    required("desiredOutcome", "What exact outcome should be true when this mission is complete?"),
  ], [
    task("research-custom-mission", "Research the mission", "Gather current external evidence relevant to the stated outcome.", "knowledge"),
    task("generate-recommendations", "Generate recommendations", "Rank evidence-backed next actions.", "recommendations"),
  ]),
};

export function getMissionWorkflow(
  missionType: MissionType,
): MissionWorkflowDefinition {
  return workflows[missionType];
}

export function getBlockingQuestions(mission: Mission): string[] {
  return getMissionWorkflow(mission.type).requiredInputs
    .filter(({ key, validate }) => {
      const value = mission.setupAnswers[key]?.trim();
      return !value || (validate ? !validate(value) : false);
    })
    .map(({ question }) => question);
}

function workflow(
  missionType: MissionType,
  requiredInputs: RequiredInput[],
  definitions: Omit<WorkflowTaskDefinition, "sequence" | "inputKeys">[],
): MissionWorkflowDefinition {
  return {
    missionType,
    requiredInputs,
    tasks: definitions.map((definition, index) => ({
      ...definition,
      sequence: index + 1,
      inputKeys: requiredInputs.map((input) => input.key),
    })),
  };
}

function required(
  key: string,
  question: string,
  validate?: (value: string) => boolean,
): RequiredInput {
  return { key, question, validate };
}

function task(
  key: string,
  title: string,
  description: string,
  capability: string,
  requiredTask = true,
): Omit<WorkflowTaskDefinition, "sequence" | "inputKeys"> {
  return {
    key,
    title,
    description,
    capability,
    required: requiredTask,
  };
}
