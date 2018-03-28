pragma solidity ^0.4.19;

contract bidfinex {
    
    struct bid
    {
        address bidder;
        uint256 amount;
        uint timestamp;
    }

    enum auctionStatus { Pending, Live, Dead }

    struct auction {
        address seller;
        string title;
        string recordId;
        string description;
        auctionStatus status;
        uint deadline; //Deadline will be block number as contract will not have access to time and date.
        address productAddress;
        
        //Price will be in wei a unit of gas.
        uint256 startingPrice;
        uint256 reservedPrice;
        uint256 currentBid;

        bid[] bids;
    }

    mapping(address => uint[]) public auctionRefunds;
    mapping(address => uint[]) public auctionOwnerMap;
    mapping(address => uint[]) public auctionBidderMap;
    //mapping(string => bool) public activeAuctionProductMap; //Maintain dictionary of product address + record id to check if they are already on auction

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

        if (block.number >= temp.deadline)
        revert();
        
        _;
    }

    event throwError(string message);
    
    function bidfinex() public {
        owner = msg.sender;
    }

    /*function createAuction( string _title,
                            string _description,
                            string _productAddress,
                            string _recordId,
                            uint _deadline,
                            uint256 _startingPrice,
                            uint256 _reservePrice )
                            public returns (uint auctionId) {

        if(!personOwnsAsset(msg.sender, _productAddress, _recordId)) {
            throwError("Seller does not own the product");
            revert();
        }
        
        else if(block.number >= _deadline) {
            throwError("Invalid deadline entered");
            revert();
        }

        else if (_startingPrice < 0 || _reservePrice < 0) {
            throwError("Invalid value entered for price section");
            revert();
        }*/
}