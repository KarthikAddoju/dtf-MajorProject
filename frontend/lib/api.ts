"use client"

import { buildBackendUrl } from "@/lib/config"
import type {
  AiInsight,
  AnalyticsOverview,
  AuthUser,
  CollegeLeaderboardEntry,
  DisclosurePackage,
  SavedDisclosureRecord,
  FinalizeMintResult,
  Institute,
  InstituteProfile,
  MintSubmissionInput,
  PlatformHealth,
  PrepareMintResult,
  ResetStaleMintsResult,
  RevocationResult,
  Submission,
  UploadSubmissionInput,
  UploadSubmissionResult,
  VerificationRecord,
} from "@/lib/types"

interface ApiSuccessEnvelope {
  success: true
  [key: string]: unknown
}

interface ApiErrorEnvelope {
  success: false
  error: {
    code: string
    message: string
    fieldErrors?: Record<string, string>
  }
}

type ApiEnvelope = ApiSuccessEnvelope | ApiErrorEnvelope

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH"
  token?: string | null
  body?: unknown
  headers?: Record<string, string>
  signal?: AbortSignal
}

const DEFAULT_API_TIMEOUT_MS = 30_000

export class ApiError extends Error {
  status: number
  code: string
  fieldErrors?: Record<string, string>

  constructor(
    message: string,
    options: {
      status: number
      code: string
      fieldErrors?: Record<string, string>
    }
  ) {
    super(message)
    this.name = "ApiError"
    this.status = options.status
    this.code = options.code
    this.fieldErrors = options.fieldErrors
  }
}

export function isAbortError(error: unknown) {
  if (error instanceof DOMException && error.name === "AbortError") {
    return true
  }

  if (!(error instanceof Error)) {
    return false
  }

  return (
    error.name === "AbortError" ||
    error.message === "signal is aborted without reason" ||
    error.message.toLowerCase().includes("aborted")
  )
}

function isApiErrorEnvelope(value: unknown): value is ApiErrorEnvelope {
  if (!value || typeof value !== "object" || !("error" in value)) {
    return false
  }

  const maybeError = (value as { error?: unknown }).error

  return !!maybeError && typeof maybeError === "object"
}

function buildHeaders(token?: string | null, headers?: Record<string, string>) {
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...headers,
  }
}

async function fetchWithTimeout(
  input: string,
  init: RequestInit,
  timeoutMs = DEFAULT_API_TIMEOUT_MS
) {
  const timeoutController = new AbortController()
  const callerSignal = init.signal
  let timedOut = false

  const forwardAbort = () => {
    timeoutController.abort(callerSignal?.reason)
  }

  if (callerSignal) {
    if (callerSignal.aborted) {
      timeoutController.abort(callerSignal.reason)
    } else {
      callerSignal.addEventListener("abort", forwardAbort, { once: true })
    }
  }

  const timeoutId = globalThis.setTimeout(() => {
    timedOut = true
    timeoutController.abort()
  }, timeoutMs)

  try {
    return await fetch(input, {
      ...init,
      signal: timeoutController.signal,
    })
  } catch (error) {
    if (timedOut) {
      throw new ApiError("Request timed out — check your connection and try again", {
        status: 408,
        code: "REQUEST_TIMEOUT",
      })
    }

    throw error
  } finally {
    globalThis.clearTimeout(timeoutId)
    callerSignal?.removeEventListener("abort", forwardAbort)
  }
}

async function parseApiResponse<T>(
  response: Response,
  fallbackMessage: string
): Promise<T> {
  const contentType = response.headers.get("content-type") ?? ""
  const responseBody = contentType.includes("application/json")
    ? ((await response.json()) as ApiEnvelope)
    : null

  if (!response.ok || !responseBody || responseBody.success === false) {
    const errorEnvelope = isApiErrorEnvelope(responseBody)
      ? responseBody.error
      : undefined

    throw new ApiError(errorEnvelope?.message ?? fallbackMessage, {
      status: response.status,
      code: errorEnvelope?.code ?? "REQUEST_FAILED",
      fieldErrors: errorEnvelope?.fieldErrors,
    })
  }

  return responseBody as unknown as T
}

async function apiRequest<T>(
  pathname: string,
  {
    method = "GET",
    token,
    body,
    headers,
    signal,
  }: RequestOptions = {}
): Promise<T> {
  const hasJsonBody = body !== undefined && !(body instanceof FormData)
  const response = await fetchWithTimeout(buildBackendUrl(pathname), {
    method,
    headers: buildHeaders(token, {
      ...(hasJsonBody ? { "Content-Type": "application/json" } : {}),
      ...headers,
    }),
    body: body === undefined ? undefined : hasJsonBody ? JSON.stringify(body) : body,
    cache: "no-store",
    signal,
  })

  return parseApiResponse<T>(response, "Request failed")
}

