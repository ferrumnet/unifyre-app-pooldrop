pragma solidity >=0.5.16;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract DummyToken is ERC20("DummyToken", "DMT") {
    constructor() public  {
        _mint(msg.sender, 10000000000000000000000);
    }
}