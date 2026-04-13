import { beforeEach, describe, expect, it, jest } from "@jest/globals";

const getNetworkMock = jest.fn();
const getBlockNumberMock = jest.fn();
const getCodeMock = jest.fn();

jest.mock("../services/blockchain", () => ({
  eduAddress: "0x0000000000000000000000000000000000000002",
  mintControllerAddress: "0x0000000000000000000000000000000000000003",
  poctAddress: "0x0000000000000000000000000000000000000001",
  provider: {
    getNetwork: getNetworkMock,
    getBlockNumber: getBlockNumberMock,
    getCode: getCodeMock,
  },
}));

import { getBlockchainReadiness } from "../lib/blockchainReadiness";

describe("getBlockchainReadiness", () => {
  beforeEach(() => {
    getNetworkMock.mockReset();
    getBlockNumberMock.mockReset();
    getCodeMock.mockReset();
  });

  it("reports a healthy chain when RPC and contract code are available", async () => {
    (getNetworkMock as any).mockResolvedValue({ chainId: 31337n });
    (getBlockNumberMock as any).mockResolvedValue(123456);
    (getCodeMock as any).mockResolvedValue("0x1234");

    const readiness = await getBlockchainReadiness();

    expect(readiness).toEqual(
      expect.objectContaining({
        status: "connected",
        chainId: 31337,
        blockNumber: 123456,
        contractsReady: true,
        warnings: [],
        contracts: expect.objectContaining({
          poctDeployed: true,
          eduDeployed: true,
          mintControllerDeployed: true,
        }),
      })
    );
  });

  it("reports a degraded chain when the RPC is unavailable", async () => {
    (getNetworkMock as any).mockRejectedValue(new Error("rpc offline"));
    (getBlockNumberMock as any).mockResolvedValue(123456);

    const readiness = await getBlockchainReadiness();

    expect(readiness.status).toBe("degraded");
    expect(readiness.chainId).toBeNull();
    expect(readiness.blockNumber).toBeNull();
    expect(readiness.contractsReady).toBe(false);
    expect(readiness.warnings[0]).toContain("Could not reach the configured RPC endpoint");
    expect(readiness.contracts).toEqual(
      expect.objectContaining({
        poctDeployed: false,
        eduDeployed: false,
        mintControllerDeployed: false,
      })
    );
  });

  it("reports a degraded chain when contract code is missing", async () => {
    (getNetworkMock as any).mockResolvedValue({ chainId: 31337n });
    (getBlockNumberMock as any).mockResolvedValue(123456);
    (getCodeMock as any)
      .mockResolvedValueOnce("0x")
      .mockResolvedValueOnce("0x1234")
      .mockResolvedValueOnce("0x1234");

    const readiness = await getBlockchainReadiness();

    expect(readiness.status).toBe("degraded");
    expect(readiness.contractsReady).toBe(false);
    expect(readiness.contracts.poctDeployed).toBe(false);
    expect(readiness.contracts.eduDeployed).toBe(true);
    expect(readiness.contracts.mintControllerDeployed).toBe(true);
    expect(readiness.warnings).toContain(
      "No contract code found at POCT_ADDRESS (0x0000000000000000000000000000000000000001) on chain 31337."
    );
  });
});
