'use strict'

const fs   = require('fs');
const Web3 = require('web3');

let web3 = new Web3();

let plugin;
let self;

function eth(p) {
  if (!(this instanceof eth)) {
    return new eth(p);
  }

  plugin = p;
  self = this;

  web3.setProvider(new web3.providers.HttpProvider('http://localhost:8545'));
};

eth.prototype.getChannel = function (me, contractAddress) {
  return new Promise(function (res, rej) {

    let fromAddress = web3.eth.accounts[plugin.cfg.main.accountId];

    var hash = toHex(hashCode(me));
    fs.readFile(__dirname + '/priority_delivery.abi', 'utf8', function (err, abi_string) {
      var abi = JSON.parse(abi_string);
      web3.eth.contract(abi).at(contractAddress).getChannel(hash, { from: fromAddress }, function (error, result) {

        result = JSON.parse(result);

        //let gasPrice = 0.000000002;

        let size = Math.round((result * 100) / (2000000000 * 23529));

        if (result > 0) {
          return res(size);
        }
        else {
          return res(false);
        }
      });
    });
  });
}

eth.prototype.openChannel = function (contractAddress, size) {
  return new Promise(function (res, rej) {
    plugin.loginfo("recepient contract:", contractAddress);

    let me = plugin.config.get('me');

    fs.readFile(__dirname + '/priority_delivery.abi', 'utf8', function (err, abi_string) {

      let abi = JSON.parse(abi_string);
      let hash = toHex(hashCode(me));

      let gasPrice = 0.00000001;
      let amount = (size / 100) * gasPrice * 23529; // 24227 = lock tx gas cost
      let maxGas = 500000;

      let fromAddress = web3.eth.accounts[plugin.cfg.main.accountId];

      amount = parseFloat(amount.toFixed(11));

      web3.eth.contract(abi).at(contractAddress).openChannel.sendTransaction(hash, {
        from  : fromAddress,
        value : web3.toWei(amount, 'ether'),
        gas   : maxGas,
        gasPrice: web3.toWei(gasPrice, 'ether'),
      }, function (error, result) {

        if (!result || error)
        {
          plugin.loginfo("error:");
          plugin.loginfo(error);

          return rej(error);
        }

        waitingChannel(contractAddress, hash, () => {
          setTimeout(() => { res(result); }, 1000); // extra timeout to distribute transaction across the whole network
        });
      });
    });
  });
}

const waitingChannel = (contractAddress, hash, callback) => {

  let me = plugin.config.get('me');

  const checkChannel = () => {

    plugin.loginfo("waiting: ", me, " > ", contractAddress);

    self.getChannel(me, contractAddress).then((result) => {

      if (result > 0)
      {
        return callback(false, result);
      }
      else
      {
        setTimeout(checkChannel, 5 * 1000);
      }
    });
  }

  checkChannel();
}

eth.prototype.lockChannel = (host) => {

  return new Promise(function (res, rej) {

    let hash = toHex(hashCode(host));
    let contractAddress = plugin.cfg.main.hostContractId;

    plugin.loginfo("lock channel: ", contractAddress);

    fs.readFile(__dirname + '/priority_delivery.abi', 'utf8', function (err, abi_string) {

      let abi = JSON.parse(abi_string);
      let gasPrice = 0.00000001;
      let maxGas = 500000;

      let fromAddress = web3.eth.accounts[plugin.cfg.main.accountId];

      web3.eth.contract(abi).at(contractAddress).lockChannel.sendTransaction(hash, {
        from: fromAddress,
        gas: maxGas,
        gasPrice: web3.toWei(gasPrice, 'ether')
      }, function (error, result) {

        if (error)
        {
          return rej(error);
        }

        return res(result);
      });
    });
  });
}

function hashCode(str, asString, seed) {
  /*jshint bitwise:false */
  var i, l,
      hval = (seed === undefined) ? 0x811c9dc5 : seed;

  for (i = 0, l = str.length; i < l; i++) {
    hval ^= str.charCodeAt(i);
    hval += (hval << 1) + (hval << 4) + (hval << 7) + (hval << 8) + (hval << 24);
  }
  if (asString) {
    // Convert to 8 digit hex string
    return ("0000000" + (hval >>> 0).toString(16)).substr(-8);
  }
  return hval >>> 0;
}

const toHex = function (val) {
  return ("0000000" + (val >>> 0).toString(16)).substr(-8);
}

module.exports = eth;

