var bidfinex = artifacts.require("./bidfinex.sol");

module.exports = function(deployer) {
  deployer.deploy(bidfinex);
};
