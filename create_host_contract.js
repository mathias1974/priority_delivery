const Web3 = require('web3');
const fs   = require('fs');
const argv = require('minimist')(process.argv.slice(2));
const logger = require('tracer').colorConsole();

let web3 = new Web3();
web3.setProvider(new web3.providers.HttpProvider('http://localhost:8545'));

fs.readFile('./priority_delivery.sol', 'utf8', function (err, source) {

  if (err) {
    return logger.error(err);
  }

  if (!argv.txFee) {
    return false;
  }

  let code;
  let abi;

  if (argv.compiler == "js") {

    /*
     *  js solc
     */

    const solc = require('solc');

    let output = solc.compile(source, 1);

    if (output.errors)
    {
      console.error(output.errors);
      console.error(output.formal.errors);
      //process.exit(1);
    }

    code = output.contracts["priorityDelivery"].bytecode;

    code = "0x" + code;

    abi = JSON.parse(output.contracts["priorityDelivery"].interface);

  }
  else
  {
    /*
     *  rpc solc
     */

    let compiled = web3.eth.compile.solidity(source);
    code = compiled["<stdin>:priorityDelivery"].code;
    abi = compiled["<stdin>:priorityDelivery"].info.abiDefinition;
  }

  let abi_string = JSON.stringify(abi);

  fs.writeFile('./priority_delivery.abi', abi_string, function (err) {

  });

  web3.eth.defaultAccount = web3.eth.accounts[argv.accountId]; // web3.eth.coinbase;

  logger.log("account:", web3.eth.defaultAccount);
  
  web3.eth.contract(abi).new(argv.txFee, {
    data: code,
    gas: 700000
  }, function (err, contract) {
    // callback fires twice, we only want the second call when the contract is deployed
    if (err) {
      console.error(err);
      return;
    }
    else if (!contract.address) {
      logger.log("hash: ", contract.transactionHash);
    }
    else if (contract.address) {
      logger.log('contract address: ' + contract.address);
    }
  });
});
