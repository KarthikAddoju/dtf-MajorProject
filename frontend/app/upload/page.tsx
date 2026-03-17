"use client"

import Link from "next/link"
import {
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { toast } from "sonner"
import { PageLayout } from "@/components/PageLayout"
import { RoleBadge } from "@/components/RoleBadge"
import { WalletBadge } from "@/components/WalletBadge"
import { useAuth } from "@/components/AuthProvider"
import {
  fetchInstitutes,
  fetchMySubmissions,
  isAbortError,
  uploadCertificate,
} from "@/lib/api"
import type { Institute, Submission, SubmissionStatus } from "@/lib/types"

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024
const ACCEPTED_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
])

function formatDate(value: string | null) {
  if (!value) {
    return "Not available"
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

function truncateValue(value: string, start = 10, end = 8) {
  if (value.length <= start + end) {
    return value
  }

  return `${value.slice(0, start)}...${value.slice(-end)}`
}

function getStatusClasses(status: SubmissionStatus) {
  switch (status) {
    case "minted":
      return "border-[#77997f]/24 bg-[#77997f]/10 text-[#d7ebd8]"
    case "rejected":
      return "border-rose-500/24 bg-rose-500/10 text-[#f5c0d0]"
    default:
      return "border-[#f0c57f]/24 bg-[#f0c57f]/10 text-[#fde4b8]"
  }
}

function getStatusLabel(status: SubmissionStatus) {
  switch (status) {
    case "pending_review":
      return "Pending Review"
    case "minted":
      return "Minted"
    case "rejected":
      return "Rejected"
  }
}

function validateFile(file: File) {
  if (!ACCEPTED_MIME_TYPES.has(file.type)) {
    return "Upload a PDF, PNG, or JPEG certificate file."
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return "Certificate files must be 10 MB or smaller."
  }

  return null
}

export default function UploadPage() {
  const {
    connectAndSignIn,
    connectedWalletAddress,
    isAuthenticated,
    isAuthenticating,
    isReady,
    token,
    user,
  } = useAuth()
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [institutes, setInstitutes] = useState<Institute[]>([])
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [courseName, setCourseName] = useState("")
  const [instituteId, setInstituteId] = useState("")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isLoadingInstitutes, setIsLoadingInstitutes] = useState(true)
  const [isLoadingSubmissions, setIsLoadingSubmissions] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    async function loadInstitutes() {
      try {
        setIsLoadingInstitutes(true)
        const response = await fetchInstitutes(controller.signal)

        if (controller.signal.aborted) {
          return
        }

        setInstitutes(response.institutes)
        setInstituteId((currentInstituteId) => {
          if (currentInstituteId) {
            return currentInstituteId
          }

          return response.institutes[0]?.id ?? ""
        })
      } catch (error) {
        if (controller.signal.aborted || isAbortError(error)) {
          return
        }

        const message =
          error instanceof Error ? error.message : "Could not load institutes"
        setErrorMessage(message)
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingInstitutes(false)
        }
      }
    }

    loadInstitutes()

    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!token) {
      setSubmissions([])
      return
    }

    const controller = new AbortController()
    const authToken = token

    async function loadSubmissions() {
      try {
        setIsLoadingSubmissions(true)
        const response = await fetchMySubmissions(authToken, controller.signal)

        if (controller.signal.aborted) {
          return
        }

        setSubmissions(response.submissions)
      } catch (error) {
        if (controller.signal.aborted || isAbortError(error)) {
          return
        }

        const message =
          error instanceof Error
            ? error.message
            : "Could not load your submission history"
        toast.error(message)
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingSubmissions(false)
        }
      }
    }

    loadSubmissions()

    return () => controller.abort()
  }, [token])

  function assignFile(file: File | null) {
    if (!file) {
      setSelectedFile(null)
      setErrorMessage(null)
      return
    }

    const validationMessage = validateFile(file)

    if (validationMessage) {
      setSelectedFile(null)
      setErrorMessage(validationMessage)
      toast.error(validationMessage)
      return
    }

    setSelectedFile(file)
    setErrorMessage(null)
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    assignFile(event.target.files?.[0] ?? null)
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsDragging(false)
    assignFile(event.dataTransfer.files?.[0] ?? null)
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsDragging(true)
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsDragging(false)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!token) {
      toast.error("Connect your wallet and sign in before uploading.")
      return
    }

    const authToken = token

    if (!courseName.trim()) {
      setErrorMessage("Enter the course name before uploading.")
      return
    }

    if (!instituteId) {
      setErrorMessage("Select an institute before uploading.")
      return
    }

    if (!selectedFile) {
      setErrorMessage("Drag in a certificate file or choose one from your system.")
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)
    setUploadProgress(0)

    try {
      const response = await uploadCertificate(
        authToken,
        {
          certificate: selectedFile,
          courseName: courseName.trim(),
          instituteId,
        },
        setUploadProgress
      )

      setSubmissions((currentSubmissions) => [
        response.submission,
        ...currentSubmissions,
      ])
      setCourseName("")
      setSelectedFile(null)
      setUploadProgress(0)

      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }

      toast.success("Certificate uploaded to IPFS and queued for admin review.")
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Upload failed unexpectedly"
      setErrorMessage(message)
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const selectedInstitute = useMemo(
    () => institutes.find((institute) => institute.id === instituteId) ?? null,
    [instituteId, institutes]
  )
  const readinessChecks = useMemo(
    () => [
      {
        label: "Wallet connected",
        ready: !!connectedWalletAddress,
        detail: connectedWalletAddress
          ? truncateValue(connectedWalletAddress, 10, 8)
          : "Connect MetaMask",
      },
      {
        label: "Signed session",
        ready: isAuthenticated,
        detail: isAuthenticated ? "Authenticated for upload" : "Sign in required",
      },
      {
        label: "Course title",
        ready: !!courseName.trim(),
        detail: courseName.trim() || "Add the credential title",
      },
      {
        label: "Institute selected",
        ready: !!selectedInstitute,
        detail: selectedInstitute
          ? `${selectedInstitute.name} (${selectedInstitute.shortCode})`
          : "Choose an institute",
      },
      {
        label: "Evidence file",
        ready: !!selectedFile,
        detail: selectedFile
          ? `${selectedFile.name} • ${(selectedFile.size / 1024 / 1024).toFixed(2)} MB`
          : "Attach a PDF, PNG, or JPEG file",
      },
    ],
    [
      connectedWalletAddress,
      courseName,
      isAuthenticated,
      selectedFile,
      selectedInstitute,
    ]
  )

  return (
    <PageLayout>
      <section className="mb-8 grid gap-8 xl:grid-cols-[1.08fr_0.92fr]">
        <div className="brand-panel-light px-8 py-9 sm:px-10">
          <div className="brand-kicker">Submission Studio</div>
          <div className="mt-6 text-[11px] uppercase tracking-[0.34em] text-[#4f5966]">
            Student / Upload / Evidence intake
          </div>
          <h1 className="display-serif mt-4 max-w-4xl text-5xl font-semibold leading-[0.95] text-[#101828] sm:text-6xl">
            Turn a certificate file into a verified credential candidate.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-[#243246]">
            This workspace binds your certificate to wallet identity, institute
            context, and a persistent review record before it ever reaches the mint
            controller.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            {user ? (
              <>
                <RoleBadge role={user.role} />
                <WalletBadge address={user.address} label="Signed Session" />
              </>
            ) : connectedWalletAddress ? (
              <WalletBadge address={connectedWalletAddress} label="Connected Wallet" />
            ) : (
              <span className="brand-chip-light">Guest session</span>
            )}
            <span className="brand-chip-light">
              IPFS Storage
            </span>
            <span className="brand-chip-light">MongoDB Workflow</span>
          </div>
        </div>

        <div className="brand-panel p-7">
          <div className="text-[11px] uppercase tracking-[0.3em] text-[#8bbbd5]">
            Submission Architecture
          </div>
          <h2 className="display-serif mt-2 text-[2.1rem] font-semibold text-[#f7efe3]">
            A traceable flow from file to public proof.
          </h2>
          <div className="mt-6 grid gap-3">
            {[
              "Upload the original evidence file from your local system.",
              "Attach the right course title and institute before submission.",
              "Create an IPFS-backed record that enters the admin review queue.",
              "Track approval, mint outcome, token ID, and EDU reward live.",
            ].map((step, index) => (
              <div
                key={step}
                className="grid gap-3 rounded-[22px_12px_22px_12px] border border-[#eedfce]/10 bg-[rgba(255,255,255,0.03)] p-4 sm:grid-cols-[40px_1fr]"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-[15px] bg-[#f2e7d7] text-sm font-semibold text-[#101828]">
                  {index + 1}
                </div>
                <p className="self-center text-[#d8e0ec]">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {!isReady ? (
        <div className="brand-panel mb-8 p-8">
          <div className="py-12 text-center text-[#c8d0de]">
            Restoring your DACS session...
          </div>
        </div>
      ) : null}

      {isReady && !isAuthenticated ? (
        <div className="brand-panel mb-8 p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="display-serif mb-2 text-[2rem] font-semibold text-[#f7efe3]">
                Wallet sign-in is required for certificate upload
              </h2>
              <p className="max-w-2xl text-[#c8d0de]">
                Uploads are bound to your wallet identity so the backend can store a
                real student submission record and the admin can mint directly to the
                correct address.
              </p>
            </div>
            <button
              onClick={() => void connectAndSignIn()}
              disabled={isAuthenticating}
              className="brand-button-primary px-6 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isAuthenticating ? "Connecting..." : "Connect & Sign In"}
            </button>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="brand-panel-light px-7 py-7 sm:px-8">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-[0.3em] text-[#6f563f]">
                Intake Sheet
              </div>
              <h2 className="display-serif mt-2 text-[2.3rem] font-semibold text-[#101828]">
                Submit a new certificate
              </h2>
            </div>
            <div className="brand-chip-light">
              {selectedInstitute
                ? `${selectedInstitute.shortCode} selected`
                : "Choose institute"}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label
                  htmlFor="courseName"
                  className="mb-2 block text-sm font-medium text-[#475569]"
                >
                  Course Name
                </label>
                <input
                  id="courseName"
                  type="text"
                  value={courseName}
                  onChange={(event) => setCourseName(event.target.value)}
                  placeholder="Advanced Machine Learning"
                  className="brand-input"
                />
              </div>

              <div>
                <label
                  htmlFor="instituteId"
                  className="mb-2 block text-sm font-medium text-[#475569]"
                >
                  Institute
                </label>
                <select
                  id="instituteId"
                  value={instituteId}
                  onChange={(event) => setInstituteId(event.target.value)}
                  disabled={isLoadingInstitutes}
                  className="brand-input"
                >
                  <option value="">
                    {isLoadingInstitutes ? "Loading institutes..." : "Select an institute"}
                  </option>
                  {institutes.map((institute) => (
                    <option key={institute.id} value={institute.id}>
                      {institute.name} ({institute.shortCode})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-[#475569]">
                Certificate File
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={handleFileChange}
                className="hidden"
              />

              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={`cursor-pointer rounded-[34px_18px_34px_18px] border border-dashed px-6 py-14 text-center transition ${
                  isDragging
                    ? "border-[#d25b36]/55 bg-[rgba(210,91,54,0.08)]"
                    : "border-[#101828]/18 bg-[rgba(255,255,255,0.82)] hover:border-[#d25b36]/45 hover:bg-[rgba(255,255,255,0.92)]"
                }`}
              >
                <div className="mx-auto mb-5 flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-[24px] border border-[#101828]/10 bg-[linear-gradient(145deg,rgba(210,91,54,0.14),rgba(131,188,217,0.16))] text-[#3f5065]">
                  <svg
                    className="h-8 w-8"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.8}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                </div>
                <h3 className="display-serif mb-2 text-[2rem] font-semibold text-[#101828]">
                  Drop your evidence file here
                </h3>
                <p className="text-[#243246]">
                  Click to browse your system or drag in a PDF, PNG, or JPEG.
                </p>
                <p className="mt-3 text-xs uppercase tracking-[0.32em] text-[#7a7063]">
                  Max 10 MB
                </p>
              </div>
            </div>

            {selectedFile ? (
              <div className="rounded-[22px_12px_22px_12px] border border-[#101828]/12 bg-[rgba(255,255,255,0.88)] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="font-medium text-[#101828]">{selectedFile.name}</div>
                    <div className="text-sm text-[#425168]">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      assignFile(null)
                      if (fileInputRef.current) {
                        fileInputRef.current.value = ""
                      }
                    }}
                    className="rounded-full border border-[#101828]/12 px-4 py-2 text-sm text-[#334155] transition hover:bg-white/70"
                  >
                    Remove File
                  </button>
                </div>
              </div>
            ) : null}

            {isSubmitting ? (
              <div className="rounded-[22px_12px_22px_12px] border border-[#8bbbd5]/25 bg-[#8bbbd5]/10 p-4">
                <div className="mb-2 flex items-center justify-between text-sm text-[#345166]">
                  <span>Uploading to IPFS and creating your submission</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[#d5dbe5]">
                  <div
                    className="h-full rounded-full bg-[linear-gradient(90deg,#d25b36,#8bbbd5)] transition-all"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            ) : null}

            {errorMessage ? (
              <div className="rounded-[20px] border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-[#8e314c]">
                {errorMessage}
              </div>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="submit"
                disabled={
                  !isAuthenticated ||
                  isSubmitting ||
                  !selectedFile ||
                  !courseName.trim() ||
                  !instituteId
                }
                className="brand-button-primary flex-1 px-6 py-4 text-base disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Submitting..." : "Submit Certificate"}
              </button>
              <Link
                href="/verify"
                className="brand-button-secondary px-6 py-4 text-center text-base"
              >
                Public Verify Portal
              </Link>
            </div>
          </form>
        </div>

        <div className="space-y-8">
          <div className="brand-panel p-7">
            <div className="mb-5">
              <div className="text-[11px] uppercase tracking-[0.3em] text-[#8bbbd5]">
                Submission Readiness
              </div>
              <h2 className="display-serif mt-2 text-[2rem] font-semibold text-[#f7efe3]">
                Pre-flight checklist
              </h2>
            </div>
            <div className="space-y-4">
              <div className="rounded-[22px_12px_22px_12px] border border-[#eedfce]/10 bg-[rgba(255,255,255,0.03)] p-4">
                <div className="text-sm text-[#8ea0b8]">Current Progress</div>
                <div className="mt-2 text-[#f7efe3]">
                  {readinessChecks.filter((check) => check.ready).length} of{" "}
                  {readinessChecks.length} steps ready for submission
                </div>
              </div>

              <div className="space-y-3">
                {readinessChecks.map((check) => (
                  <div
                    key={check.label}
                    className="rounded-[22px_12px_22px_12px] border border-[#eedfce]/10 bg-[rgba(255,255,255,0.03)] p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="font-medium text-[#f7efe3]">{check.label}</div>
                        <div className="mt-1 text-sm text-[#b0bccd]">{check.detail}</div>
                      </div>
                      <div
                        className={`rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] ${
                          check.ready
                            ? "border-[#77997f]/24 bg-[#77997f]/10 text-[#d7ebd8]"
                            : "border-[#f0c57f]/24 bg-[#f0c57f]/10 text-[#fde4b8]"
                        }`}
                      >
                        {check.ready ? "Ready" : "Pending"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-[22px_12px_22px_12px] border border-[#eedfce]/10 bg-[rgba(255,255,255,0.03)] p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-[#8ea0b8]">
                  What Happens Next
                </div>
                <div className="mt-3 space-y-3 text-sm text-[#d8e0ec]">
                  <div>1. Your file is uploaded to IPFS and linked to your wallet.</div>
                  <div>2. The submission enters the institute review queue.</div>
                  <div>3. Once approved, DACS mints the credential NFT and EDU reward.</div>
                </div>
              </div>
            </div>
          </div>

          <div className="brand-panel p-7">
            <div className="mb-5 flex flex-col gap-2">
              <div className="text-[11px] uppercase tracking-[0.3em] text-[#f5c88a]">
                Submission Ledger
              </div>
              <h2 className="display-serif text-[2rem] font-semibold text-[#f7efe3]">
                Queue snapshot
              </h2>
            </div>
            <div className="space-y-4">
              <div className="rounded-[22px_12px_22px_12px] border border-[#eedfce]/10 bg-[rgba(255,255,255,0.03)] p-4">
                <div className="text-sm text-[#8ea0b8]">Workflow</div>
                <div className="mt-2 text-[#f7efe3]">
                  Upload <span className="text-slate-500">→</span> IPFS{" "}
                  <span className="text-slate-500">→</span> Admin Review{" "}
                  <span className="text-slate-500">→</span> NFT + EDU Mint
                </div>
              </div>

              {isLoadingSubmissions ? (
                <div className="rounded-[22px_12px_22px_12px] border border-[#eedfce]/10 bg-[rgba(255,255,255,0.03)] p-6 text-center text-[#c8d0de]">
                  Loading your submissions...
                </div>
              ) : submissions.length === 0 ? (
                <div className="rounded-[22px_12px_22px_12px] border border-[#eedfce]/10 bg-[rgba(255,255,255,0.03)] p-6 text-center">
                  <h3 className="mb-2 display-serif text-[1.8rem] font-semibold text-[#f7efe3]">
                    No submissions yet
                  </h3>
                  <p className="text-[#b0bccd]">
                    Your first upload will appear here with its review status, CID,
                    and minting details.
                  </p>
                </div>
              ) : (
                submissions.map((submission) => (
                  <div
                    key={submission.id}
                    className="rounded-[24px_12px_24px_12px] border border-[#eedfce]/10 bg-[rgba(255,255,255,0.03)] p-5"
                  >
                    <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="display-serif text-[1.7rem] font-semibold text-[#f7efe3]">
                          {submission.courseName}
                        </h3>
                        <p className="text-sm text-[#b0bccd]">
                          {submission.instituteName}
                        </p>
                      </div>
                      <span
                        className={`inline-flex w-fit rounded-full border px-3 py-1 text-xs font-medium ${getStatusClasses(submission.status)}`}
                      >
                        {getStatusLabel(submission.status)}
                      </span>
                    </div>

                    <dl className="space-y-2 text-sm text-[#d8e0ec]">
                      <div className="flex items-center justify-between gap-4">
                        <dt className="text-[#8ea0b8]">CID</dt>
                        <dd className="font-mono text-right text-[#d5e7f1]">
                          {truncateValue(submission.cid)}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <dt className="text-[#8ea0b8]">Uploaded</dt>
                        <dd>{formatDate(submission.uploadedAt)}</dd>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <dt className="text-[#8ea0b8]">Token ID</dt>
                        <dd>{submission.tokenId ? `#${submission.tokenId}` : "Pending"}</dd>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <dt className="text-[#8ea0b8]">EDU Reward</dt>
                        <dd>
                          {submission.eduAmount !== null
                            ? `${submission.eduAmount.toLocaleString()} EDU`
                            : "Pending"}
                        </dd>
                      </div>
                    </dl>

                    <div className="mt-4 flex flex-wrap gap-3">
                      <a
                        href={submission.ipfsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="brand-button-secondary px-4 py-2.5 text-sm"
                      >
                        Open IPFS File
                      </a>
                      {submission.tokenId ? (
                        <Link
                          href={`/verify?tokenId=${submission.tokenId}`}
                          className="brand-button-primary px-4 py-2.5 text-sm"
                        >
                          Verify Public Record
                        </Link>
                      ) : null}
                    </div>

                    {submission.reviewNote ? (
                      <div className="mt-4 rounded-[18px] border border-[#eedfce]/10 bg-[rgba(255,255,255,0.03)] p-3 text-sm text-[#d8e0ec]">
                        <span className="text-[#8ea0b8]">Admin Note:</span>{" "}
                        {submission.reviewNote}
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  )
}
