import { GoogleGenAI, Type, type Schema } from "@google/genai";
import { runtimeConfig } from "../config/runtime";

export interface CertificateInsight {
  institution: string | null;
  courseName: string | null;
  credentialType: string | null;
  grade: string | null;
  issueDate: string | null;
  durationOrCredits: string | null;
  confidence: "high" | "medium" | "low";
  suggestedEduAmount: number;
  suggestionReason: string;
  rawSummary: string;
  source?: "gemini" | "fallback";
  warning?: string | null;
}

interface CertificateInsightFallbackInput {
  institution: string | null;
  courseName: string | null;
  credentialType: string | null;
  warning: string;
}

interface GeminiFailureSummary {
  code: "quota_exceeded" | "temporarily_unavailable";
  message: string;
  retryAfterSeconds: number | null;
}

const PROMPT = `You are a certificate verification assistant for an academic credential blockchain system called DACS.

Analyse the provided certificate image or PDF and extract all relevant information.

For suggestedEduAmount (an integer from 1 to 100), use this rubric:
- Credential type weightings:
  * internship: 25–40
  * hackathon or competition: 20–35
  * certification (e.g. AWS, Google, industry cert): 15–25
  * bootcamp: 15–20
  * course or workshop: 8–15
  * quiz or seminar: 3–8
  * other: 5–10
- Institution tier bonus: +10 for IITs, IIMs, NITs, top global universities, +5 for well-known regional universities
- Grade/performance bonus: +10 for distinction/first class/A+, +5 for merit/second class, 0 for pass
- Duration bonus: +5 for 6+ months, +3 for 3–6 months, 0 for less than 3 months

Set confidence to:
- "high" if institution name, course name, and date are all clearly visible
- "medium" if some fields are partially visible or ambiguous
- "low" if the document is unclear, damaged, or fields cannot be reliably read

Return ONLY valid JSON matching the schema. Use null for fields that cannot be determined.`;

const responseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    institution: { type: Type.STRING, nullable: true },
    courseName: { type: Type.STRING, nullable: true },
    credentialType: { type: Type.STRING, nullable: true },
    grade: { type: Type.STRING, nullable: true },
    issueDate: { type: Type.STRING, nullable: true },
    durationOrCredits: { type: Type.STRING, nullable: true },
    confidence: { type: Type.STRING, enum: ["high", "medium", "low"] },
    suggestedEduAmount: { type: Type.INTEGER },
    suggestionReason: { type: Type.STRING },
    rawSummary: { type: Type.STRING },
  },
  required: ["confidence", "suggestedEduAmount", "suggestionReason", "rawSummary"],
};

const BASE_SUGGESTED_EDU_BY_CREDENTIAL_TYPE: Record<string, number> = {
  internship: 32,
  hackathon: 25,
  competition: 25,
  certification: 20,
  bootcamp: 18,
  workshop: 12,
  course: 12,
  seminar: 5,
  quiz: 5,
  other: 7,
};

function clampSuggestedEduAmount(value: number) {
  return Math.max(1, Math.min(100, Math.round(value)));
}

function normalizeCredentialType(credentialType: string | null) {
  if (!credentialType) {
    return "other";
  }

  const normalized = credentialType.trim().toLowerCase();

  return BASE_SUGGESTED_EDU_BY_CREDENTIAL_TYPE[normalized]
    ? normalized
    : "other";
}

function getInstitutionTierBonus(institution: string | null) {
  if (!institution) {
    return 0;
  }

  if (
    /\b(iit|iim|nit|iiit|bits|stanford|harvard|mit|oxford|cambridge|indian institute of technology|indian institute of management|national institute of technology)\b/i.test(
      institution
    )
  ) {
    return 10;
  }

  if (/\b(university|institute of technology|college)\b/i.test(institution)) {
    return 5;
  }

  return 0;
}

