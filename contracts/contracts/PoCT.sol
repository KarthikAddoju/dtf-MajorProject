// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";

contract PoCT is ERC721Enumerable, Ownable {
    uint256 private _tokenIds;
    address public mintController;

    error SoulboundTransferNotAllowed();

    enum CredentialStatus {
        Active,
        Expired,
        Revoked
    }

    struct Certificate {
        string publicProofCid;
        bytes32 claimsRoot;
        bytes32 instituteHash;
        address verifier;
        uint64 issuedAt;
        uint64 expiresAt;
        bool revoked;
        bytes32 revocationReasonHash;
    }

    mapping(uint256 => Certificate) public certificates;

    event CredentialRevoked(
        uint256 indexed tokenId,
        address indexed revoker,
        bytes32 indexed reasonHash
    );

    modifier onlyController() {
        require(msg.sender == mintController, "PoCT: caller is not the controller");
        _;
    }

    constructor() ERC721("ProofOfCourseToken", "PoCT") Ownable(msg.sender) {}

    function setMintController(address controller) external onlyOwner {
        require(controller != address(0), "PoCT: controller is zero address");
        mintController = controller;
    }

    function mint(
        address student,
        string memory publicProofCid,
        bytes32 claimsRoot,
        bytes32 instituteHash,
        address verifier,
        uint64 expiresAt
    ) external onlyController returns (uint256) {
        require(student != address(0), "PoCT: student is zero address");
        require(bytes(publicProofCid).length > 0, "PoCT: missing proof CID");
        require(claimsRoot != bytes32(0), "PoCT: missing claims root");
        require(instituteHash != bytes32(0), "PoCT: missing institute hash");
        require(verifier != address(0), "PoCT: verifier is zero address");

        _tokenIds += 1;
        uint256 newTokenId = _tokenIds;

        _safeMint(student, newTokenId);

        certificates[newTokenId] = Certificate({
            publicProofCid: publicProofCid,
            claimsRoot: claimsRoot,
            instituteHash: instituteHash,
            verifier: verifier,
            issuedAt: uint64(block.timestamp),
            expiresAt: expiresAt,
            revoked: false,
            revocationReasonHash: bytes32(0)
        });

        return newTokenId;
    }

    function revoke(uint256 tokenId, bytes32 reasonHash) external onlyController {
        require(_ownerOf(tokenId) != address(0), "PoCT: token does not exist");
        Certificate storage certificate = certificates[tokenId];
        require(!certificate.revoked, "PoCT: credential already revoked");

        certificate.revoked = true;
        certificate.revocationReasonHash = reasonHash;

        emit CredentialRevoked(tokenId, msg.sender, reasonHash);
    }

    function instituteHashOf(uint256 tokenId) external view returns (bytes32) {
        require(_ownerOf(tokenId) != address(0), "PoCT: token does not exist");
        return certificates[tokenId].instituteHash;
    }

    function credentialStatus(uint256 tokenId) public view returns (uint8) {
        require(_ownerOf(tokenId) != address(0), "PoCT: token does not exist");

        Certificate storage certificate = certificates[tokenId];

        if (certificate.revoked) {
            return uint8(CredentialStatus.Revoked);
        }

        if (
            certificate.expiresAt != 0 &&
            block.timestamp > uint256(certificate.expiresAt)
        ) {
            return uint8(CredentialStatus.Expired);
        }

        return uint8(CredentialStatus.Active);
    }

    function _update(address to, uint256 tokenId, address auth)
        internal
        override
        returns (address)
    {
        address previousOwner = _ownerOf(tokenId);

        if (previousOwner != address(0) && to != address(0)) {
            revert SoulboundTransferNotAllowed();
        }

        return super._update(to, tokenId, auth);
    }
}
