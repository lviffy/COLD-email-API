import { NextResponse } from "next/server";
import { ApiError, toApiError } from "@/lib/errors";
import { logUsage, validateAndConsumeApiKey } from "@/lib/validate-key";

type RequestPayload = {
  input?: string;
};

function parseInput(payload: RequestPayload): string {
  const input = payload.input?.trim();

  if (!input) {
    throw new ApiError(400, "MISSING_INPUT", "Provide a non-empty `input` field.");
  }

  return input;
}

export async function POST(request: Request) {
  const apiKeyHeader = request.headers.get("x-api-key") ?? "";
  let keyContext: { id: string } | null = null;
  let requestIdForLog: string | null = null;

  try {
    keyContext = await validateAndConsumeApiKey(apiKeyHeader);

    let payload: RequestPayload = {};
    try {
      payload = (await request.json()) as RequestPayload;
    } catch {
      throw new ApiError(400, "MISSING_INPUT", "A JSON body is required.");
    }

    const input = parseInput(payload);
    const requestId = `example-${input.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    requestIdForLog = requestId;

    const result = {
      message: "Template endpoint executed successfully.",
      requestId,
      receivedInput: input,
      processedAt: new Date().toISOString(),
    };

    await logUsage({
      apiKeyId: keyContext.id,
      endpoint: "/api/v1/example",
      resourceId: requestId,
      statusCode: 200,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const apiError = toApiError(error);

    if (keyContext) {
      await logUsage({
        apiKeyId: keyContext.id,
        endpoint: "/api/v1/example",
        resourceId: requestIdForLog,
        statusCode: apiError.status,
      });
    }

    return NextResponse.json(
      {
        error: {
          code: apiError.code,
          message: apiError.message,
        },
      },
      { status: apiError.status },
    );
  }
}