function extractRetryAfterSeconds(message: string) {
  const match = message.match(/retry in\s+([\d.]+)s/i);

  if (!match) {
    return null;
  }

  const parsed = Number.parseFloat(match[1]);

  return Number.isFinite(parsed) ? Math.ceil(parsed) : null;
}

function getErrorStatus(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof (error as { status?: unknown }).status === "number"
  ) {
    return (error as { status: number }).status;
  }

  return null;
}

export function summarizeGeminiFailure(error: unknown): GeminiFailureSummary {
  const rawMessage =
    error instanceof Error
      ? error.message
      : "AI analysis is temporarily unavailable.";
  const retryAfterSeconds = extractRetryAfterSeconds(rawMessage);
  const status = getErrorStatus(error);

  if (status === 429 || /quota exceeded|resource_exhausted/i.test(rawMessage)) {
    return {
      code: "quota_exceeded",
      retryAfterSeconds,
      message: retryAfterSeconds
        ? `Live Gemini quota is exhausted right now, so DACS is using a metadata-only fallback. Retry in about ${retryAfterSeconds} seconds or continue the review manually.`
        : "Live Gemini quota is exhausted right now, so DACS is using a metadata-only fallback. Continue the review manually before minting.",
    };
  }

  return {
    code: "temporarily_unavailable",
    retryAfterSeconds,
    message:
      "Live AI analysis is temporarily unavailable, so DACS is using a metadata-only fallback. Review the uploaded evidence manually before minting.",
  };
}

export function buildFallbackCertificateInsight(
  input: CertificateInsightFallbackInput
): CertificateInsight {
  const normalizedCredentialType = normalizeCredentialType(input.credentialType);
  const suggestedEduAmount = clampSuggestedEduAmount(
    BASE_SUGGESTED_EDU_BY_CREDENTIAL_TYPE[normalizedCredentialType] +
      getInstitutionTierBonus(input.institution)
  );

  return {
    institution: input.institution,
    courseName: input.courseName,
    credentialType: input.credentialType,
    grade: null,
    issueDate: null,
    durationOrCredits: null,
    confidence: "low",
    suggestedEduAmount,
    suggestionReason:
      "This suggestion uses submission metadata only because live document analysis is unavailable. Verify the uploaded evidence manually before minting.",
    rawSummary: input.warning,
    source: "fallback",
    warning: input.warning,
  };
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isCertificateInsight(value: unknown): value is CertificateInsight {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    isNullableString(candidate.institution) &&
    isNullableString(candidate.courseName) &&
    isNullableString(candidate.credentialType) &&
    isNullableString(candidate.grade) &&
    isNullableString(candidate.issueDate) &&
    isNullableString(candidate.durationOrCredits) &&
    (candidate.confidence === "high" ||
      candidate.confidence === "medium" ||
      candidate.confidence === "low") &&
    typeof candidate.suggestedEduAmount === "number" &&
    Number.isInteger(candidate.suggestedEduAmount) &&
    typeof candidate.suggestionReason === "string" &&
    typeof candidate.rawSummary === "string"
  );
}

export async function analyseCertificate(
  buffer: Buffer,
  mimeType: string
): Promise<CertificateInsight> {
  if (!runtimeConfig.geminiApiKey) {
    throw new Error("GEMINI_API_KEY is not configured on the server");
  }

  const ai = new GoogleGenAI({ apiKey: runtimeConfig.geminiApiKey });

  const response = await Promise.race([
    ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        { text: PROMPT },
        {
          inlineData: {
            mimeType,
            data: buffer.toString("base64"),
          },
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema,
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error("AI analysis took too long. Please retry the certificate analysis.")),
        45_000
      )
    ),
  ]);

  const text = response.text;

  if (!text) {
    throw new Error("Gemini returned an empty response");
  }

  const parsed = JSON.parse(text) as unknown;

  if (!isCertificateInsight(parsed)) {
    throw new Error("Gemini returned an invalid certificate insight payload");
  }

  return {
    ...parsed,
    source: "gemini",
    warning: null,
  };
}
