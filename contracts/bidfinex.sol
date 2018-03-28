pragma solidity ^0.4.19;

import "./inventory.sol";

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
        uint recordId;
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
    mapping(string => bool) private activeAuctionProductMap; //Maintain dictionary of product address + record id to check if they are already on auction

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
                            address _productAddress,
                            uint _recordId,
                            uint _deadline,
                            uint256 _startingPrice,
                            uint256 _reservedPrice )
                            public returns (uint auctionId) {

        if(!personOwnsAsset(msg.sender, _productAddress, _recordId)) {
            throwError("Seller does not own the product");
            revert();
        }
        
        //else
        if(block.number >= _deadline) {
            throwError("Invalid deadline entered");
            revert();
        }

        else if (_startingPrice < 0 || _reservedPrice < 0 || _reservedPrice < _startingPrice) {
            throwError("Invalid value entered for price section");
            revert();
        }

        else if(activeAuctionProductMap[strconcat(addressToString(_productAddress), _recordId)] == true) {
            throwError("Item already in auction");
            revert();
        }

        auctionId = auctions.length++;
        auction storage newAuction = auctions[auctionId];
        
        newAuction.seller = msg.sender;
        newAuction.title = _title;
        newAuction.recordId = _recordId;
        newAuction.description = _description;
        newAuction.status = auctionStatus.Pending;
        newAuction.deadline = _deadline;
        newAuction.productAddress = _productAddress;
        newAuction.startingPrice = _startingPrice;
        newAuction.reservedPrice = _reservedPrice;
        newAuction.currentBid = _reservedPrice;

        auctionOwnerMap[newAuction.seller].push(auctionId);
        activeAuctionProductMap[strconcat(addressToString(_productAddress), _recordId)] = true;

        auctionCreated(auctionId, newAuction.title, newAuction.startingPrice, newAuction.reservedPrice);

        return auctionId;
    }

    function personOwnsAsset(address _person, address _product, uint _recordId) private view returns (bool success) {
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
    }
}