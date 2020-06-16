pragma solidity >=0.5.16;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title PoolDrop
 * @dev Basic pool-drop contract to distribute an ERC20 amount to multiple accounts
 **/
contract PoolDrop {
    constructor() public {}

    function transferManyFrom(address _token, address _from, address[] memory _tos, uint256 _value)
    public returns (bool) {
        require(_token != address(0));
        require(_from != address(0));
        require(_value > 0);
        IERC20 Token = IERC20(_token);
        for (uint i=0; i<_tos.length; i++) {
            Token.transferFrom(_from, _tos[i], _value);
        }
        return true;
    }
}