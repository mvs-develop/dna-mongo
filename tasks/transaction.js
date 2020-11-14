
const WsRpc = require('../dna/wsRpc');

const Transaction = require('../models/transaction');
const DailyLoan = require('../models/dailyLoan');
const BigNumber = require('bignumber.js');

const tranType = require('../dicts/tranType');
const operationType = require('../dna/operationType');
const moment = require('moment');

//检查交易类型
class TransactionScan {

    constructor(opts, wsRpc) {
        this.wsRpc = wsRpc || new WsRpc();
        this.defaultLoopTransactionTime = 1000;//0
        this.fastLoopTransactionTime = 10;//快速区块交易间隔时间，10
        this.maxScanTransactionCount = 100;//单次最多扫描交易
    }

    async init() {
        return true;
    }

    start() {
        let that = this;
        (function iteratorTransactions() {
            that.loopTransactions().then((nextTimeout) => {
                nextTimeout = nextTimeout || that.defaultLoopTransactionTime;
                setTimeout(() => {
                    iteratorTransactions();
                }, nextTimeout)
            }).catch((err) => {
                console.log("iteratorTransactions error: " + new Date().toString());
                console.log(err);
                let nextTimeout = that.defaultLoopTransactionTime;
                setTimeout(() => {
                    iteratorTransactions();
                }, nextTimeout)
            })
        })();


        (function iteratorLoanTransactions() {
            that.loopLoanTransactions().then((nextTimeout) => {
                nextTimeout = nextTimeout || that.defaultLoopTransactionTime;
                setTimeout(() => {
                    iteratorLoanTransactions();
                }, nextTimeout)
            }).catch((err) => {
                console.log("iteratorLoanTransactions error: " + new Date().toString());
                console.log(err);
                let nextTimeout = that.defaultLoopTransactionTime;
                setTimeout(() => {
                    iteratorLoanTransactions();
                }, nextTimeout)
            })
        })();
    }

    async loopTransactions() {
        let that = this;
        let uncheckTrans = await Transaction.find({
            checked: false
        }).limit(that.maxScanTransactionCount)
            .sort({ timestamp: 1 });
        if (!uncheckTrans.length) {
            return that.defaultLoopTransactionTime;
        }

        var bulk = Transaction.collection.initializeOrderedBulkOp();
        for (var i = 0; i < uncheckTrans.length; i++) {
            let tran = JSON.parse(JSON.stringify(uncheckTrans[i]));
            //{type,sender,receiver,value,token}
            //console.log(JSON.stringify(tran));
            let result = await that.checkTran(tran);
            //console.log(JSON.stringify(result));

            bulk.find({ hash: tran.hash }).updateOne({
                "$set": result
            });
        }

        await bulk.execute();
        console.log("check tran:" + uncheckTrans.length);

        if (uncheckTrans.length >= that.maxScanTransactionCount) {
            return that.fastLoopTransactionTime;
        }
        return that.defaultLoopTransactionTime;

    }

    //{type,sender,receiver,value,token}
    async checkTran(tran) {
        let result = {
            checked: true,
            type: tranType.UnKnown
        };
        try {
            if (!tran || !tran.operations || !tran.operations.length) {
                return result;
            }
            let firstOP = tran.operations[0];
            let opType = firstOP[0];
            let opObj = firstOP[1];
            result.operation_type = opType;
            if (opObj.fee) {
                result.fee_value = opObj.fee.amount;
                result.fee_token = opObj.fee.asset_id;
            }
            switch (opType) {
                case 0://transfer，转账
                    result.type = tranType.Transfer;
                    result.value = opObj.amount.amount;
                    result.token = opObj.amount.asset_id;
                    result.sender = opObj.from;
                    result.receiver = opObj.to;
                    break;
                case 5://注册账户
                    result.type = tranType.Register;
                    result.sender = opObj.registrar;
                    result.receiver = opObj.name;//TODO:这里直接是名字
                    break;
                case 6://account_update，部分为投票
                    if (opObj.new_options && opObj.new_options && opObj.new_options.votes && opObj.new_options.votes.length) {
                        result.type = tranType.Vote;
                        result.sender = opObj.account;
                        let vote_id = opObj.new_options.votes[0][0];
                        //TODO:投票目标
                        //result.to
                    }
                    break;
                case 8://account_upgrade_operation
                    result.type = tranType.AccountUpgrade;
                    result.sender = opObj.account_to_upgrade;
                    break;
                case 20://witness_create_operation
                    result.type = tranType.WitnessCreate;
                    result.sender = opObj.witness_account;
                    break;

                case 32://vesting_balance_create，锁仓
                    result.type = tranType.Lock;
                    result.value = opObj.amount.amount;
                    result.token = opObj.amount.asset_id;
                    result.sender = opObj.creator;
                    break;
                case 33://vesting_balance_withdraw_operation
                    result.type = tranType.Withdraw;
                    result.sender = opObj.owner;

                    result.value = opObj.amount.amount;
                    result.token = opObj.amount.asset_id;
                    break;
                case operationType.loan_asset_supply:
                    result.sender = opObj.account;
                    result.token = opObj.supply_type;
                    result.value = opObj.supply_amount;
                    break;
                case operationType.loan_asset_withdraw:
                    result.sender = opObj.account;
                    result.token = opObj.amount.asset_id;
                    result.value = opObj.amount.amount;
                    break;
                case operationType.loan_asset_borrow:
                    result.sender = opObj.account;
                    result.token = opObj.asset_type;
                    result.value = opObj.amount;
                    break;
                case operationType.loan_asset_repay:
                    result.sender = opObj.account;
                    result.token = opObj.asset_type;
                    result.value = opObj.amount;
                    break;
                default:
                    break;


            }
        } catch (err) {
            console.log("checkTran error");
            console.log(err);
        }

        return result;

    }

