// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract EDUToken is ERC20, Ownable {

    uint256 public constant MAX_SUPPLY = 1_000_000 * 10 ** 18;

    address public mintController;

    /// @notice Emitted when the mint controller address is updated.
    /// @param previousController Previous mint controller.
    /// @param newController New mint controller.
    event MintControllerUpdated(address indexed previousController, address indexed newController);

    modifier onlyController() {
        require(msg.sender == mintController, "EDUToken: caller is not the controller");
        _;
    }

    constructor()
        ERC20("EducationRewardToken", "EDU")
        Ownable(msg.sender)
    {}

    /// @notice Sets the controller allowed to mint EDU rewards.
    /// @param _controller New mint controller contract address.
    function setMintController(address _controller) external onlyOwner {
        require(_controller != address(0), "EDUToken: controller is zero address");
        address previous = mintController;
        mintController = _controller;
        emit MintControllerUpdated(previous, _controller);
    }

    /// @notice Mints EDU rewards to a student wallet.
    /// @param to Recipient wallet address.
    /// @param amount Token amount in wei.
    /// @dev Only the configured controller can mint, and the global supply cap is enforced.
    function mint(address to, uint256 amount) external onlyController {
        require(totalSupply() + amount <= MAX_SUPPLY, "EDUToken: supply cap exceeded");
        _mint(to, amount);
    }
}
