export const BACKEND_BASE_URL =
  (process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000").replace(
    /\/$/,
    ""
  )

export const APP_BASE_URL =
  (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "")

export const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL ?? "http://127.0.0.1:8545"

export const POCT_ADDRESS =
  process.env.NEXT_PUBLIC_POCT_ADDRESS ??
  "0x5FbDB2315678afecb367f032d93F642f64180aa3"

export const EDU_ADDRESS =
  process.env.NEXT_PUBLIC_EDU_ADDRESS ??
  "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"

export function buildBackendUrl(pathname: string) {
  return `${BACKEND_BASE_URL}${pathname.startsWith("/") ? pathname : `/${pathname}`}`
}

export function buildAppUrl(pathname: string) {
  return `${APP_BASE_URL}${pathname.startsWith("/") ? pathname : `/${pathname}`}`
}
