import { NextResponse } from "next/server";
import { ApiError, toApiError } from "@/lib/errors";
import { ensureUserApiKey } from "@/lib/generate-api-key";
import { generateLines } from "@/lib/generate-lines";
import { scrapeContext, type PersonalizePayload } from "@/lib/scrape-context";
import { getRequiredEnv } from "@/lib/supabase";
import { getServerSupabase } from "@/lib/supabase-server";
import { consumeQuotaForApiKey, getMonthlyUsageStats, logUsage, validateAndConsumeApiKey } from "@/lib/validate-key";

export async function POST(request: Request) {
  const internalKey = getRequiredEnv("PLAYGROUND_API_KEY");
  let keyContext: { id: string; requestsLimit: number } | null = null;
  let resourceIdForLog: string | null = null;

  try {
    const supabase = await getServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const keyRow = await ensureUserApiKey(user.id);
      await consumeQuotaForApiKey(keyRow.id, keyRow.requests_limit);
      keyContext = { id: keyRow.id, requestsLimit: keyRow.requests_limit };
    } else {
      keyContext = await validateAndConsumeApiKey(internalKey);
    }

    let payload: PersonalizePayload = {};
    try {
      payload = (await request.json()) as PersonalizePayload;
    } catch {
      throw new ApiError(400, "MISSING_INPUT", "A JSON body is required.");
    }

    const scraped = await scrapeContext(payload);
    resourceIdForLog = scraped.sourceUrl ?? scraped.prospect.company;

    const lines = await generateLines({
      contextSummary: scraped.contextSummary,
    });

    const usage = await getMonthlyUsageStats(keyContext.id, keyContext.requestsLimit);

    await logUsage({
      apiKeyId: keyContext.id,
      endpoint: "/api/playground/personalize",
      resourceId: resourceIdForLog,
      statusCode: 200,
    });

    return NextResponse.json(
      {
        prospect: scraped.prospect,
        lines,
        usage: {
          requests_used: usage.used,
          requests_limit: usage.limit,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    const apiError = toApiError(error);

    if (keyContext) {
      await logUsage({
        apiKeyId: keyContext.id,
        endpoint: "/api/playground/personalize",
        resourceId: resourceIdForLog,
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
