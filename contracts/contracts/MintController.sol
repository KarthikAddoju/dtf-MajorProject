// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import "@openzeppelin/contracts/access/AccessControl.sol";

interface IPoCT {
    /// @notice Mints a credential NFT for an approved student submission.
    /// @param student Recipient wallet address.
    /// @param publicProofCid IPFS CID for the public proof bundle.
    /// @param claimsRoot Merkle root of the credential claim set.
    /// @param instituteHash Institute identifier bound to the credential.
    /// @param verifier Reviewer wallet that approved the mint.
    /// @param expiresAt Unix timestamp when the credential expires, or zero for no expiry.
    /// @return Newly minted credential token id.
    function mint(
        address student,
        string memory publicProofCid,
        bytes32 claimsRoot,
        bytes32 instituteHash,
        address verifier,
        uint64 expiresAt
    ) external returns (uint256);

    /// @notice Revokes a previously minted credential.
    /// @param tokenId Credential token id.
    /// @param reasonHash Hash of the revocation reason.
    function revoke(uint256 tokenId, bytes32 reasonHash) external;

    /// @notice Returns the institute hash associated with a credential.
    /// @param tokenId Credential token id.
    /// @return Institute hash stored in the PoCT contract.
    function instituteHashOf(uint256 tokenId) external view returns (bytes32);
}

interface IEDUToken {
    /// @notice Mints EDU rewards to a student wallet.
    /// @param to Recipient wallet address.
    /// @param amount Reward amount in wei.
    function mint(address to, uint256 amount) external;
}

