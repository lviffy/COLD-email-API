import { NextResponse } from "next/server";
import { ApiError, toApiError } from "@/lib/errors";
import { getRequiredEnv } from "@/lib/supabase";
import { ensureUserApiKey } from "@/lib/generate-api-key";
import { getServerSupabase } from "@/lib/supabase-server";
import { consumeQuotaForApiKey, logUsage, validateAndConsumeApiKey } from "@/lib/validate-key";

type PlaygroundPayload = {
  input?: string;
};

function parseInput(payload: PlaygroundPayload): string {
  const input = payload.input?.trim();

  if (!input) {
    throw new ApiError(400, "MISSING_INPUT", "Provide a non-empty `input` field.");
  }

  return input;
}

export async function POST(request: Request) {
  const internalKey = getRequiredEnv("INTERNAL_PLAYGROUND_API_KEY");
  let keyContext: { id: string } | null = null;
  let requestIdForLog: string | null = null;

  try {
    const supabase = await getServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const keyRow = await ensureUserApiKey(user.id);
      await consumeQuotaForApiKey(keyRow.id, keyRow.requests_limit);
      keyContext = { id: keyRow.id };
    } else {
      keyContext = await validateAndConsumeApiKey(internalKey);
    }

    let payload: PlaygroundPayload = {};
    try {
      payload = (await request.json()) as PlaygroundPayload;
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

    if (keyContext) {
      await logUsage({
        apiKeyId: keyContext.id,
        endpoint: "/api/playground/example",
        resourceId: requestId,
        statusCode: 200,
      });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const apiError = toApiError(error);

    if (keyContext) {
      await logUsage({
        apiKeyId: keyContext.id,
        endpoint: "/api/playground/example",
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