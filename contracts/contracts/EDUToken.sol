// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract EDUToken is ERC20, Ownable {

    address public mintController;

    modifier onlyController() {
        require(msg.sender == mintController, "Not authorized");
        _;
    }

    constructor()
        ERC20("EducationRewardToken", "EDU")
        Ownable(msg.sender)
    {}

    function setMintController(address _controller) external onlyOwner {
        mintController = _controller;
    }

    function mint(address to, uint256 amount) external onlyController {
        _mint(to, amount);
    }
}