contract MintController is AccessControl {
    bytes32 public constant VERIFIER_ADMIN_ROLE =
        keccak256("VERIFIER_ADMIN_ROLE");
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    bytes32 public constant REVOCATION_ROLE = keccak256("REVOCATION_ROLE");

    uint256 public constant MAX_EDU_PER_MINT = 10_000 * 10 ** 18;

    IPoCT public poct;
    IEDUToken public eduToken;

    mapping(bytes32 => mapping(address => bool)) public instituteVerifiers;
    mapping(address => uint256) private verifierApprovalCounts;

    /// @notice Emitted whenever institute-specific verifier access is updated.
    /// @param instituteHash Institute identifier being updated.
    /// @param verifier Reviewer wallet whose approval changed.
    /// @param approved Whether the reviewer is approved for the institute after the update.
    event InstituteVerifierUpdated(
        bytes32 indexed instituteHash,
        address indexed verifier,
        bool approved
    );

    /// @notice Emitted when a reviewer mints a credential and optional EDU reward.
    /// @param student Student wallet receiving the credential.
    /// @param poctTokenId Newly minted PoCT token id.
    /// @param eduAmount EDU amount minted alongside the credential.
    /// @param verifier Reviewer wallet that approved the mint.
    /// @param instituteHash Institute identifier bound to the credential.
    /// @param claimsRoot Merkle root of the credential claims.
    /// @param publicProofCid IPFS CID for the public proof bundle.
    /// @param expiresAt Unix timestamp when the credential expires, or zero for no expiry.
    event DualMinted(
        address indexed student,
        uint256 indexed poctTokenId,
        uint256 eduAmount,
        address verifier,
        bytes32 instituteHash,
        bytes32 claimsRoot,
        string publicProofCid,
        uint64 expiresAt
    );

    /// @notice Emitted when a reviewer revokes an existing credential.
    /// @param tokenId Credential token id.
    /// @param revoker Reviewer wallet that executed the revocation.
    /// @param reasonHash Hash of the revocation reason.
    event CredentialRevoked(
        uint256 indexed tokenId,
        address indexed revoker,
        bytes32 indexed reasonHash
    );

    constructor(address admin, address poctAddress, address eduTokenAddress) {
        require(admin != address(0), "MintController: admin is zero address");
        require(poctAddress != address(0), "MintController: PoCT is zero address");
        require(eduTokenAddress != address(0), "MintController: EDU is zero address");

        poct = IPoCT(poctAddress);
        eduToken = IEDUToken(eduTokenAddress);

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(VERIFIER_ADMIN_ROLE, admin);
        _grantRole(VERIFIER_ROLE, admin);
        _grantRole(REVOCATION_ROLE, admin);
    }

    /// @notice Updates institute-level mint and revocation access for a verifier.
    /// @param instituteHash Institute identifier being updated.
    /// @param verifier Reviewer wallet whose institute approval is changing.
    /// @param approved Whether the reviewer should remain approved after the update.
    /// @dev Role accounting is reference-counted across institutes for non-admin verifiers.
    function setInstituteVerifier(
        bytes32 instituteHash,
        address verifier,
        bool approved
    ) external onlyRole(VERIFIER_ADMIN_ROLE) {
        require(instituteHash != bytes32(0), "MintController: institute hash is zero");
        require(verifier != address(0), "MintController: verifier is zero address");

        bool wasApproved = instituteVerifiers[instituteHash][verifier];

        if (!wasApproved && approved) {
            uint256 nextApprovalCount = verifierApprovalCounts[verifier] + 1;
            verifierApprovalCounts[verifier] = nextApprovalCount;

            if (nextApprovalCount == 1) {
                _grantRole(VERIFIER_ROLE, verifier);
                _grantRole(REVOCATION_ROLE, verifier);
            }
        } else if (wasApproved && !approved) {
            uint256 currentApprovalCount = verifierApprovalCounts[verifier];
            uint256 nextApprovalCount = currentApprovalCount > 0
                ? currentApprovalCount - 1
                : 0;

            verifierApprovalCounts[verifier] = nextApprovalCount;

            if (
                nextApprovalCount == 0 &&
                !hasRole(VERIFIER_ADMIN_ROLE, verifier)
            ) {
                _revokeRole(VERIFIER_ROLE, verifier);
                _revokeRole(REVOCATION_ROLE, verifier);
            }
        }

        instituteVerifiers[instituteHash][verifier] = approved;

        emit InstituteVerifierUpdated(instituteHash, verifier, approved);
    }

    /// @notice Mints a PoCT credential and optional EDU reward for an approved institute.
    /// @param student Student wallet receiving the credential.
    /// @param publicProofCid IPFS CID for the public proof bundle.
    /// @param claimsRoot Merkle root of the credential claims.
    /// @param instituteHash Institute identifier bound to the credential.
    /// @param eduAmount EDU amount to mint alongside the credential.
    /// @param expiresAt Unix timestamp when the credential expires, or zero for no expiry.
    /// @return tokenId Newly minted PoCT token id.
    function dualMint(
        address student,
        string memory publicProofCid,
        bytes32 claimsRoot,
        bytes32 instituteHash,
        uint256 eduAmount,
        uint64 expiresAt
    ) external onlyRole(VERIFIER_ROLE) returns (uint256) {
        require(student != address(0), "MintController: student is zero address");
        require(bytes(publicProofCid).length > 0, "MintController: missing proof CID");
        require(claimsRoot != bytes32(0), "MintController: missing claims root");
        require(instituteHash != bytes32(0), "MintController: missing institute hash");
        require(eduAmount <= MAX_EDU_PER_MINT, "MintController: EDU exceeds per-mint cap");
        require(
            instituteVerifiers[instituteHash][msg.sender],
            "MintController: not authorized for institute"
        );

        uint256 tokenId = poct.mint(
            student,
            publicProofCid,
            claimsRoot,
            instituteHash,
            msg.sender,
            expiresAt
        );

        if (eduAmount > 0) {
            eduToken.mint(student, eduAmount);
        }

        emit DualMinted(
            student,
            tokenId,
            eduAmount,
            msg.sender,
            instituteHash,
            claimsRoot,
            publicProofCid,
            expiresAt
        );

        return tokenId;
    }

    /// @notice Revokes an existing credential for an institute the caller is authorized on.
    /// @param tokenId Credential token id.
    /// @param reasonHash Hash of the human-readable revocation reason.
    function revokeCredential(
        uint256 tokenId,
        bytes32 reasonHash
    ) external onlyRole(REVOCATION_ROLE) {
        bytes32 instituteHash = poct.instituteHashOf(tokenId);

        require(
            instituteVerifiers[instituteHash][msg.sender],
            "MintController: not authorized for institute"
        );

        poct.revoke(tokenId, reasonHash);

        emit CredentialRevoked(tokenId, msg.sender, reasonHash);
    }
}
