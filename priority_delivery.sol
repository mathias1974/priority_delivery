pragma solidity ^0.4.0;

contract priorityDelivery {

    struct Channel {
        address senderPub;
        uint sentETH;
        uint size;
    }

    mapping (string => Channel) channels;

    address public admin;
    uint lockTxCost;

    function () payable { }

    function priorityDelivery(uint __lockTxCost) payable {
        lockTxCost = __lockTxCost;
        admin = msg.sender;
    }

    function getChannel(string senderHash) constant returns(uint size)
    {
        return channels[senderHash].sentETH;
    }

    function openChannel(string senderHash) payable returns(bool result)
    {
        if (msg.value >= lockTxCost) {

          // uint size = (msg.value * 100) / (0.000000002 * 24227);
          uint size = 100; // @todo tmp: actual size is calculated on javascript and depends from sentETH.

          channels[senderHash] = Channel({
            size : size,
            senderPub : msg.sender,
            sentETH : msg.value
          });

          return true;
        }
     }

     function lockChannel(string senderHash) returns(bool result)
     {

        if (msg.sender != admin) return false;

        /*
        *   Refund fee to the contract admin, which he spent to close this channel.
        */

        // uint sent = channels[senderHash].sentETH;
        // uint change = sent - lockTxCost;

        msg.sender.send(lockTxCost);

        /*
         *   Close connection
         */

        delete channels[senderHash];

     }

}
