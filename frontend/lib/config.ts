const publicEnv = {
  NEXT_PUBLIC_BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_RPC_URL: process.env.NEXT_PUBLIC_RPC_URL,
  NEXT_PUBLIC_CHAIN_ID: process.env.NEXT_PUBLIC_CHAIN_ID,
  NEXT_PUBLIC_POCT_ADDRESS: process.env.NEXT_PUBLIC_POCT_ADDRESS,
  NEXT_PUBLIC_EDU_ADDRESS: process.env.NEXT_PUBLIC_EDU_ADDRESS,
  NEXT_PUBLIC_MINT_CONTROLLER_ADDRESS:
    process.env.NEXT_PUBLIC_MINT_CONTROLLER_ADDRESS,
} as const

function requirePublicEnv(name: keyof typeof publicEnv) {
  const value = publicEnv[name]?.trim()

  if (!value) {
    throw new Error(`Missing required frontend environment variable: ${name}`)
  }

  return value
}

export const BACKEND_BASE_URL =
  (publicEnv.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000").replace(
    /\/$/,
    ""
  )

export const APP_BASE_URL =
  (publicEnv.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "")

export const RPC_URL = requirePublicEnv("NEXT_PUBLIC_RPC_URL")

export const CHAIN_ID = Number.parseInt(
  requirePublicEnv("NEXT_PUBLIC_CHAIN_ID"),
  10
)

if (!Number.isInteger(CHAIN_ID) || CHAIN_ID <= 0) {
  throw new Error("NEXT_PUBLIC_CHAIN_ID must be a positive integer")
}

export const POCT_ADDRESS = requirePublicEnv("NEXT_PUBLIC_POCT_ADDRESS")

export const EDU_ADDRESS = requirePublicEnv("NEXT_PUBLIC_EDU_ADDRESS")

export const MINT_CONTROLLER_ADDRESS = requirePublicEnv(
  "NEXT_PUBLIC_MINT_CONTROLLER_ADDRESS"
)

export function buildBackendUrl(pathname: string) {
  return `${BACKEND_BASE_URL}${pathname.startsWith("/") ? pathname : `/${pathname}`}`
}

export function buildAppUrl(pathname: string) {
  return `${APP_BASE_URL}${pathname.startsWith("/") ? pathname : `/${pathname}`}`
}
