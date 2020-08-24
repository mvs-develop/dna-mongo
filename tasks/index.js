const BlocksScan = require('./block');
const AccountsScan = require('./account');
const TransactionScan = require('./transaction');
const WsRpc = require('../dna/wsRpc');

async function start() {


    let wsRpc = new WsRpc();
    //TypeError: Cannot read property 'call' of null??
    let blockScan = new BlocksScan({}, wsRpc);
    await blockScan.init();
    blockScan.start();


    let accountScan = new AccountsScan({}, wsRpc);
    accountScan.start();


    let tranScan = new TransactionScan({}, wsRpc);
    tranScan.start();

}

start().catch(console.log);