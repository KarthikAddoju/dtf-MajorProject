"use client"

import { AuthProvider, useAuth } from "@/components/AuthProvider"
import { Navbar } from "@/components/Navbar"
import { useBlockNumber } from "@/hooks/use-block-number"

function ClientShell({
  children,
}: {
  children: React.ReactNode
}) {
  const {
    authFlowState,
    chainId,
    connectAndSignIn,
    connectedWalletAddress,
    hasWalletProvider,
    isAuthenticated,
    isAuthenticating,
    isSupportedNetwork,
    logout,
    user,
    walletNote,
    walletWarning,
  } = useAuth()

  const { blockNumber, isLive: isChainLive } = useBlockNumber()

  return (
    <>
      <Navbar
        walletAddress={user?.address ?? connectedWalletAddress}
        chainId={chainId}
        hasWalletProvider={hasWalletProvider}
        user={user}
        isAuthenticated={isAuthenticated}
        isSupportedNetwork={isSupportedNetwork}
        isBusy={isAuthenticating}
        authFlowState={authFlowState}
        walletNote={walletNote}
        walletWarning={walletWarning}
        onConnectWallet={connectAndSignIn}
        onLogout={logout}
        blockNumber={blockNumber}
        isChainLive={isChainLive}
      />

      {children}
    </>
  )
}

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthProvider>
      <ClientShell>{children}</ClientShell>
    </AuthProvider>
  )
}
