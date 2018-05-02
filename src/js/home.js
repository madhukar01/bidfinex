var web3;
var web3Provider;
var contract;
var bidfinexContract;
var bidfinexArtifact;
var accounts;
var account;
var auctions;
var auctionsArray = [];
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
  updateAuctions();
  updateBlockNumber();
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

function updateAuctions()
{
  setStatus("Auctions being fetched...", "warning");

  bidfinexContract.getAuctionCount.call().then(function(count)
  {
    console.log("Number of auctions " + count);
    if (count <= 0) {
      setStatus("No auctions found", "error");
    }

    for (var i = 0; i < count; i++)
    {
      console.log("Getting auction: "+i);
      getAuction(i);
    }
    
    waitAndRefresh(count);
  });   
};

function waitAndRefresh(count)
{
  if (auctionsArray.length < count)
  {
    console.log("Sleeping, Count: " + count + " Length: " + auctionsArray.length);
    setTimeout(waitAndRefresh, 500, count);
  }
  else
  {
    var auctionSection = document.getElementById("userAuctions");
    var res = "";
    for (var j = 0; j < count; j++)
    {
      var auc = auctionsArray[j];
      if (parseInt(auc[4]) > currentBlockNumber)
      {
        var n = parseInt(auc[4])- currentBlockNumber;
        res = res + "<tr>";
        res = res + "<td><a href='auction.html?auctionId=" + auc[1] + "'>" + auc[2] + "</a></td>";
        res = res + "<td>" + web3.fromWei(auc[5], "ether") + " ETH" + "</td>";        
        res = res + "<td>" + web3.fromWei(auc[7], "ether") + " ETH" + "</td>";
        res = res + "<td>" + auc[8] + "</td>";
        res = res + "<td>" + n + "</td>";
        res = res + "</tr>";
      }
    }
    console.log("Updating auctions!");
    auctionSection.innerHTML = res;
    setStatus("");
  }
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
      updateNetworkInfo();
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

function updateBlockNumber()
{
  web3.eth.getBlockNumber(function(err, blockNumber)
  {
    currentBlockNumber = blockNumber;
    console.log("Current block number is: " + blockNumber);
  });
};

function getAuction(auctionId)
{
  bidfinexContract.getAuction.call(auctionId).then(function(auction)
  {
    console.log("Loading: " + auctionId);
    auction[9] = auctionId;
    auctionsArray.push(auction);
  });
};

$(function() 
{
  $(window).load(function() 
  {
   start();
  });
});