export async function requestAuthChallenge(address: string) {
  return apiRequest<{ nonce: string; expiresAt: number }>("/api/auth/challenge", {
    method: "POST",
    body: { address },
  })
}

export async function verifyAuthChallenge(
  address: string,
  message: string,
  signature: string
) {
  return apiRequest<{ token: string; address: string; role: AuthUser["role"] }>(
    "/api/auth/verify",
    {
      method: "POST",
      body: { address, message, signature },
    }
  )
}

export async function fetchCurrentUser(token: string) {
  return apiRequest<{ user: AuthUser }>("/api/auth/me", {
    token,
  })
}

export async function fetchInstitutes(signal?: AbortSignal) {
  return apiRequest<{ institutes: Institute[] }>("/api/institutes", {
    signal,
  })
}

export async function fetchManageInstitutes(token: string, signal?: AbortSignal) {
  return apiRequest<{ institutes: Institute[] }>("/api/institutes/manage", {
    token,
    signal,
  })
}

export async function fetchInstituteProfile(slug: string, signal?: AbortSignal) {
  return apiRequest<{ profile: InstituteProfile }>(`/api/institutes/${slug}/profile`, {
    signal,
  })
}

export async function createInstitute(
  token: string,
  input: { name: string; shortCode: string }
) {
  return apiRequest<{ institute: Institute }>("/api/institutes", {
    method: "POST",
    token,
    body: input,
  })
}

export async function updateInstitute(
  token: string,
  id: string,
  input: Partial<Pick<Institute, "name" | "shortCode" | "isActive">>
) {
  return apiRequest<{ institute: Institute }>(`/api/institutes/${id}`, {
    method: "PATCH",
    token,
    body: input,
  })
}

export async function fetchAllSubmissions(token: string, signal?: AbortSignal) {
  return apiRequest<{ submissions: Submission[] }>("/api/submissions", {
    token,
    signal,
  })
}

export async function fetchMySubmissions(token: string, signal?: AbortSignal) {
  return apiRequest<{ submissions: Submission[] }>("/api/submissions/me", {
    token,
    signal,
  })
}

export async function fetchPendingSubmissions(
  token: string,
  signal?: AbortSignal
) {
  return apiRequest<{ submissions: Submission[] }>("/api/submissions/pending", {
    token,
    signal,
  })
}

export async function rejectSubmission(
  token: string,
  id: string,
  reviewNote?: string
) {
  return apiRequest<{ submission: Submission }>(`/api/submissions/${id}/reject`, {
    method: "POST",
    token,
    body: { reviewNote },
  })
}

export async function prepareMintSubmission(
  token: string,
  input: MintSubmissionInput
) {
  return apiRequest<PrepareMintResult>(
    `/api/reviews/${input.submissionId}/prepare-mint`,
    {
      method: "POST",
      token,
      body: {
        eduAmount: input.eduAmount,
        reviewNote: input.reviewNote,
        expiresAt: input.expiresAt ?? undefined,
      },
    }
  )
}

export async function finalizeMintSubmission(
  token: string,
  submissionId: string,
  txHash: string
) {
  return apiRequest<FinalizeMintResult>(
    `/api/reviews/${submissionId}/finalize-mint`,
    {
      method: "POST",
      token,
      body: { txHash },
    }
  )
}

export async function resetStaleMints(token: string) {
  return apiRequest<ResetStaleMintsResult>("/api/reviews/reset-stale-mints", {
    method: "POST",
    token,
  })
}

export async function finalizeCredentialRevocation(
  token: string,
  tokenId: string,
  input: {
    txHash: string
    reason: string
  }
) {
  return apiRequest<RevocationResult>(`/api/credentials/${tokenId}/revoke/finalize`, {
    method: "POST",
    token,
    body: input,
  })
}

export async function fetchVerificationRecord(tokenId: string, signal?: AbortSignal) {
  return apiRequest<{ record: VerificationRecord }>(`/api/verify/${tokenId}`, {
    signal,
  })
}

export async function fetchCollegeLeaderboard(signal?: AbortSignal) {
  return apiRequest<{ colleges: CollegeLeaderboardEntry[] }>(
    "/api/analytics/colleges",
    {
      signal,
    }
  )
}

export async function fetchAnalyticsOverview(signal?: AbortSignal) {
  return apiRequest<{ overview: AnalyticsOverview }>("/api/analytics/overview", {
    signal,
  })
}