    async loopLoanTransactions() {
        let that = this;
        let checkType = [operationType.loan_asset_supply, operationType.loan_asset_withdraw, operationType.loan_asset_borrow, operationType.loan_asset_repay];
        let uncheckTrans = await Transaction.find({
            confirmed: true,
            operation_type: { $in: checkType },
            loan_checked: false
        }).limit(that.maxScanTransactionCount)
            .sort({ timestamp: 1 });
        if (!uncheckTrans.length) {
            return that.defaultLoopTransactionTime;
        }
        for (var i = 0; i < uncheckTrans.length; i++) {
            let tran = JSON.parse(JSON.stringify(uncheckTrans[i]));
            await that.loanDailyCheck(tran);
        }

        if (uncheckTrans.length >= that.maxScanTransactionCount) {
            return that.fastLoopTransactionTime;
        }
        return that.defaultLoopTransactionTime;

    }

    //
    async loanDailyCheck(tran) {

        await Transaction.updateOne({
            _id: tran._id
        }, {
            loan_checked: true
        })

        let date = moment(tran.timestamp).format("YYYY-MM-DD");// HH:mm
        let queryAccount = {
            asset: tran.token,
            date: date,
            account: tran.sender
        };
        let queryTotal = {
            asset: tran.token,
            date: date,
            account: ""
        };

        let dailyAccount = await DailyLoan.findOne(queryAccount);
        if (!dailyAccount) {
            let total = await DailyLoan.findOne(
                { asset: tran.token, account: tran.sender }
            ).sort({
                date: -1
            });
            console.log("total");
            console.log(JSON.stringify(total));
            dailyAccount = await DailyLoan.create({
                ...queryAccount,
                total_supply: total ? total.total_supply : 0,
                total_borrow: total ? total.total_borrow : 0
            });
        }
        let dailyTotal = await DailyLoan.findOne(queryTotal);
        if (!dailyTotal) {
            let total = await DailyLoan.findOne(
                { asset: tran.token, account: "" }
            ).sort({
                date: -1
            });
            dailyTotal = await DailyLoan.create({
                ...queryTotal,
                total_supply: total ? total.total_supply : 0,
                total_borrow: total ? total.total_borrow : 0
            });
        }
        //console.log(JSON.stringify(daily))
        //sender/token
        switch (tran.operation_type) {
            case operationType.loan_asset_supply:
                dailyAccount.total_supply = new BigNumber(dailyAccount.total_supply).plus(tran.value).toFixed(0);
                await DailyLoan.updateOne(queryAccount, {
                    total_supply: dailyAccount.total_supply
                })

                dailyTotal.total_supply = new BigNumber(dailyTotal.total_supply).plus(tran.value).toFixed(0);
                await DailyLoan.updateOne(queryTotal, {
                    total_supply: dailyTotal.total_supply
                })

                break;
            case operationType.loan_asset_withdraw:
                if (tran.value == -1) {
                    dailyTotal.total_supply = new BigNumber(dailyTotal.total_supply).minus(dailyAccount.total_supply).toFixed(0);
                    dailyAccount.total_supply = 0;
                } else {
                    dailyAccount.total_supply = new BigNumber(dailyAccount.total_supply).minus(tran.value).toFixed(0);
                    dailyTotal.total_supply = new BigNumber(dailyTotal.total_supply).minus(tran.value).toFixed(0);
                }
                await DailyLoan.updateOne(queryAccount, {
                    total_supply: dailyAccount.total_supply
                })
                await DailyLoan.updateOne(queryTotal, {
                    total_supply: dailyTotal.total_supply
                })
                break;
            case operationType.loan_asset_borrow:
                dailyAccount.total_borrow = new BigNumber(dailyAccount.total_borrow).plus(tran.value).toFixed(0);
                await DailyLoan.updateOne(queryAccount, {
                    total_borrow: dailyAccount.total_borrow
                })

                dailyTotal.total_borrow = new BigNumber(dailyTotal.total_borrow).plus(tran.value).toFixed(0);
                await DailyLoan.updateOne(queryTotal, {
                    total_borrow: dailyTotal.total_borrow
                })
                break;
            case operationType.loan_asset_repay:
                if (!tran.value) {
                    dailyTotal.total_borrow = new BigNumber(dailyTotal.total_borrow).minus(dailyAccount.total_borrow).toFixed(0);
                    dailyAccount.total_borrow = 0;
                } else {
                    dailyAccount.total_borrow = new BigNumber(dailyAccount.total_borrow).minus(tran.value).toFixed(0);
                    dailyTotal.total_borrow = new BigNumber(dailyTotal.total_borrow).minus(tran.value).toFixed(0);
                }
                await DailyLoan.updateOne(queryAccount, {
                    total_borrow: dailyAccount.total_borrow
                })
                await DailyLoan.updateOne(queryTotal, {
                    total_borrow: dailyTotal.total_borrow
                })
                break;
        }

        return true;
    }
}

module.exports = TransactionScan;