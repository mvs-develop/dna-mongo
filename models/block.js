const mongoose = require('../db/mongoose');

const Block = mongoose.model('block', {
    height: { type: Number },
    hash: { type: String },

    //以下：计算的数据
    confirmed: { type: Boolean },
    transactions: { type: Number },
    bytes: { type: Number },

    //以下：从rpc接口获取的数据
    previous: { type: String, },
    timestamp: { type: Date },
    witness: { type: String },
    //transaction_merkle_root:String,
    //extensions:Array
    //witness_signature: { type: String }
    //transactions //另外的标保存

});
Block.collection.createIndex({ height: 1 }, { unique: true })
Block.collection.createIndex({ hash: 1 }, { unique: true })
Block.collection.createIndex({ previous: 1 }, { unique: true })
Block.collection.createIndex({ witness: 1 })
Block.collection.createIndex({ height: 1, confirmed: 1 });

module.exports = Block;