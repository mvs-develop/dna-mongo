const db = {
    mongodb: process.env.MONGODB || "mongodb://mongo:mongo@localhost/dnamongo?authSource=admin"
}

const dna = {
    coreTokenSymbol: process.env.CORE_TOKEN_SYMBOL || "DNA",
    coreTokenId: process.env.CORE_TOKEN_ID || "1.3.0",
    keyPrefix: process.env.KEY_PREFIX || "DNA",
    chainId: process.env.CHAIN_ID || "24938a99198d850bb7d79010c1325fb63fde63e8e477a5443ff5ce50ab867055",
    genesisTime: new Date(process.env.GENESIS_TIME || "Fri Aug 5 2020 21:00:00 GMT+0800")
}

const node = {
    wsRpc: process.env.WS_RPC || "wss://mvsdna.info/ws",
    //wsRpc: process.env.WS_RPC || "ws://127.0.0.1:8390"
}

module.exports = {
    db,
    node,
    dna
}
