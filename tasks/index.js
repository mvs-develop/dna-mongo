const BlocksScan = require('./block');

async function start() {

    let blockScan = new BlocksScan();
    await blockScan.init();
    blockScan.start();
}

start().catch(console.log);