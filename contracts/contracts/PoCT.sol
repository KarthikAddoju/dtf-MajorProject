// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract PoCT is ERC721Enumerable, Ownable {

    uint256 private _tokenIds;
    address public mintController;

    error SoulboundTransferNotAllowed();

    struct Certificate {
        string cid;
        address verifier;
        uint256 issuedAt;
    }

    mapping(uint256 => Certificate) public certificates;

    modifier onlyController() {
        require(msg.sender == mintController, "Not authorized");
        _;
    }

    constructor()
        ERC721("ProofOfCourseToken", "PoCT")
        Ownable(msg.sender)
    {}

    function setMintController(address _controller) external onlyOwner {
        mintController = _controller;
    }

    function mint(
        address student,
        string memory cid,
        address verifier
    ) external onlyController returns (uint256) {

        _tokenIds++;
        uint256 newTokenId = _tokenIds;

        _safeMint(student, newTokenId);

        certificates[newTokenId] = Certificate({
            cid: cid,
            verifier: verifier,
            issuedAt: block.timestamp
        });

        return newTokenId;
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
