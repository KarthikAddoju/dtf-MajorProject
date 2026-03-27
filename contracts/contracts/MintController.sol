// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/access/AccessControl.sol";

interface IPoCT {
    function mint(
        address student,
        string memory publicProofCid,
        bytes32 claimsRoot,
        bytes32 instituteHash,
        address verifier,
        uint64 expiresAt
    ) external returns (uint256);

    function revoke(uint256 tokenId, bytes32 reasonHash) external;

    function instituteHashOf(uint256 tokenId) external view returns (bytes32);
}

interface IEDUToken {
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

    event InstituteVerifierUpdated(
        bytes32 indexed instituteHash,
        address indexed verifier,
        bool approved
    );

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

    function setInstituteVerifier(
        bytes32 instituteHash,
        address verifier,
        bool approved
    ) external onlyRole(VERIFIER_ADMIN_ROLE) {
        require(instituteHash != bytes32(0), "MintController: institute hash is zero");
        require(verifier != address(0), "MintController: verifier is zero address");

        if (approved) {
            _grantRole(VERIFIER_ROLE, verifier);
            _grantRole(REVOCATION_ROLE, verifier);
        }

        instituteVerifiers[instituteHash][verifier] = approved;

        emit InstituteVerifierUpdated(instituteHash, verifier, approved);
    }

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
