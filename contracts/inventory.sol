pragma solidity ^0.4.19;

contract product {
    struct object {
        string ownerName;
        uint objectId;
        string productName;
        address ownerAddress;
    }
    uint private objId = 0;
    mapping(uint => object) products;
    
    modifier onlyOwner(uint _objectId) {
        if(products[_objectId].ownerAddress != msg.sender)
        revert();
        _;
    }

    function getOwner(uint _objectId) public view returns (string _name, address ownerAddress) {
        return (products[_objectId].ownerName, products[_objectId].ownerAddress);
    }

    function getOwnerAddress(uint _objectId) public view returns (address ownerAddress) {
        return products[_objectId].ownerAddress;
    }
    
    function setOwner(uint _objectId, string _newOwnerName, address _newOwnerAddress) 
    onlyOwner(_objectId) public returns (bool success) {
        products[_objectId].ownerName = _newOwnerName;
        products[_objectId].ownerAddress = _newOwnerAddress;
        return true;
    }

    function addProduct(address _ownerAddress, string _ownerName, string _productName) public returns (bool success) {
        object memory obj = products[objId];
        
        obj.ownerAddress = _ownerAddress;
        obj.ownerName = _ownerName;
        obj.productName = _productName;
        objId++;
        return true;
    }
}