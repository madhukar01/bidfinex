var web3;
var web3Provider;
var contract;
var bidfinexContract;
var bidfinexArtifact;
var accounts;
var account;
var auction;
var auctions;
var currentBlockNumber;
var infoBoxHTMLActive = "<p>Right now this auction is <b>active</b>. You can place a bid, in ether, for this item if you are running <a href='http://metamask.io'>Metamask</a>. It will ask you to authorize your bid transaction, and the ether for your bid will be held by the <a href='https://github.com/dob/auctionhouse/contracts/AuctionHouse.sol'>AuctionHouse contract</a> until you either win the item, or until you are out bid. At that point your bid amount will be transfered back to you or your won item will be transfered to you by the contract.</p>";
var infoBoxHTMLInactive = "<p>Right now this auction is either over, or was cancelled. You can not place a bid on this item at this point. Try browsing the other <a href='index.html#auctions'>currently active auctions</a>.</p>";

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
  refreshAuction();
  updateBlockNumber();
  watchEvents();
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

function refreshAuction()
{
    console.log("Refreshing auction...")
    var n = getParameters("auctionId");
    auction = {"auctionId": n};
    
    console.log("Fetching auction: ", auction["auctionId"]);
    bidfinexContract.getAuctionCount.call().then(function(count) 
    {
        console.log("Number of auctions " + count);
        if (count.toNumber() < n)
        {
            setStatus("Cannot find auction: " + n, "error");
            throw new Error();
        }
    });
    
    bidfinexContract.getAuctionStatus.call(auction["auctionId"]).then(function(auctionStatus)
    {
        console.log("status:" + auctionStatus);
        if (auctionStatus == 0)
        {
            auction["status"] = "Active";
            updateInfoBox(infoBoxHTMLActive);
        } 
        else if (auctionStatus == 1)
        {
            auction["status"] = "Inactive";
            updateInfoBox(infoBoxHTMLInactive);
        } 
        else
        {
            alert("Unknown status: " + auctionStatus);
        };

        bidfinexContract.getAuction.call(auction["auctionId"]).then(function(result)
        {
            auction["seller"] = result[0];
            auction["recordId"] = result[1];
            auction["title"] = result[2];
            auction["description"] = result[3];
            auction["blockNumberOfDeadline"] = result[4].toNumber();
            auction["startingPrice"] = result[5].toNumber();
            auction["reservePrice"] = result[6].toNumber();
            auction["currentBid"] = result[7].toNumber();
            auction["bidCount"] = result[8].toNumber();
    
            var container = document.getElementById("auction_container");
            container.innerHTML = constructAuctionView(auction);
          });
    });   
};

function getParameters(name, url)
{
    if (!url)
        url = window.location.href;
    
    name = name.replace(/[\[\]]/g, "\\$&");
    var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
    results = regex.exec(url);
    
    if (!results)
        return null;
    if (!results[2])
        return '';
    
    return decodeURIComponent(results[2].replace(/\+/g, " "));
};

function placeBid()
{
    console.log("Place bid");
    var bid = document.getElementById("bid_value").value;
    bid = web3.toWei(bid, "ether");
  
    setStatus("Bid is being placed, hang tight...", "warning");
    showSpinner();
  
    if (bid < auction["currentBid"])
    {
      setStatus("Bid has to be at least " + auction["currentBid"], "error");
      return;
    }
    
    var gas = 1400000;
    bidfinexContract.placeBid(auction["auctionId"], {from:account, value:bid, gas: gas}).then(function(txId)
    {
        console.log("Bid txnId: " + txId["tx"]);
        if (txId["receipt"]["gasUsed"] == gas)
        {
            setStatus("Bid creation failed", "error");
            hideSpinner();
        } 
        else
        {
            setStatus("Bid created in transaction: " + txId["tx"]);
            setStatus("Bid succeeded!", "success");
            hideSpinner();
        }
    
    refreshAuction();
    });
};

function endAuction()
{
    console.log("Ending auction: "+auction["auctionId"]);
    setStatus("Ending auction...", "warning");
    showSpinner();

    bidfinexContract.endAuction(auction["auctionId"]).then(function(txId)
    {
        console.log("End auction txnId: " + txId["tx"]);
        setStatus("Auction ended successfully.");
        hideSpinner();
        //refreshAuction();
    });
};

function isOwner() 
{
    return auction["seller"] == account;
};

function constructAuctionView(auction)
{
    $("#auctionTitle").text(auction["title"]);
    
    result = "<table class='auctionDetails'>";
    result += "<tr><td class='auctionlabel'>Status:</td><td>" + auction["status"] + "</td></tr>";
    result += "<tr><td class='auctionlabel'>Seller:</td><td>" + auction["seller"] + "</td></tr>";
    result += "<tr><td class='auctionlabel'>Title:</td><td>" + auction["title"] + "</td></tr>";
    result += "<tr><td class='auctionlabel'>Description:</td><td>" + auction["description"] + "</td></tr>";
    result += "<tr><td class='auctionlabel'>Current Bid:</td><td>" + web3.fromWei(auction["currentBid"], "ether") + " ETH" + "</td></tr>";
    result += "<tr><td class='auctionlabel'>Number of Bids:</td><td>" + auction["bidCount"] + "</td></tr>";
    result += "<tr><td class='auctionlabel'>Deadline Block Number:</td><td>" + auction["blockNumberOfDeadline"] + " <span id='deadlineCountdown'></span>" + "</td></tr>";
    
    if (auction["status"] == "Active" && currentBlockNumber < auction["blockNumberOfDeadline"])
    {
        result += "<tr><td class='auctionLabel'>Bid (in eth):</td><td><input type='number' id='bid_value' placeholder='eg 3.0'></input></td></tr>";
        result += "<tr><td class='auctionLabel'>&nbsp;</td><td><button id='bid_button' class='btn btn-primary' onclick='placeBid()'>Place Bid</button></td></tr>";
    }

    if (auction["status"] == "Active" && currentBlockNumber >= auction["blockNumberOfDeadline"] && auction["seller"] == account)
    {
        result += "<tr><td class='auctionLabel'>End Auction:</td><td><button id='end_button' onclick='endAuction()'>End Auction</button></td></tr>";
    }

    result += "</table>";

    return result;
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
    filter.watch(function(err, block)
    {
        updateBlockNumber();
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

function withdraw()
{
  if (typeof bidfinexContract != 'undefined' && typeof account != 'undefined')
  {
    setStatus("Withdrawing fund...", "warning");
    showSpinner();
    
    bidfinexContract.withdrawRefund({from:account, gas:500000}).then(function(txId)
    {
        console.log("Bid txnId: " + txId["tx"]);
        if (txId["receipt"]["gasUsed"] == 500000)
        {
            setStatus("Withdraw", "error");
            hideSpinner();
        } 
        else
        {
            setStatus("Withdraw finished.");
            hideSpinner();
            updateNetworkInfo();
        }
    });
  }
};

$(function() 
{
    $(window).load(function() 
    {
        start();
    });
});