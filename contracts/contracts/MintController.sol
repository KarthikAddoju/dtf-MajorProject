// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

interface IPoCT {
    function mint(
        address student,
        string memory cid,
        address verifier
    ) external returns (uint256);
}

interface IEDUToken {
    function mint(address to, uint256 amount) external;
}

contract MintController is Ownable {

    using ECDSA for bytes32;

    IPoCT public poct;
    IEDUToken public eduToken;

    mapping(address => bool) public authorizedVerifiers;
    mapping(bytes32 => bool) public usedSignatures;

    event DualMinted(
        address indexed student,
        uint256 indexed poctTokenId,
        uint256 eduAmount,
        address verifier
    );

    constructor(address _poct, address _eduToken)
        Ownable(msg.sender)
    {
        poct = IPoCT(_poct);
        eduToken = IEDUToken(_eduToken);
    }

    function setVerifier(address verifier, bool status)
        external
        onlyOwner
    {
        authorizedVerifiers[verifier] = status;
    }

    function dualMint(
        address student,
        string memory cid,
        uint256 eduAmount,
        address verifier,
        bytes memory signature
    ) external {

        require(authorizedVerifiers[verifier], "Unauthorized verifier");

        bytes32 messageHash = keccak256(
            abi.encode(
                address(this),
                block.chainid,
                student,
                cid,
                eduAmount
            )
        );

        bytes32 ethSignedMessageHash =
            MessageHashUtils.toEthSignedMessageHash(messageHash);

        require(
            !usedSignatures[ethSignedMessageHash],
            "Signature already used"
        );

        address recoveredSigner =
            ethSignedMessageHash.recover(signature);

        require(
            recoveredSigner == verifier,
            "Invalid signature"
        );

        usedSignatures[ethSignedMessageHash] = true;

        uint256 tokenId =
            poct.mint(student, cid, verifier);

        eduToken.mint(student, eduAmount);

        emit DualMinted(
            student,
            tokenId,
            eduAmount,
            verifier
        );
    }
}
