App = {
    web3Provider: null,
    contract: null,
    //bidfinexContract: null,
    accounts: null,
    account: null,
    auctions: null,
    auction: null,
    currentBlockNumber: null,
    infoBoxHTMLOwnerPending: "<p>Right now this auction is <b>pending</b>. If you're the owner you can click the activate button, which will initiate two ethereum transactions. The first will transfer ownership of your asset to the <a href='https://github.com/dob/auctionhouse/contracts/AuctionHouse.sol'>AuctionHouse contract</a>. The second will activate the auction.</p><p>Don't worry, if the auction doesn't succeed by the deadline, then ownership of your asset will be transfered back to you.</p>",
    infoBoxHTMLActive: "<p>Right now this auction is <b>active</b>. You can place a bid, in ether, for this item if you are running <a href='http://metamask.io'>Metamask</a>. It will ask you to authorize your bid transaction, and the ether for your bid will be held by the <a href='https://github.com/dob/auctionhouse/contracts/AuctionHouse.sol'>AuctionHouse contract</a> until you either win the item, or until you are out bid. At that point your bid amount will be transfered back to you or your won item will be transfered to you by the contract.</p>",
    infoBoxHTMLInactive: "<p>Right now this auction is either over, or was cancelled. You can not place a bid on this item at this point. Try browsing the other <a href='index.html#auctions'>currently active auctions</a>.</p>",
    //aucs: [],
    
    init: function() {
      console.log("App started");
      return App.initWeb3();
    },
  
    initWeb3: function()
    {
      if (typeof web3 !== 'undefined') 
      {
        //Will connect to injected Metamask provider
        console.log("Connecting to Injected Metamask");
        App.web3Provider = web3.currentProvider;
       // App.web3Provider = new Web3.providers.HttpProvider('http://localhost:8545');
      } 
      else 
      {
        // If no injected web3 instance is detected, fall back to local web3 provider
        console.log("Connecting to Localhost port 8545");
        App.web3Provider = new Web3.providers.HttpProvider('http://localhost:8545');
      }
      web3 = new Web3(App.web3Provider);
      return App.initContract();
    },
  
    initContract: function()
    {
      console.log("Initiating contract");
      $.getJSON('bidfinex.json', function(data) {
        // Get the necessary contract artifact file and instantiate it with truffle-contract
        var bidfinexArtifact = data;
        App.contract = TruffleContract(bidfinexArtifact);
  
        // Set the provider and accounts for the contract
        App.contract.setProvider(App.web3Provider);
        web3.eth.getAccounts(function(err, accs) {
        if (err != null) 
        {
          alert("There was an error fetching your accounts.");
          return;
        }
        App.accounts = accs;
        console.log("Found accounts: ", App.accounts);
        App.account = App.accounts[0];
        console.log("Chosen account: ", App.account);
        // Use our contract to retrieve network status and auctions
        App.updateEthNetworkInfo();
        App.refreshAuction();
        App.updateBlockNumber(); 
        App.watchEvents();
        });
      });
    },
  
    refreshAuction: function()
    {
        console.log("Refreshing auction...")
        var n = App.getParameterByName("auctionId");
        auction = {"auctionId": n};
        var bidfinexContract;
        console.log("Fetching auction: ", auction["auctionId"]);
        App.contract.deployed().then(function(instance) 
        {
            bidfinexContract = instance;
            bidfinexContract.getAuctionCount.call().then(function(count) 
            {
                console.log("Number of auctions " + count);
    
                if (count.toNumber() < n) {
                App.setStatus("Cannot find auction: " + n, "error");
                throw new Error();
                }
            });
            bidfinexContract.getAuctionStatus.call(auction["auctionId"]).then(function(auctionStatus) {
                console.log("status:" + auctionStatus);
                if (auctionStatus == 0) {
                        auction["status"] = "Active";
                    App.updateInfoBox(App.infoBoxHTMLActive);
                } 
                else if (auctionStatus == 1) {
                        auction["status"] = "Inactive";
                    App.updateInfoBox(App.infoBoxHTMLInactive);
                } 
                else {
                    alert("Unknown status: " + auctionStatus);
            };

            bidfinexContract.getAuction.call(auction["auctionId"]).then(function(result) {
                auction["seller"] = result[0];
                auction["recordId"] = result[2];
                auction["title"] = result[1];
                auction["description"] = result[3];
                auction["blockNumberOfDeadline"] = result[4].toNumber();
                auction["startingPrice"] = result[5].toNumber();
                auction["reservePrice"] = result[6].toNumber();
                auction["currentBid"] = result[7].toNumber();
                auction["bidCount"] = result[8].toNumber();
    
                var container = document.getElementById("auction_container");
                container.innerHTML = App.constructAuctionView(auction);
          });
      });
    });   
    },
  
    placeBid: function() {
      console.log()
        var bid = document.getElementById("bid_value").value;
        bid = web3.toWei(bid, "ether");
    
        App.setStatus("Bid is being placed, hang tight...", "warning");
        App.showSpinner();
    
        if (bid < auction["currentBid"]) {
        setStatus("Bid has to be at least " + auction["currentBid"], "error");
        return;
        }
    
        var bidfinexContract;
        App.contract.deployed().then(function(instance) 
        {
            bidfinexContract = instance;
            var gas = 500000;
            bidfinexContract.placeBid(auction["auctionId"], {from:App.account, value:bid, gas: gas}).then(function(txnId) {
            console.log("Bid txnId: " + txId["tx"]);
            if (txId["receipt"]["gasUsed"] == gas) {
				App.setStatus("Bid creation failed", "error");
				App.hideSpinner();
			} else {
                App.setStatus("Bid created in transaction: " + txId["tx"]);
                App.setStatus("Bid succeeded!", "success");
				App.hideSpinner();
			}
            App.refreshAuction();
            });
        });
    },

    endAuction: function() {
        App.setStatus("Ending auction...", "warning");
      App.showSpinner();
      var bidfinexContract;
        App.contract.deployed().then(function(instance) 
        {
            bidfinexContract = instance;
            bidfinexContract.endAuction(auction["auctionId"], {from:App.account, gas: 500000}).then(function(txnId) {
        console.log("End auction txnId: " + txId["tx"])
        setStatus("Auction ended successfully.");
        App.hideSpinner();
        App.refreshAuction();
      });
    });
    },

    isOwner: function() {
      return auction["seller"] == App.account;
    },

    constructAuctionView: function(auction) {
      $("#auctionTitle").text(auction["title"]);
      
      result = "<table class='auctionDetails'>";
      result += "<tr><td class='auctionlabel'>Status:</td><td>" + auction["status"] + "</td></tr>";
      result += "<tr><td class='auctionlabel'>Seller:</td><td>" + auction["seller"] + "</td></tr>";
      result += "<tr><td class='auctionlabel'>Title:</td><td>" + auction["title"] + "</td></tr>";
      result += "<tr><td class='auctionlabel'>Description:</td><td>" + auction["description"] + "</td></tr>";
      result += "<tr><td class='auctionlabel'>Current Bid:</td><td>" + web3.fromWei(auction["currentBid"], "ether") + " ETH" + "</td></tr>";
      result += "<tr><td class='auctionlabel'>Number of Bids:</td><td>" + auction["bidCount"] + "</td></tr>";
      result += "<tr><td class='auctionlabel'>Deadline Block Number:</td><td>" + auction["blockNumberOfDeadline"] + " <span id='deadlineCountdown'></span>" + "</td></tr>";
      
      //Place bid button
      if (auction["status"] == "Active" && currentBlockNumber <= auction["blockNumberOfDeadline"]) {
    result += "<tr><td class='auctionLabel'>Bid (in eth):</td><td><input type='text' id='bid_value' placeholder='eg 3.0'></input></td></tr>";
    result += "<tr><td class='auctionLabel'>&nbsp;</td><td><button id='bid_button' class='btn btn-primary' onclick='App.placeBid()'>Place Bid</button></td></tr>";
      }
  
      //End auction button
      if (auction["status"] == "Active" && currentBlockNumber > auction["blockNumberOfDeadline"]) {
    result += "<tr><td class='auctionLabel'>End Auction:</td><td><button id='end_button' onclick='App.endAuction()'>End Auction</button></td></tr>";
      }
  
      result += "</table>";
  
    return result;
  },

  getParameterByName: function(name, url) {
    if (!url) url = window.location.href;
    name = name.replace(/[\[\]]/g, "\\$&");
    var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
        results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, " "));
},

    waitAndRefresh: function(count)
    {
      if (App.aucs.length < count)
      {
        console.log("Sleeping, Count: "+count+" Length: "+App.aucs.length);
        setTimeout(App.waitAndRefresh, 500, count);
      }
      else
      {
        var auctionSection = document.getElementById("userAuctions");
        var res = "";
        for (var j = 0; j < count; j++)
        {
          var auc = App.aucs[j];
          if (parseInt(auc[4]) > currentBlockNumber)
          {
            res = res + "<tr>";
            res = res + "<td><a href='auction.html?auctionId=" + auc[2] + "'>" + auc[1] + "</a></td>";
            res = res + "<td>" + web3.fromWei(auc[7], "ether") + " ETH" + "</td>";
            res = res + "<td>" + auc[8] + "</td>";
            res = res + "<td>" + auc[4] + "</td>";
            res = res + "</tr>";
          }
        }
        console.log("Updating auctions!");
        auctionSection.innerHTML = res;
        App.setStatus("");
      }
    },
  
    updateEthNetworkInfo: function()
    {
      console.log("Updating network information");
      var address = document.getElementById("address");
      address.innerHTML = App.account;
  
      var ethBalance = document.getElementById("ethBalance");
      web3.eth.getBalance(App.account, function(err, bal)
      {
        ethBalance.innerHTML = web3.fromWei(bal, "ether") + " ETH";
      });
  
      var withdrawBalance = document.getElementById("withdrawBalance");
          var bidfinexContract;
      App.contract.deployed().then(function(instance)
      {
        bidfinexContract = instance;
        if (typeof bidfinexContract != 'undefined' && typeof App.account != 'undefined')
        {
          web3.eth.getBalance(bidfinexContract.address, function(err, bal) 
          {
          console.log("contract balance: " + bal);
          });
  
          bidfinexContract.getRefundValue.call({from:App.account}).then(function(refundBalance)
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
          });
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
      },
    
    watchEvents: function()
    {
	    var bidfinexContract;
        App.contract.deployed().then(function(instance) 
        {
    	    bidfinexContract = instance;
    	    var events = bidfinexContract.allEvents();

		    events.watch(function(err, msg)
		    {
			    if(err) {
				    console.log("Error: " + err);
			    } 
			    else 
			    { 
				    console.log("Got an event: " + msg.event);
			    }
		    });

		var filter = web3.eth.filter("latest");
		filter.watch(function(err, block) {
		// Call get block number on every block
		});
	});
	},
  
    setStatus: function(message, category)
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
  },
  
    withdraw: function() 
    {
      var bidfinexContract;
      App.contract.deployed().then(function(instance) 
      {
        bidfinexContract = instance;
        if (typeof bidfinexContract != 'undefined' && typeof App.account != 'undefined')
        {
          App.setStatus("Withdrawing fund...", "warning"); 
          App.showSpinner();
  
          bidfinexContract.withdrawRefund({from:App.account, gas:500000}).then(function(txId)
          {
            App.setStatus("Withdraw finished."); 
            App.hideSpinner();
            App.updateEthNetworkInfo();
          });
        }
      });
    },
  
    updateInfoBox: function(html) 
    {
      var infoBox = document.getElementById("infoPanelText");
      infoBox.innerHTML = html;
    },
  
    hideSpinner: function() 
    {
      $("#spinner").hide();
    },
  
    showSpinner: function() 
    {
      $("#spinner").show();
    },
  
    updateBlockNumber: function() 
    {
      web3.eth.getBlockNumber(function(err, blockNumber) 
      {
        currentBlockNumber = blockNumber;
        console.log("Current block number is: " + blockNumber);
      });
    },
  
    getAuction: function(auctionId) 
    {
      var bidfinexContract;
      App.contract.deployed().then(function(instance) 
      {
        bidfinexContract = instance;
        bidfinexContract.getAuction.call(auctionId).then(function(auction) 
        {
          console.log("loading: " + auctionId);
          auction[9] = auctionId;
          App.aucs.push(auction);
        });
      });
    }
  
  };
  
  $(function() 
  {
    $(window).load(function() 
    {
      App.init();
    });
  });
  