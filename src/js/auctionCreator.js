var web3;
var web3Provider;
var contract;
var bidfinexContract;
var bidfinexArtifact;
var accounts;
var account;
var auctions;
var currentBlockNumber;

function start()
{
    console.log("Starting the app");

    if (typeof web3 !== 'undefined') 
    {
      console.log("Connecting to Injected Metamask");
      web3Provider = web3.currentProvider;
      //web3Provider = new Web3.providers.HttpProvider('http://localhost:8545');      
    } 
    else 
    {
      console.log("Connecting to Localhost port 8545");
      web3Provider = new Web3.providers.HttpProvider('http://localhost:8545');
    }
    web3 = new Web3(web3Provider);

    $.getJSON('bidfinex.json', function(data)
    {
      console.log("Getting BidFinex contract file");
      bidfinexArtifact = data;
    }).then(getContract);
};

function getContract()
{
    console.log("Getting contract instance from network");
    contract = TruffleContract(bidfinexArtifact);
    contract.setProvider(web3Provider);
    web3.eth.getAccounts(function(err, accs)
    {
        if (err != null) 
        {
          alert("There was an error fetching your accounts.");
          return;
        }
        accounts = accs;
        console.log("Found accounts: ", accounts);
        account = accounts[0];
        console.log("Chosen account: ", account);

        contract.deployed().then(function(instance)
        {
          bidfinexContract = instance;
        }).then(callFunctions);
    });
};

function callFunctions()
{
    updateNetworkInfo();
    updateBlockNumber();
	watchEvents();
};

function createNewAuction() 
{
    console.log("Creating new auction");
	setStatus("Initiating auction, please wait.", "warning");
    showSpinner();
    
	var title = document.getElementById("nameToAuction").value;
	var description = document.getElementById("auctionDescription").value;
	var startingPrice = web3.toWei(parseFloat(document.getElementById("startingPrice").value), "ether");
	var reservePrice = web3.toWei(parseFloat(document.getElementById("reservePrice").value), "ether");
	var deadline = currentBlockNumber + parseInt(document.getElementById("deadline").value);
    
    console.log("Setting deadline to " + deadline + " and current block num is " + currentBlockNumber);
    console.log("Prices, starting/reserve " + startingPrice + "/" + reservePrice);
    
	bidfinexContract.createAuction(title, description, deadline, startingPrice, reservePrice, {from: account, gas:500000}).then(function(txId) 
	{
		console.log(txId);
        if (txId["receipt"]["gasUsed"] == 500000) 
        {
			setStatus("Auction creation failed", "error");
			hideSpinner();
        }
        else
        {
		    setStatus("Auction created in transaction: " + txId["tx"]);
		    hideSpinner();
		}
	});
};

function updateNetworkInfo()
{
    console.log("Updating network information");
    var address = document.getElementById("address");
    address.innerHTML = account;

    var ethBalance = document.getElementById("ethBalance");
    web3.eth.getBalance(account, function(err, bal)
    {
        ethBalance.innerHTML = web3.fromWei(bal, "ether") + " ETH";
    });

    var withdrawBalance = document.getElementById("withdrawBalance");

    if (typeof bidfinexContract != 'undefined' && typeof account != 'undefined')
    {
        web3.eth.getBalance(bidfinexContract.address, function(err, bal) 
        {
            console.log("contract balance: " + bal);
        });
    
        bidfinexContract.getRefundValue.call({from:account}).then(function(refundBalance)
        {
            var balance = web3.fromWei(refundBalance, "ether");
            withdrawBalance.innerHTML = web3.fromWei(refundBalance, "ether") + " ETH";

            if (balance == 0) 
            {
                $("#withdrawButton").hide();
            }
            else 
            {
                $("#withdrawButton").show();
            }
        });
    }
    else
    {
        $("#withdrawButton").hide();
    }
  
    var network = document.getElementById("network");
    var provider = web3.version.getNetwork(function(err, net)
    {
        var networkDisplay;
        if(net == 1) 
        {
        networkDisplay = "Ethereum MainNet";
        }
        else if (net == 2)
        {
        networkDisplay = "Morden TestNet";
        }
        else if (net == 3)
        {
        networkDisplay = "Ropsten TestNet";
        }
        else
        {
        networkDisplay = net;
        }
        network.innerHTML = networkDisplay;
    });
};

function updateBlockNumber()
{
  web3.eth.getBlockNumber(function(err, blockNumber)
  {
    currentBlockNumber = blockNumber;
    console.log("Current block number is: " + blockNumber);
  });
};

function watchEvents()
{
    var events = bidfinexContract.allEvents();
    events.watch(function(err, msg)
    {
        if(err)
        {
            console.log("Error: " + err);
        }
        else
        {
            console.log("Got an event: " + msg.event);
        }
    });
    var filter = web3.eth.filter("latest");
    filter.watch(function(err, block) {
        updateBlockNumber();
    });
};

function withdraw()
{
  if (typeof bidfinexContract != 'undefined' && typeof account != 'undefined')
  {
    setStatus("Withdrawing fund...", "warning");
    showSpinner();
    
    bidfinexContract.withdrawRefund({from:account, gas:500000}).then(function(txId)
    {
      setStatus("Withdraw finished.");
      hideSpinner();
      updateEthNetworkInfo();
    });
  }
};

function updateInfoBox(html) 
{
  var infoBox = document.getElementById("infoPanelText");
  infoBox.innerHTML = html;
};

function hideSpinner()
{
  $("#spinner").hide();
};

function showSpinner()
{
  $("#spinner").show();
};

function setStatus(message, category)
{
  var status = document.getElementById("statusMessage");
  status.innerHTML = message;
  var panel = $("#statusPanel");
  panel.removeClass("panel-warning");
  panel.removeClass("panel-danger");
  panel.removeClass("panel-success");

  if (category === "warning")
  {
    panel.addClass("panel-warning");
  }
  else if (category === "error")
  {
    panel.addClass("panel-danger");
  }
  else
  {
    panel.addClass("panel-success");
  }    
};

$(function() 
{
  $(window).load(function() 
  {
   start();
  });
});