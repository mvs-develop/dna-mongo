const mongoose = require('../db/mongoose');

const Transaction = mongoose.model('transaction', {
    block_height: { type: Number, index: true },
    block_index: { type: Number },

    hash: { type: String, index: true, unique: true },

    //同区块的确认
    confirmed: { type: Boolean },

    //以下为后期计算，确认后定时任务计算
    type: { type: String },//类型
    sender: { type: String },
    receiver: { type: String },
    value: { type: String },
    token: { type: String },
    fee_value: { type: String },
    fee_token: { type: String },

    operation_type: { type: Number },

    timestamp: { type: Date },

    operations: { type: Array },
    operation_results: { type: Array },


    //是否已经检查过
    //单个任务检查交易，把交易的影响（如创建账户）写入数据库
    checked: { type: Boolean },

    loan_checked: { type: Boolean },

});

Transaction.collection.createIndex({ block_height: 1, confirmed: 1 })

module.exports = Transaction;