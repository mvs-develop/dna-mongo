
const WsRpc = require('../dna/wsRpc');

const Transaction = require('../models/transaction');

const tranType = require('../dicts/tranType');

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
                default:
                    break;


            }
        } catch (err) {
            console.log("checkTran error");
            console.log(err);
        }

        return result;

    }
}

module.exports = TransactionScan;