export async function fetchPlatformHealth(signal?: AbortSignal) {
  return apiRequest<PlatformHealth>("/api/health", {
    signal,
  })
}

export async function createDisclosurePackage(
  token: string,
  tokenId: string,
  input?: {
    claimKeys?: string[]
    audience?: string
    expiresAt?: string
  }
) {
  return apiRequest<DisclosurePackage>(`/api/credentials/${tokenId}/disclosures`, {
    method: "POST",
    token,
    body: input ?? {},
  })
}

export async function fetchMyDisclosures(token: string, signal?: AbortSignal) {
  return apiRequest<{ disclosures: SavedDisclosureRecord[] }>(
    "/api/credentials/disclosures",
    { token, signal }
  )
}

export async function fetchEvidenceBlob(
  token: string,
  submissionId: string,
  options?: {
    download?: boolean
    signal?: AbortSignal
  }
) {
  const response = await fetchWithTimeout(
    buildBackendUrl(
      `/api/evidence/${submissionId}${options?.download ? "?download=1" : ""}`
    ),
    {
      method: "GET",
      headers: buildHeaders(token),
      cache: "no-store",
      signal: options?.signal,
    }
  )

  if (!response.ok) {
    await parseApiResponse(response, "Could not load evidence")
  }

  return response.blob()
}

export async function analyseEvidence(
  token: string,
  submissionId: string
): Promise<AiInsight> {
  const response = await fetchWithTimeout(
    buildBackendUrl(`/api/evidence/${submissionId}/analyse`),
    {
      method: "POST",
      headers: buildHeaders(token),
      cache: "no-store",
    }
  )

  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string }
    throw new Error(body.error ?? "Certificate analysis failed")
  }

  return response.json() as Promise<AiInsight>
}

export async function uploadCertificate(
  token: string,
  input: UploadSubmissionInput,
  onProgress?: (progress: number) => void
) {
  const formData = new FormData()
  formData.append("certificate", input.certificate)
  formData.append("courseName", input.courseName)
  formData.append("credentialType", input.credentialType)
  formData.append("instituteId", input.instituteId)

  return new Promise<UploadSubmissionResult>((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open("POST", buildBackendUrl("/api/upload"))
    request.responseType = "text"
    request.setRequestHeader("Authorization", `Bearer ${token}`)

    const handleProgress = (event: ProgressEvent<EventTarget>) => {
      if (!event.lengthComputable) {
        return
      }

      onProgress?.(Math.round((event.loaded / event.total) * 100))
    }

    const cleanup = () => {
      request.upload.removeEventListener("progress", handleProgress)
      request.removeEventListener("load", handleLoad)
      request.removeEventListener("error", handleError)
      request.removeEventListener("timeout", handleTimeout)
    }

    const handleLoad = () => {
      cleanup()

      try {
        const rawResponse = typeof request.response === "string"
          ? request.response
          : request.responseText
        const parsedResponse = rawResponse
          ? (JSON.parse(rawResponse) as ApiEnvelope)
          : null

        if (
          request.status < 200 ||
          request.status >= 300 ||
          !parsedResponse ||
          parsedResponse.success === false ||
          !("submission" in parsedResponse)
        ) {
          const errorEnvelope = isApiErrorEnvelope(parsedResponse)
            ? parsedResponse.error
            : undefined

          reject(
            new ApiError(errorEnvelope?.message ?? "Upload failed", {
              status: request.status || 500,
              code: errorEnvelope?.code ?? "UPLOAD_FAILED",
              fieldErrors: errorEnvelope?.fieldErrors,
            })
          )
          return
        }

        onProgress?.(100)
        resolve({ submission: parsedResponse.submission as Submission })
      } catch {
        reject(
          new ApiError("Upload failed", {
            status: request.status || 500,
            code: "UPLOAD_FAILED",
          })
        )
      }
    }

    const handleError = () => {
      cleanup()
      reject(
        new ApiError("Could not reach the backend upload service", {
          status: 0,
          code: "NETWORK_ERROR",
        })
      )
    }

    const handleTimeout = () => {
      cleanup()
      reject(
        new ApiError("Upload timed out — check your connection and try again", {
          status: 0,
          code: "UPLOAD_TIMEOUT",
        })
      )
    }

    request.upload.addEventListener("progress", handleProgress)
    request.addEventListener("load", handleLoad)
    request.addEventListener("error", handleError)
    request.addEventListener("timeout", handleTimeout)

    request.timeout = 120_000
    request.send(formData)
  })
}
