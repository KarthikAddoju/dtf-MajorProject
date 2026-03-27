// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract EDUToken is ERC20, Ownable {

    uint256 public constant MAX_SUPPLY = 1_000_000 * 10 ** 18;

    address public mintController;

    modifier onlyController() {
        require(msg.sender == mintController, "EDUToken: caller is not the controller");
        _;
    }

    constructor()
        ERC20("EducationRewardToken", "EDU")
        Ownable(msg.sender)
    {}

    function setMintController(address _controller) external onlyOwner {
        require(_controller != address(0), "EDUToken: controller is zero address");
        mintController = _controller;
    }

    function mint(address to, uint256 amount) external onlyController {
        require(totalSupply() + amount <= MAX_SUPPLY, "EDUToken: supply cap exceeded");
        _mint(to, amount);
    }
}
