import { expect } from "chai";
import { ethers } from "hardhat";
import type { PoCT, EDUToken, MintController } from "../typechain-types";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const INSTITUTE_HASH = ethers.keccak256(
  ethers.toUtf8Bytes("DACS_INSTITUTE:TEST")
);
const SECOND_INSTITUTE_HASH = ethers.keccak256(
  ethers.toUtf8Bytes("DACS_INSTITUTE:SECOND")
);
const CLAIMS_ROOT = ethers.keccak256(ethers.toUtf8Bytes("test-claims-root"));
const PROOF_CID = "QmTestProofCID123456";
const REASON = "Policy violation";
const REASON_HASH = ethers.id(REASON);
const EDU_AMOUNT = ethers.parseEther("100");
const FUTURE_EXPIRES = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60; // 1 year
const NO_EXPIRY = 0;

// ─── Suite ───────────────────────────────────────────────────────────────────

describe("DACS Contracts", function () {
  let poct: PoCT;
  let edu: EDUToken;
  let controller: MintController;
  let owner: HardhatEthersSigner;
  let verifier: HardhatEthersSigner;
  let student: HardhatEthersSigner;
  let stranger: HardhatEthersSigner;

  beforeEach(async function () {
    [owner, verifier, student, stranger] = await ethers.getSigners();

    const PoCTFactory = await ethers.getContractFactory("PoCT");
    poct = (await PoCTFactory.deploy()) as unknown as PoCT;

    const EDUFactory = await ethers.getContractFactory("EDUToken");
    edu = (await EDUFactory.deploy()) as unknown as EDUToken;

    const ControllerFactory = await ethers.getContractFactory("MintController");
    controller = (await ControllerFactory.deploy(
      owner.address,
      await poct.getAddress(),
      await edu.getAddress()
    )) as unknown as MintController;

    await poct.setMintController(await controller.getAddress());
    await edu.setMintController(await controller.getAddress());
  });

  // ─── PoCT ───────────────────────────────────────────────────────────────

  describe("PoCT", function () {
    describe("setMintController", function () {
      it("emits MintControllerUpdated event", async function () {
        const newAddress = stranger.address;
        await expect(poct.setMintController(newAddress))
          .to.emit(poct, "MintControllerUpdated")
          .withArgs(await controller.getAddress(), newAddress);
      });

      it("reverts on zero address", async function () {
        await expect(
          poct.setMintController(ethers.ZeroAddress)
        ).to.be.revertedWith("PoCT: controller is zero address");
      });

      it("reverts when called by non-owner", async function () {
        await expect(
          poct.connect(stranger).setMintController(stranger.address)
        ).to.be.reverted;
      });
    });

    describe("soulbound enforcement", function () {
      let tokenId: bigint;

      beforeEach(async function () {
        await controller.setInstituteVerifier(
          INSTITUTE_HASH,
          verifier.address,
          true
        );
        const tx = await controller
          .connect(verifier)
          .dualMint(
            student.address,
            PROOF_CID,
            CLAIMS_ROOT,
            INSTITUTE_HASH,
            EDU_AMOUNT,
            NO_EXPIRY
          );
        const receipt = await tx.wait();
        const event = receipt?.logs
          .map((log) => {
            try {
              return controller.interface.parseLog(log);
            } catch {
              return null;
            }
          })
          .find((e) => e?.name === "DualMinted");
        tokenId = event?.args?.poctTokenId as bigint;
      });

      it("blocks safeTransferFrom between wallets", async function () {
        await expect(
          poct
            .connect(student)
            .safeTransferFrom(student.address, stranger.address, tokenId)
        ).to.be.revertedWithCustomError(poct, "SoulboundTransferNotAllowed");
      });

      it("blocks transferFrom between wallets", async function () {
        await expect(
          poct
            .connect(student)
            .transferFrom(student.address, stranger.address, tokenId)
        ).to.be.revertedWithCustomError(poct, "SoulboundTransferNotAllowed");
      });

      it("allows mint (zero -> student)", async function () {
        expect(await poct.ownerOf(tokenId)).to.equal(student.address);
      });
    });

    describe("expiry validation", function () {
      beforeEach(async function () {
        await controller.setInstituteVerifier(
          INSTITUTE_HASH,
          verifier.address,
          true
        );
      });

      it("allows minting with a future expiry", async function () {
        await expect(
          controller
            .connect(verifier)
            .dualMint(
              student.address,
              PROOF_CID,
              CLAIMS_ROOT,
              INSTITUTE_HASH,
              EDU_AMOUNT,
              FUTURE_EXPIRES
            )
        ).to.not.be.reverted;
      });

      it("allows minting with zero expiry (no expiry)", async function () {
        await expect(
          controller
            .connect(verifier)
            .dualMint(
              student.address,
              PROOF_CID,
              CLAIMS_ROOT,
              INSTITUTE_HASH,
              EDU_AMOUNT,
              NO_EXPIRY
            )
        ).to.not.be.reverted;
      });

      it("reverts when expiresAt is in the past", async function () {
        const pastExpiry = Math.floor(Date.now() / 1000) - 3600;
        await expect(
          controller
            .connect(verifier)
            .dualMint(
              student.address,
              PROOF_CID,
              CLAIMS_ROOT,
              INSTITUTE_HASH,
              EDU_AMOUNT,
              pastExpiry
            )
        ).to.be.revertedWith("PoCT: expiresAt must be zero or in the future");
      });
    });
  });

  // ─── EDUToken ────────────────────────────────────────────────────────────

  describe("EDUToken", function () {
    it("emits MintControllerUpdated event on setMintController", async function () {
      const newAddress = stranger.address;
      await expect(edu.setMintController(newAddress))
        .to.emit(edu, "MintControllerUpdated")
        .withArgs(await controller.getAddress(), newAddress);
    });

    it("enforces MAX_SUPPLY cap", async function () {
      const MAX_SUPPLY = await edu.MAX_SUPPLY();
      const controllerAddr = await controller.getAddress();

      // Temporarily give owner direct minting access for this test
      const EDUFactory = await ethers.getContractFactory("EDUToken");
      const freshEdu = await EDUFactory.deploy();
      await freshEdu.setMintController(owner.address);

      // Mint up to MAX_SUPPLY - 1 EDU
      await freshEdu.connect(owner).mint(stranger.address, MAX_SUPPLY - 1n);

      // The next mint of 2 EDU should fail
      await expect(
        freshEdu.connect(owner).mint(stranger.address, 2n)
      ).to.be.revertedWith("EDUToken: supply cap exceeded");

      // But minting exactly 1 more should succeed
      await expect(freshEdu.connect(owner).mint(stranger.address, 1n)).to.not
        .be.reverted;
      void controllerAddr;
    });

    it("reverts when called by non-controller", async function () {
      await expect(
        edu.connect(stranger).mint(stranger.address, EDU_AMOUNT)
      ).to.be.revertedWith("EDUToken: caller is not the controller");
    });
  });

  // ─── MintController ──────────────────────────────────────────────────────

  describe("MintController", function () {
    describe("verifier role accounting", function () {
      it("grants verifier and revocation roles on the first institute approval", async function () {
        const verifierRole = await controller.VERIFIER_ROLE();
        const revocationRole = await controller.REVOCATION_ROLE();

        expect(await controller.hasRole(verifierRole, verifier.address)).to.equal(
          false
        );
        expect(
          await controller.hasRole(revocationRole, verifier.address)
        ).to.equal(false);

        await controller.setInstituteVerifier(
          INSTITUTE_HASH,
          verifier.address,
          true
        );

        expect(await controller.hasRole(verifierRole, verifier.address)).to.equal(
          true
        );
        expect(
          await controller.hasRole(revocationRole, verifier.address)
        ).to.equal(true);
      });

      it("keeps role accounting idempotent when the same institute is re-approved", async function () {
        const verifierRole = await controller.VERIFIER_ROLE();
        const revocationRole = await controller.REVOCATION_ROLE();

        await controller.setInstituteVerifier(
          INSTITUTE_HASH,
          verifier.address,
          true
        );
        await controller.setInstituteVerifier(
          INSTITUTE_HASH,
          verifier.address,
          true
        );
        await controller.setInstituteVerifier(
          INSTITUTE_HASH,
          verifier.address,
          false
        );

        expect(await controller.hasRole(verifierRole, verifier.address)).to.equal(
          false
        );
        expect(
          await controller.hasRole(revocationRole, verifier.address)
        ).to.equal(false);
      });

      it("keeps roles active when one of two approved institutes is removed", async function () {
        const verifierRole = await controller.VERIFIER_ROLE();
        const revocationRole = await controller.REVOCATION_ROLE();

        await controller.setInstituteVerifier(
          INSTITUTE_HASH,
          verifier.address,
          true
        );
        await controller.setInstituteVerifier(
          SECOND_INSTITUTE_HASH,
          verifier.address,
          true
        );
        await controller.setInstituteVerifier(
          INSTITUTE_HASH,
          verifier.address,
          false
        );

        expect(await controller.hasRole(verifierRole, verifier.address)).to.equal(
          true
        );
        expect(
          await controller.hasRole(revocationRole, verifier.address)
        ).to.equal(true);
        expect(
          await controller.instituteVerifiers(SECOND_INSTITUTE_HASH, verifier.address)
        ).to.equal(true);
      });

      it("revokes verifier and revocation roles from a non-admin after the last approval is removed", async function () {
        const verifierRole = await controller.VERIFIER_ROLE();
        const revocationRole = await controller.REVOCATION_ROLE();

        await controller.setInstituteVerifier(
          INSTITUTE_HASH,
          verifier.address,
          true
        );
        await controller.setInstituteVerifier(
          INSTITUTE_HASH,
          verifier.address,
          false
        );

        expect(await controller.hasRole(verifierRole, verifier.address)).to.equal(
          false
        );
        expect(
          await controller.hasRole(revocationRole, verifier.address)
        ).to.equal(false);
      });

      it("does not auto-revoke reviewer or revocation roles from the admin", async function () {
        const verifierRole = await controller.VERIFIER_ROLE();
        const revocationRole = await controller.REVOCATION_ROLE();

        await controller.setInstituteVerifier(
          INSTITUTE_HASH,
          owner.address,
          true
        );
        await controller.setInstituteVerifier(
          INSTITUTE_HASH,
          owner.address,
          false
        );

        expect(await controller.hasRole(verifierRole, owner.address)).to.equal(
          true
        );
        expect(await controller.hasRole(revocationRole, owner.address)).to.equal(
          true
        );
      });

      it("blocks minting and revocation for a verifier after institute deauthorization", async function () {
        await controller.setInstituteVerifier(
          INSTITUTE_HASH,
          verifier.address,
          true
        );

        const mintTx = await controller
          .connect(verifier)
          .dualMint(
            student.address,
            PROOF_CID,
            CLAIMS_ROOT,
            INSTITUTE_HASH,
            EDU_AMOUNT,
            NO_EXPIRY
          );
        const mintReceipt = await mintTx.wait();
        const mintEvent = mintReceipt?.logs
          .map((log) => {
            try {
              return controller.interface.parseLog(log);
            } catch {
              return null;
            }
          })
          .find((event) => event?.name === "DualMinted");
        const tokenId = mintEvent?.args?.poctTokenId as bigint;

        await controller.setInstituteVerifier(
          INSTITUTE_HASH,
          verifier.address,
          false
        );

        await expect(
          controller
            .connect(verifier)
            .dualMint(
              student.address,
              PROOF_CID,
              CLAIMS_ROOT,
              INSTITUTE_HASH,
              EDU_AMOUNT,
              NO_EXPIRY
            )
        ).to.be.reverted;

        await expect(
          controller.connect(verifier).revokeCredential(tokenId, REASON_HASH)
        ).to.be.reverted;
      });
    });

    describe("access control", function () {
      it("blocks dualMint from non-verifier", async function () {
        await expect(
          controller
            .connect(stranger)
            .dualMint(
              student.address,
              PROOF_CID,
              CLAIMS_ROOT,
              INSTITUTE_HASH,
              EDU_AMOUNT,
              NO_EXPIRY
            )
        ).to.be.reverted;
      });

      it("blocks verifier minting for wrong institute", async function () {
        const OTHER_HASH = ethers.keccak256(
          ethers.toUtf8Bytes("DACS_INSTITUTE:OTHER")
        );
        await controller.setInstituteVerifier(
          INSTITUTE_HASH,
          verifier.address,
          true
        );
        await expect(
          controller
            .connect(verifier)
            .dualMint(
              student.address,
              PROOF_CID,
              CLAIMS_ROOT,
              OTHER_HASH, // different institute
              EDU_AMOUNT,
              NO_EXPIRY
            )
        ).to.be.revertedWith("MintController: not authorized for institute");
      });

      it("blocks revokeCredential from non-revocation-role", async function () {
        await expect(
          controller.connect(stranger).revokeCredential(1, REASON_HASH)
        ).to.be.reverted;
      });
    });

    describe("dualMint", function () {
      beforeEach(async function () {
        await controller.setInstituteVerifier(
          INSTITUTE_HASH,
          verifier.address,
          true
        );
      });

      it("mints PoCT token to student", async function () {
        await controller
          .connect(verifier)
          .dualMint(
            student.address,
            PROOF_CID,
            CLAIMS_ROOT,
            INSTITUTE_HASH,
            EDU_AMOUNT,
            NO_EXPIRY
          );
        expect(await poct.balanceOf(student.address)).to.equal(1n);
      });

      it("mints EDU tokens to student", async function () {
        await controller
          .connect(verifier)
          .dualMint(
            student.address,
            PROOF_CID,
            CLAIMS_ROOT,
            INSTITUTE_HASH,
            EDU_AMOUNT,
            NO_EXPIRY
          );
        expect(await edu.balanceOf(student.address)).to.equal(EDU_AMOUNT);
      });

      it("emits DualMinted event with correct fields", async function () {
        await expect(
          controller
            .connect(verifier)
            .dualMint(
              student.address,
              PROOF_CID,
              CLAIMS_ROOT,
              INSTITUTE_HASH,
              EDU_AMOUNT,
              NO_EXPIRY
            )
        )
          .to.emit(controller, "DualMinted")
          .withArgs(
            student.address,
            1n,
            EDU_AMOUNT,
            verifier.address,
            INSTITUTE_HASH,
            CLAIMS_ROOT,
            PROOF_CID,
            NO_EXPIRY
          );
      });

      it("enforces MAX_EDU_PER_MINT cap", async function () {
        const MAX_EDU = await controller.MAX_EDU_PER_MINT();
        await expect(
          controller
            .connect(verifier)
            .dualMint(
              student.address,
              PROOF_CID,
              CLAIMS_ROOT,
              INSTITUTE_HASH,
              MAX_EDU + 1n,
              NO_EXPIRY
            )
        ).to.be.revertedWith("MintController: EDU exceeds per-mint cap");
      });

      it("does not mint EDU when amount is zero", async function () {
        await controller
          .connect(verifier)
          .dualMint(
            student.address,
            PROOF_CID,
            CLAIMS_ROOT,
            INSTITUTE_HASH,
            0n,
            NO_EXPIRY
          );
        expect(await edu.balanceOf(student.address)).to.equal(0n);
      });

      it("reverts on zero student address", async function () {
        await expect(
          controller
            .connect(verifier)
            .dualMint(
              ethers.ZeroAddress,
              PROOF_CID,
              CLAIMS_ROOT,
              INSTITUTE_HASH,
              EDU_AMOUNT,
              NO_EXPIRY
            )
        ).to.be.revertedWith("MintController: student is zero address");
      });
    });

    describe("revocation", function () {
      let tokenId: bigint;

      beforeEach(async function () {
        await controller.setInstituteVerifier(
          INSTITUTE_HASH,
          verifier.address,
          true
        );
        const tx = await controller
          .connect(verifier)
          .dualMint(
            student.address,
            PROOF_CID,
            CLAIMS_ROOT,
            INSTITUTE_HASH,
            EDU_AMOUNT,
            NO_EXPIRY
          );
        const receipt = await tx.wait();
        const event = receipt?.logs
          .map((log) => {
            try {
              return controller.interface.parseLog(log);
            } catch {
              return null;
            }
          })
          .find((e) => e?.name === "DualMinted");
        tokenId = event?.args?.poctTokenId as bigint;
      });

      it("revokes a credential and updates status", async function () {
        await controller
          .connect(verifier)
          .revokeCredential(tokenId, REASON_HASH);

        const cert = await poct.certificates(tokenId);
        expect(cert.revoked).to.be.true;
        expect(cert.revocationReasonHash).to.equal(REASON_HASH);
      });

      it("emits CredentialRevoked event", async function () {
        await expect(
          controller.connect(verifier).revokeCredential(tokenId, REASON_HASH)
        )
          .to.emit(controller, "CredentialRevoked")
          .withArgs(tokenId, verifier.address, REASON_HASH);
      });

      it("returns Revoked status after revocation", async function () {
        await controller
          .connect(verifier)
          .revokeCredential(tokenId, REASON_HASH);

        const status = await poct.credentialStatus(tokenId);
        expect(status).to.equal(2); // CredentialStatus.Revoked
      });

      it("blocks double-revocation", async function () {
        await controller
          .connect(verifier)
          .revokeCredential(tokenId, REASON_HASH);
        await expect(
          controller.connect(verifier).revokeCredential(tokenId, REASON_HASH)
        ).to.be.revertedWith("PoCT: credential already revoked");
      });

      it("blocks revocation by verifier of different institute", async function () {
        const OTHER_HASH = ethers.keccak256(
          ethers.toUtf8Bytes("DACS_INSTITUTE:OTHER")
        );
        await controller.setInstituteVerifier(
          OTHER_HASH,
          stranger.address,
          true
        );
        await expect(
          controller.connect(stranger).revokeCredential(tokenId, REASON_HASH)
        ).to.be.revertedWith("MintController: not authorized for institute");
      });
    });

    describe("credential status", function () {
      beforeEach(async function () {
        await controller.setInstituteVerifier(
          INSTITUTE_HASH,
          verifier.address,
          true
        );
      });

      it("returns Active for a fresh credential", async function () {
        const tx = await controller
          .connect(verifier)
          .dualMint(
            student.address,
            PROOF_CID,
            CLAIMS_ROOT,
            INSTITUTE_HASH,
            EDU_AMOUNT,
            NO_EXPIRY
          );
        const receipt = await tx.wait();
        const event = receipt?.logs
          .map((log) => {
            try {
              return controller.interface.parseLog(log);
            } catch {
              return null;
            }
          })
          .find((e) => e?.name === "DualMinted");
        const tokenId = event?.args?.poctTokenId as bigint;

        const status = await poct.credentialStatus(tokenId);
        expect(status).to.equal(0); // CredentialStatus.Active
      });
    });
  });
});
