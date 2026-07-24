import { NextResponse } from "next/server";
import {
  missionTypes,
  type A2MCPMissionRequest,
  type A2MCPMissionResponse,
  type A2MCPMissionAction,
  type MissionType,
  type SetupAnswers,
} from "@nexus/shared";
import {
  A2MCPMissionError,
  invokeA2MCPMission,
} from "@/lib/a2mcp-mission";

const missionTypeSet = new Set<string>(missionTypes);

interface ErrorResponse {
  error: {
    code: string;
    message: string;
  };
}

export async function POST(
  request: Request,
): Promise<NextResponse<A2MCPMissionResponse | ErrorResponse>> {
  const parsedRequest = await parseRequest(request);
  if (!parsedRequest.ok) {
    return errorResponse(parsedRequest.code, parsedRequest.message, 400);
  }

  try {
    return NextResponse.json(await invokeA2MCPMission(parsedRequest.value));
  } catch (error) {
    if (error instanceof A2MCPMissionError) {
      return errorResponse(error.code, error.message, error.status);
    }

    console.error("A2MCP mission invocation failed", error);
    return errorResponse(
      "MISSION_INVOCATION_FAILED",
      "The mission could not be processed.",
      500,
    );
  }
}

interface ValidMissionRequest extends A2MCPMissionRequest {
  goal: string;
  missionType?: MissionType;
  context?: SetupAnswers;
  action?: A2MCPMissionAction;
}

type ParseResult =
  | { ok: true; value: ValidMissionRequest }
  | { ok: false; code: string; message: string };

async function parseRequest(request: Request): Promise<ParseResult> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return {
      ok: false,
      code: "INVALID_JSON",
      message: "Request body must be valid JSON.",
    };
  }

  if (!isRecord(body)) {
    return {
      ok: false,
      code: "INVALID_REQUEST",
      message: "Request body must be a JSON object.",
    };
  }

  if (typeof body.goal !== "string" || body.goal.trim().length === 0) {
    return {
      ok: false,
      code: "INVALID_GOAL",
      message: "goal is required and must be a non-empty string.",
    };
  }

  if (
    body.missionType !== undefined &&
    (typeof body.missionType !== "string" ||
      !missionTypeSet.has(body.missionType))
  ) {
    return {
      ok: false,
      code: "INVALID_MISSION_TYPE",
      message: `missionType must be one of: ${missionTypes.join(", ")}.`,
    };
  }

  if (
    body.missionId !== undefined &&
    (typeof body.missionId !== "string" ||
      body.missionId.trim().length === 0)
  ) {
    return {
      ok: false,
      code: "INVALID_MISSION_ID",
      message: "missionId must be a non-empty string when provided.",
    };
  }

  if (body.context !== undefined && !isStringRecord(body.context)) {
    return {
      ok: false,
      code: "INVALID_CONTEXT",
      message: "context must be an object containing string values.",
    };
  }

  if (body.action !== undefined && !isMissionAction(body.action)) {
    return {
      ok: false,
      code: "INVALID_ACTION",
      message:
        "action must be an EXPLORE_RECOMMENDATION action with a recommendationId.",
    };
  }

  if (
    body.message !== undefined &&
    (typeof body.message !== "string" ||
      body.message.trim().length === 0 ||
      body.message.trim().length > 4_000)
  ) {
    return {
      ok: false,
      code: "INVALID_MESSAGE",
      message: "message must be a non-empty string of at most 4000 characters.",
    };
  }

  if (body.message !== undefined && body.missionId === undefined) {
    return {
      ok: false,
      code: "MESSAGE_REQUIRES_MISSION",
      message: "message can be sent only when resuming an existing mission.",
    };
  }

  return {
    ok: true,
    value: {
      goal: body.goal.trim(),
      missionType: body.missionType as MissionType | undefined,
      missionId:
        typeof body.missionId === "string" ? body.missionId.trim() : undefined,
      context: body.context as SetupAnswers | undefined,
      action: body.action as A2MCPMissionAction | undefined,
      message:
        typeof body.message === "string" ? body.message.trim() : undefined,
    },
  };
}

function isMissionAction(value: unknown): value is A2MCPMissionAction {
  return (
    isRecord(value) &&
    value.type === "EXPLORE_RECOMMENDATION" &&
    typeof value.recommendationId === "string" &&
    value.recommendationId.trim().length > 0 &&
    (value.query === undefined || typeof value.query === "string")
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringRecord(value: unknown): value is SetupAnswers {
  return (
    isRecord(value) &&
    Object.values(value).every((item) => typeof item === "string")
  );
}

function errorResponse(
  code: string,
  message: string,
  status: number,
): NextResponse<ErrorResponse> {
  return NextResponse.json({ error: { code, message } }, { status });
}
