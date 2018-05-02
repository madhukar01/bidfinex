# bidfinex
A decentralised marketplace on Ethereum blockchain

### How to install
    Clone this git repository https://github.com/madhukar01/bidfinex/

    Install Ganache from http://truffleframework.com/ganache/

    Install Metamask browser extension from https://metamask.io/

    Install Node.js v8.11 from from https://nodejs.org/en/


### After installing Node.js run these commands inside bidfinex directory:

    npm install     //Installs the dependencies from package.json

    npm install -g truffle      //Installs Truffle framework http://truffleframework.com

    truffle version     //This should return Truffle version and Solc version after successful install


    //Start Ganache client and change port number to 8545 in settings (Or change it in truffle.js configuration file)

    truffle compile     //Compiles .sol contract files into .json 

    truffle migrate     //Deploys the contracts onto blockchain

    npm run-dev     //Runs the server locally and opens the webpage in the browser


You can deploy this on public ethereum network as well, you just have to change network configuration in truffle.js 

#### Note: Running "truffle" command might open the file truffle.js (on windows), in that case use "truffle.cmd" instead