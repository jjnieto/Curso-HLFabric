// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
}

contract TokenGovernance {
    IERC20 public governanceToken;
    address public owner;

    struct Proposal {
        string description;
        uint256 deadline;
        uint256 yesVotes;
        uint256 noVotes;
        bool active;
        mapping(address => bool) hasVoted;
    }

    Proposal private currentProposal;

    event ProposalCreated(string description, uint256 deadline);
    event Voted(address indexed voter, uint256 weight, bool support);
    event ProposalClosed(string result, uint256 yesVotes, uint256 noVotes);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not authorized");
        _;
    }

    constructor(address _tokenAddress) {
        governanceToken = IERC20(_tokenAddress);
        owner = msg.sender;
    }

    function createProposal(string memory _description, uint256 _durationMinutes) external onlyOwner {
        require(!currentProposal.active || block.timestamp >= currentProposal.deadline, "Another proposal is active");

        Proposal storage p = currentProposal;
        p.description = _description;
        p.deadline = block.timestamp + (_durationMinutes * 1 minutes);
        p.yesVotes = 0;
        p.noVotes = 0;
        p.active = true;

        emit ProposalCreated(_description, p.deadline);
    }

    function vote(uint8 choice) external {
        require(currentProposal.active, "No active proposal");
        require(block.timestamp < currentProposal.deadline, "Voting ended");
        require(!currentProposal.hasVoted[msg.sender], "Already voted");
        require(choice == 0 || choice == 1, "Invalid choice");

        uint256 weight = governanceToken.balanceOf(msg.sender);
        require(weight > 0, "No voting power");

        currentProposal.hasVoted[msg.sender] = true;

        if (choice == 1) {
            currentProposal.yesVotes += weight;
        } else {
            currentProposal.noVotes += weight;
        }

        emit Voted(msg.sender, weight, choice == 1);
    }

    function closeProposal() external onlyOwner {
        require(currentProposal.active, "No active proposal");
        require(block.timestamp >= currentProposal.deadline, "Deadline not reached");

        currentProposal.active = false;

        string memory result;
        if (currentProposal.yesVotes > currentProposal.noVotes) {
            result = "Proposal PASSED";
        } else if (currentProposal.noVotes > currentProposal.yesVotes) {
            result = "Proposal REJECTED";
        } else {
            result = "TIE";
        }

        emit ProposalClosed(result, currentProposal.yesVotes, currentProposal.noVotes);
    }

    function getCurrentProposal()
        external
        view
        returns (
            string memory description,
            uint256 deadline,
            uint256 yes,
            uint256 no,
            bool active
        )
    {
        return (
            currentProposal.description,
            currentProposal.deadline,
            currentProposal.yesVotes,
            currentProposal.noVotes,
            currentProposal.active
        );
    }
}
