const mongoose = require('../db/mongoose');

const Account = mongoose.model('account', {
    id: { type: String },
    id_int: { type: Number },
    name: { type: String },
    address: { type: String },

    owner_key: { type: Array },
    active_key: { type: Array },
    memo_key: { type: String },

    timestamp: { type: Date },

    //statistics.total_ops
    transactions: { type: Number },

    //目前只显示DNA代币
    total_balance: { type: String },
    available_balance: { type: String },
    vesting_balance: { type: String },

    voting_account: { type: String },
    // votes: { type: Array }
});
Account.collection.createIndex({ id: 1 }, { unique: true })
Account.collection.createIndex({ id_int: 1 }, { unique: true })
Account.collection.createIndex({ total_balance: -1 })
Account.collection.createIndex({ available_balance: -1 })
Account.collection.createIndex({ vesting_balance: -1 })
Account.collection.createIndex({ timestamp: -1 })

module.exports = Account;