pragma solidity ^0.4.2;

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
        uint deadline;
        uint256 startingPrice;
        uint256 reservedPrice;
        uint256 currentBid;
        bid[] bids;
    }

    mapping(address => uint256) public auctionRefunds;
    mapping(address => uint[]) public auctionOwnerMap;
    mapping(address => uint[]) public auctionBidderMap;
    
    auction[] public auctions;
    
    modifier onlySeller (uint auctionId) {
        if (auctions[auctionId].seller != msg.sender)
        {
            emit throwError("Error: You are not the seller of this auction !");
            revert();
        }
        _;
    }

    modifier onlyActive (uint auctionId) {
        auction memory temp = auctions[auctionId];
        
        if (temp.status != auctionStatus.Live)
        {
            emit throwError("Error: Auction is not live !");            
            revert();
        }

        else if (block.number >= temp.deadline)
        {
            emit throwError("Error: Deadline has crossed !");                        
            revert();
        }
        _;
    }

    event throwError(string message);
    event auctionCreated(uint id, string title, uint256 startingPrice, uint256 reservePrice);
    event auctionStarted(uint id);
    event auctionCancelled(uint id);
    event bidPlaced(uint auctionId, address bidder, uint256 amount);
    event auctionSold(uint auctionId, address winningBidder, uint256 amount);
    event auctionUnsold(uint auctionId, uint256 topBid, uint256 reservePrice);
    event withdrawalSuccess(uint amount, address accountAddress);

    constructor() public {
    }

    function createAuction( string _title,
                            string _description,
                            uint _deadline,
                            uint256 _startingPrice,
                            uint256 _reservedPrice )
                            public returns (uint id)
    {
        if(block.number >= _deadline)
        {
            emit throwError("Invalid deadline entered");
            revert();
        }

        if (_startingPrice < 0 || _reservedPrice < 0 || _reservedPrice < _startingPrice)
        {
            emit throwError("Invalid value entered for price section");
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

        auctionOwnerMap[newAuction.seller].push(id);

        emit auctionCreated(id, newAuction.title, newAuction.startingPrice, newAuction.reservedPrice);

        return id;
    }
    
    function getAuction(uint idx) public view returns (address, uint, string, string, uint, uint256, uint256, uint256, uint)
    {
        auction memory temp = auctions[idx];
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

    /*
    0 -> Seller
    1 -> Auction ID
    2 -> Title
    3 -> Description
    4 -> Deadline
    5 -> Starting price
    6 -> Reserved price
    7 -> Current bid
    8 -> # of bids
    */
    function getAuctionCount() public view returns (uint)
    {
        return auctions.length;
    }

    function getAuctionStatus(uint idx) public view returns (uint)
    {
        auction memory temp = auctions[idx];
        return uint(temp.status);
    }

    function getAuctionCountForUser(address user) public view returns (uint)
    {
        return auctionOwnerMap[user].length;
    }

    function getAuctionIdForUserIdx(address user, uint idx) public view returns (uint)
    {
        return auctionOwnerMap[user][idx];
    }

    function getBidCountForAuction(uint auctionId) public view returns (uint)
    {
        auction memory temp = auctions[auctionId];
        return temp.bids.length;
    }
    
    function placeBid(uint auctionId) public payable onlyActive(auctionId) returns (bool success)
    {
        uint256 amount = msg.value;
        auction storage temp = auctions[auctionId];

        if (temp.currentBid >= amount)
        {
            emit throwError("Error: Amount bid is less than the latest bid !");
            revert();
        }

        uint bidIdx = temp.bids.length++;
        bid storage tempBid = temp.bids[bidIdx];
        tempBid.bidder = msg.sender;
        tempBid.amount = amount;
        tempBid.timestamp = block.timestamp;
        temp.currentBid = amount;

        auctionBidderMap[tempBid.bidder].push(auctionId);

        // Log refunds for the previous bidder
        if (bidIdx > 0) {
            bid memory previousBid = temp.bids[bidIdx - 1];
            auctionRefunds[previousBid.bidder] += previousBid.amount;
        }

        emit bidPlaced(auctionId, tempBid.bidder, tempBid.amount);
        return true;
    }

    function getRefundValue() public view returns (uint) {
        return auctionRefunds[msg.sender];
    }

    function withdrawRefund() public {
        uint256 refund = auctionRefunds[msg.sender] - 1;

        if (refund <= 0)
        {
            emit throwError("Error: Invalid refund amount !");
            revert();
        }
        else if(address(this).balance <= refund)
        {
            emit throwError("Error: Insifficient funds in contract, Try again later !");
            revert();
        }

        if(msg.sender.send(refund))
        {
            emit withdrawalSuccess(refund, msg.sender);
            auctionRefunds[msg.sender] = 0;
        }
        else
        {
            emit throwError("Withdraw failed !");
        }
    }

    function endAuction(uint auctionId) public returns (bool success)
    {
        auction memory temp = auctions[auctionId];

        if (temp.bids.length == 0) {
            temp.status = auctionStatus.Dead;
            emit auctionUnsold(auctionId, 0, 0);
            return true;
        }

        else
        {
            bid memory topBid = temp.bids[temp.bids.length - 1];

            if (temp.currentBid >= temp.reservedPrice)
            {
                auctionRefunds[temp.seller] += temp.currentBid;
                emit auctionSold(auctionId, topBid.bidder, temp.currentBid);
            }
            else
            {
                auctionRefunds[topBid.bidder] += temp.currentBid;
                emit auctionUnsold(auctionId, temp.currentBid, temp.reservedPrice);
            }

            temp.status = auctionStatus.Dead;
            return true;
        }
    }

    function () public {
        emit throwError("Error: No data sent !");
        revert();
    }
}