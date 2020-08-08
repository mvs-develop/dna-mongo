const db = {
    mongodb: process.env.MONGODB || "mongodb://mongo:mongo@localhost/dnamongo?authSource=admin"
}

const dna = {
    coreTokenSymbol: process.env.CORE_TOKEN_SYMBOL || "DNA",
    keyPrefix: process.env.KEY_PREFIX || "DNA",
    chainId: "24938a99198d850bb7d79010c1325fb63fde63e8e477a5443ff5ce50ab867055",
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
