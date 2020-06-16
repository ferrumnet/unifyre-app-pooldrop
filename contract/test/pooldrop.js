const PoolDrop = artifacts.require("PoolDrop");
const DummyToken = artifacts.require("DummyToken");

contract('SendMany', (accounts) => {
  it('should transfer multiple tokens', async () => {
    const token = await DummyToken.deployed();
    let bal1 = (await token.balanceOf(accounts[0])).toString();
    let bal2 = (await token.balanceOf(accounts[1])).toString();
    let bal3 = (await token.balanceOf(accounts[2])).toString();
    await assert.equal(bal1, '1000');
    await assert.equal(bal2, '0');
    await assert.equal(bal3, '0');
    const addr = accounts[0];
    const pd = await PoolDrop.deployed();
    await token.approve(pd.address, 100*2);
    const res0 = await pd.transferManyFrom(token.address, addr, [accounts[1], accounts[2]], 100, {from: accounts[0]});
    console.log(res0)
    bal1 = (await token.balanceOf(accounts[0])).toString();
    bal2 = (await token.balanceOf(accounts[1])).toString();
    bal3 = (await token.balanceOf(accounts[2])).toString();
    await assert.equal(bal1, '800');
    await assert.equal(bal2, '100');
    await assert.equal(bal3, '100');
  });
})

