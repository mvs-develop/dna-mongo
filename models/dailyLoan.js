const mongoose = require('../db/mongoose');

const DailyLoan = mongoose.model('dailyloan', {
    //资产id
    asset: { type: String },

    //日期字符串，日期从格林威治0点计算
    date: { type: String },

    //账户id
    account: { type: String },

    //当日结束总供应量
    total_supply: { type: Number, default: 0 },
    //当日新增供应量
    // inc_supply: { type: Number, default: 0 },

    //当日结束总借出
    total_borrow: { type: Number, default: 0 },
    //当日新增借出
    // inc_borrow: { type: Number, default: 0 },

    //当日结束供应apy
    // apy_supply: { type: Number, default: "0" },

    // //当日结束贷款APY
    // apy_borrow: { type: Number, default: "0" },

    // //当日结束贷款使用率
    // utilization: { type: Number, default: "0" },

    //代币价格: 先以实时价格计算吧
    //price: { type: Number }
});
DailyLoan.collection.createIndex({ asset: 1, date: 1, account: 1 }, { unique: true })
DailyLoan.collection.createIndex({ asset: 1, date: 1 })
DailyLoan.collection.createIndex({ account: 1, date: 1 })

module.exports = DailyLoan;
