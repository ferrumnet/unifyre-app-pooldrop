const ConvertLib = artifacts.require("DummyToken");
const MetaCoin = artifacts.require("PoolDrop");

module.exports = function(deployer) {
  deployer.deploy(ConvertLib);
  deployer.link(ConvertLib, MetaCoin);
  deployer.deploy(MetaCoin);
};
