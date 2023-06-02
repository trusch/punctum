// SPDX-License-Identifier: MIT
pragma solidity >=0.4.22 <0.9.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract Punctum is ERC721, ERC721Enumerable, ERC721Burnable, AccessControl {
    using Counters for Counters.Counter;
    using Strings for uint256;

    // events to fire when the baseURI is updated (required by raresama indexer)
    event URIAll();
    event ContractURI();
    event BidPlaced();
    event AuctionStarted();

    Counters.Counter private tokenIdCounter;
    mapping(uint => string) tokenURIs;
    uint currentBid;
    address currentHighestBidder;
    uint auctionEndTime;

    string public constant METADATA_EXTENSION = ".json";

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    constructor() ERC721("Punctum", "PCTM") {
        _grantRole(ADMIN_ROLE, msg.sender);
        _setRoleAdmin(ADMIN_ROLE, ADMIN_ROLE);
    }

    function contractURI() public pure returns (string memory) {
        return "ipfs://.../contract.json";
    }

    // returns next token id, highest bidder, highest bid and endtime
    function auctionState() public view returns (uint, address, uint, uint) {
        return (tokenIdCounter.current(), currentHighestBidder, currentBid, auctionEndTime);
    }

    function tokenURI(
        uint256 _tokenId
    ) public view virtual override returns (string memory) {
        string memory uri = tokenURIs[_tokenId];
        require(bytes(uri).length > 0, "Token URI not set");
        return uri;
    }

    function startNextAuction(string memory _tokenURI, uint _duration) public {
        require(hasRole(ADMIN_ROLE, msg.sender));
        require(_duration > 0, "Duration must be greater than 0");
        require(
            auctionEndTime < block.number,
            "Previous auction not yet ended"
        );
        tokenIdCounter.increment();
        tokenURIs[tokenIdCounter.current()] = _tokenURI;
        auctionEndTime = block.number + _duration;
        currentBid = 0;
        currentHighestBidder = address(0);
        emit AuctionStarted();
    }

    function bid() public payable {
        require(auctionEndTime > block.number, "Auction already ended");
        require(msg.value > currentBid, "Bid must be higher than current bid");
        require(
            msg.sender != currentHighestBidder,
            "You are already the highest bidder"
        );
        if (currentHighestBidder == address(0)) {
            currentBid = msg.value;
            currentHighestBidder = msg.sender;
            return;
        }
        // respect checks+updates+interactions order
        address lastBidder = currentHighestBidder;
        uint lastBid = currentBid;
        currentBid = msg.value;
        currentHighestBidder = msg.sender;
        payable(lastBidder).transfer(lastBid);  
        emit BidPlaced();      
    }

    function closeAuction() public {
        require(auctionEndTime < block.number, "Auction not yet ended");
        require(currentHighestBidder != address(0), "No bids");
        uint256 tokenId = tokenIdCounter.current();

        if (currentHighestBidder == address(0)) {
            currentHighestBidder = address(0);
            currentBid = 0;
            auctionEndTime = 0;
            return;        
        }
        // respect checks+updates+interactions order        
        address target = currentHighestBidder;
        currentHighestBidder = address(0);
        currentBid = 0;
        auctionEndTime = 0;
        _safeMint(target, tokenId);
    }

    // This function is used to withdraw the funds from the contract to the sender
    function withdraw() public payable {
        require(hasRole(ADMIN_ROLE, msg.sender));
        uint amount = address(this).balance;
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "Failed to send token");
    }

    // This function is used to withdraw the funds from the contract to a specific address
    function withdrawTo(address payable to, uint amount) public payable {
        require(hasRole(ADMIN_ROLE, msg.sender));
        require(
            amount <= address(this).balance,
            "Not enough funds in contract"
        );
        (bool success, ) = to.call{value: amount}("");
        require(success, "Failed to send token");
    }

    /*************************
     * VIEW FUNCTIONS        *
     *************************/

    // Return all tokens owned by an address
    function tokensOfOwner(
        address _owner
    ) external view returns (uint256[] memory) {
        uint256 tokenCount = balanceOf(_owner);
        uint256[] memory result = new uint256[](tokenCount);
        for (uint256 i = 0; i < tokenCount; i++) {
            result[i] = tokenOfOwnerByIndex(_owner, i);
        }
        return result;
    }

    /*************************
     * INTERNAL FUNCTIONS    *
     *************************/

    // This function needs to be overwritten to make the contract behave correctly with regards to enumerating
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batchSize
    ) internal override(ERC721, ERC721Enumerable) {
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
    }

    // This function exposes all interfaces that the contract supports
    function supportsInterface(
        bytes4 interfaceId
    )
        public
        view
        override(ERC721, ERC721Enumerable, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
