pragma solidity ^0.4.19;

contract bidfinex {
    
    struct bid
    {
        address bidder;
        uint256 amount;
        uint timestamp;
    }

    enum auctionStatus { Pending, Active, Sold }

    struct auction {
        address seller;
        string title;
        string id;
        string description;
        auctionStatus status;
        uint deadline; //Deadline will be block number as contract will not have access to time and date.
        
        //Price will be in wei a unit of gas.
        uint256 startingPrice;
        uint256 reservedPrice;
        uint256 currentBid;

        bid[] bids;
    }

    mapping(address => uint[]) public auctionRefunds;
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
        if (auctions[auctionId].status != auctionStatus.Active)
        revert();
        _;
    }
}