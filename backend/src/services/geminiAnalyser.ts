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
      model: "gemini-2.0-flash",
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

  return parsed;
}
