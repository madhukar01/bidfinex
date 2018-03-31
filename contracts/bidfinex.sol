pragma solidity ^0.4.19;

contract bidfinex {
    
    struct bid
    {
        address bidder;
        uint256 amount;
        uint timestamp;
    }

    enum auctionStatus { Live, Dead }

    struct auction {
        address seller;
        string title;
        uint auctionId;
        string description;
        auctionStatus status;
        uint deadline; //Deadline will be block number as contract will not have access to time and date.
        
        //Price will be in wei a unit of gas.
        uint256 startingPrice;
        uint256 reservedPrice;
        uint256 currentBid;

        bid[] bids;
    }

    mapping(address => uint256) public auctionRefunds;
    mapping(address => uint[]) public auctionOwnerMap;
    mapping(address => uint[]) public auctionBidderMap;
    
    auction[] public auctions;
    address owner;
    
    modifier onlySeller (uint auctionId) {
        if (auctions[auctionId].seller != msg.sender)
        revert();
        _;
    }
    
    modifier onlyOwner {
        if (owner != msg.sender)
        revert();
        _;
    }

    modifier onlyActive (uint auctionId) {
        auction memory temp = auctions[auctionId];
        
        if (temp.status != auctionStatus.Live)
        revert();

        else if (block.number >= temp.deadline)
        revert();
        
        _;
    }

    event throwError(string message);
    event auctionCreated(uint id, string title, uint256 startingPrice, uint256 reservePrice);
    event auctionStarted(uint id);
    event auctionCancelled(uint id);
    event bidPlaced(uint auctionId, address bidder, uint256 amount);
    event auctionSold(uint auctionId, address winningBidder, uint256 amount);
    event auctionUnsold(uint auctionId, uint256 topBid, uint256 reservePrice);

    function bidfinex() public {
        owner = msg.sender;
    }

    function createAuction( string _title,
                            string _description,
                            uint _deadline,
                            uint256 _startingPrice,
                            uint256 _reservedPrice )
                            public returns (uint id) {

        //else
        if(block.number >= _deadline) {
            throwError("Invalid deadline entered");
            revert();
        }

        else if (_startingPrice < 0 || _reservedPrice < 0 || _reservedPrice < _startingPrice) {
            throwError("Invalid value entered for price section");
            revert();
        }

        id = auctions.length++;
        auction storage newAuction = auctions[id];
        
        newAuction.seller = msg.sender;
        newAuction.title = _title;
        newAuction.auctionId = id;
        newAuction.description = _description;
        newAuction.status = auctionStatus.Live;
        newAuction.deadline = _deadline;
        newAuction.startingPrice = _startingPrice;
        newAuction.reservedPrice = _reservedPrice;
        newAuction.currentBid = _reservedPrice;

        auctionOwnerMap[newAuction.seller].push(id);

        auctionCreated(id, newAuction.title, newAuction.startingPrice, newAuction.reservedPrice);

        return id;
    }
    
    function getAuction(uint idx) public view returns (address, uint, string, string, uint, uint256, uint256, uint256, uint) {
        auction memory temp = auctions[idx];
        if (temp.seller == 0) 
            revert();

        return (temp.seller,
                temp.auctionId,
                temp.title,
                temp.description,
                temp.deadline,
                temp.startingPrice,
                temp.reservedPrice,
                temp.currentBid,
                temp.bids.length);
    }

    function getAuctionCount() public view returns (uint) {
        return auctions.length;
    }

    function getAuctionStatus(uint idx) public view returns (uint) {
        auction memory temp = auctions[idx];
        return uint(temp.status);
    }

    function getAuctionCountForUser(address user) public view returns (uint) {
        return auctionOwnerMap[user].length;
    }

    function getAuctionIdForUserIdx(address user, uint idx) public view returns (uint) {
        return auctionOwnerMap[user][idx];
    }

    function cancelAuction(uint auctionId) onlySeller(auctionId) public returns (bool) {
        auction memory temp = auctions[auctionId];
        
        if (temp.currentBid >= temp.reservedPrice) revert();   // Auction cannot be cancelled if there is a bid already

        // Refund to the bidder
        uint bidsLength = temp.bids.length;
        if (bidsLength > 0) {
            bid memory topBid = temp.bids[bidsLength - 1];
            auctionRefunds[topBid.bidder] += topBid.amount;
        }
        temp.status = auctionStatus.Dead;
                
        auctionCancelled(auctionId);
        return true;
    }
    
    function getBidCountForAuction(uint auctionId) public view returns (uint) {
        auction memory temp = auctions[auctionId];
        return temp.bids.length;
    }

    function getBidForAuctionByIdx(uint auctionId, uint idx) public view returns (address bidder, uint256 amount, uint timestamp) {
        auction memory temp = auctions[auctionId];
        if(idx > temp.bids.length - 1)
            revert();

        bid memory tempBid = temp.bids[idx];
        return (tempBid.bidder, tempBid.amount, tempBid.timestamp);
    }
    
    function placeBid(uint auctionId) public payable onlyActive(auctionId) returns (bool success) {
        uint256 amount = msg.value;
        auction memory temp = auctions[auctionId];

        if (temp.currentBid >= amount)
            revert();

        uint bidIdx = temp.bids.length + 1;
        bid memory tempBid = temp.bids[bidIdx];
        tempBid.bidder = msg.sender;
        tempBid.amount = amount;
        tempBid.timestamp = block.timestamp;
        temp.currentBid = amount;

        auctionOwnerMap[tempBid.bidder].push(auctionId);

        // Log refunds for the previous bidder
        if (bidIdx > 0) {
            bid memory previousBid = temp.bids[bidIdx - 1];
            auctionRefunds[previousBid.bidder] += previousBid.amount;
        }

        bidPlaced(auctionId, tempBid.bidder, tempBid.amount);
        return true;
    }
    /*function personOwnsAsset(address _person, address _product, uint _recordId) private view returns (bool success) {
        product productContract = product(_product);
        return productContract.getOwnerAddress(_recordId) == _person;
    }
    
    function strconcat(string _first, uint _second) internal pure returns (string) {
        bytes memory temp1 = bytes(_first);
        bytes memory temp2 = bytes(uintToString(_second));
        bytes memory ans = new bytes(temp1.length + temp2.length);

        uint k = 0;
        for (uint i = 0; i < temp1.length; ++i)
            ans[k++] = temp1[i];
        for (i = 0; i < temp2.length; ++i)
            ans[k++] = temp2[i];
        
        return string(ans);
    }

    function addressToString(address _temp) internal pure returns (string) {
        bytes memory temp = new bytes(20);
        for (uint i = 0; i < 20; ++i)
            temp[i] = byte(uint8(uint(_temp) / (2**(8*(19-i)))));
        
        return string(temp);
    }

    function uintToString(uint v) internal pure returns (string) {
        uint maxlength = 100;
        uint temp = v;
        bytes memory reversed = new bytes(maxlength);
        uint i = 0;
        while (temp != 0) {
            uint remainder = temp % 10;
            temp = temp / 10;
            reversed[i++] = byte(48 + remainder);
        }
        
        bytes memory s = new bytes(i);
        for (uint j = 0; j < i; j++) {
            s[j] = reversed[i - 1 - j];
        }
        
        return string(s);
    }*/
}