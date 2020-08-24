const WsRpc = require('../dna/wsRpc');
const Account = require('../models/account');
const Status = require('../models/status');
const Block = require('../models/block');
const Transaction = require('../models/transaction');

const { dna } = require('../config');
const dnaUtil = require('../dna/util');

const BigNumber = require('bignumber.js');


//{"id":1, "method":"call", "params":[0,"get_account_count",[""]]}

//{"id":1, "method":"call", "params":[0,"get_full_accounts",[["1.2.0","1.2.1",,"1.2.3"]]]}

//找到所有account的第一个op，如果是创建，则区块时间为创建时间，如果没有创建，则为创世时间。

class AccountsScan {
    constructor(opts, wsRpc) {
        this.wsRpc = wsRpc || new WsRpc();
        this.defaultLoopAccountTime = 5000;
        this.fastLoopAccountTime = 100;
        this.maxScanAccountsCount = 10;
        this.accountPrefix = "1.2.";
    }

    async init() {

        // let _status = await Status.findOne({});
        // if (!_status) {
        //     _status = new Status({
        //         head_block_number: 0,
        //         time: null,
        //         head_block_id: "",
        //         last_irreversible_block_num: 0,

        //         last_scan_number: 0,
        //         last_scan_time: null
        //     });
        //     await _status.save();
        // }
        // this.status = _status;
        //console.log("status:" + JSON.stringify(this.status));
    }

    start() {
        let that = this;
        (function iteratorAccounts() {
            that.loopAccounts().then((nextTimeout) => {
                nextTimeout = nextTimeout || that.defaultLoopAccountTime;
                setTimeout(() => {
                    iteratorAccounts();
                }, nextTimeout)
            }).catch((err) => {
                console.log("iteratorAccounts error: " + new Date().toString());
                console.log(err);
                let nextTimeout = that.defaultLoopAccountTime;
                setTimeout(() => {
                    iteratorAccounts();
                }, nextTimeout)
            })
        })();

    }

    async loopAccounts() {
        let that = this;
        let instance = await that.wsRpc.instance();
        let history_api = instance.history_api();
        let db_api = instance.db_api();
        if (!history_api || !history_api.ws_rpc || !history_api.api_id) {
            console.log("history_api initing");
            console.log(`${history_api.api_id},${history_api.api_name}`);
            return that.defaultLoopAccountTime;
        }

        let accountCount = await db_api.exec("get_account_count", []);
        let lastAccountId = -1;
        let lastAccountInDb = await Account.findOne({}).sort({ id_int: -1 });
        if (lastAccountInDb) {
            lastAccountId = lastAccountInDb.id_int;
        }
        let startGet = lastAccountId + 1;
        let endGet = accountCount - 1;
        if (endGet - startGet >= that.maxScanAccountsCount); {
            endGet = startGet + that.maxScanAccountsCount - 1;
        }
        //console.log(`accountCount:${accountCount},lastAccountId:${lastAccountId},startGet:${startGet},endGet:${endGet}`)
        if (endGet <= startGet) {
            return this.defaultLoopAccountTime;
        }
        let ids = [];
        for (var i = startGet; i <= endGet; i++) {
            ids.push(that.accountPrefix + i);
        }
        //console.log(ids);

        let fullAccounts = await db_api.exec('get_full_accounts', [ids]);

        let insertAccounts = [];
        for (let i = 0; i < fullAccounts.length; i++) {
            let fullAccArr = fullAccounts[i];
            let fullAcc = fullAccArr[1];
            let accountName = fullAcc.account.name;

            //get time
            let timestamp = new Date(dna.genesisTime);
            let ops = await _getAllOps(history_api, accountName);
            //console.log(ops);
            if (ops.length) {
                let firstOp = ops[0];
                //console.log(`account ${accountName}, first op: ${JSON.stringify(firstOp)}`);
                if (firstOp.op && firstOp.op.length == 2 && firstOp.op[0] == 5 && firstOp.op[1].name == accountName) {
                    let block_num = firstOp.block_num;
                    let block = await Block.findOne({
                        height: block_num
                    }).select({ timestamp: 1 });
                    if (!block) {
                        console.log(`account ${accountName}, can not find block: ${block_num}`);
                        //区块没同步？跳出？下次再同步？
                        break;
                    }
                    timestamp = block.timestamp;
                }
            }

            let available_balance = new BigNumber(0);
            if (fullAcc.balances && fullAcc.balances.length) {
                fullAcc.balances = fullAcc.balances.filter(it => it.asset_type == dna.coreTokenId);
                for (let b = 0; b < fullAcc.balances.length; b++) {
                    available_balance = available_balance.plus(fullAcc.balances[b].balance);
                }
            }

            let vesting_balance = new BigNumber(0);
            if (fullAcc.vesting_balances && fullAcc.vesting_balances.length) {
                fullAcc.vesting_balances = fullAcc.vesting_balances.filter(it => it.balance.asset_id == dna.coreTokenId);
                for (let b = 0; b < fullAcc.vesting_balances.length; b++) {
                    vesting_balance = vesting_balance.plus(fullAcc.vesting_balances[b].balance.amount);
                }
            }

            let total_balance = available_balance.plus(vesting_balance).toFixed(0);

            available_balance = available_balance.toFixed(0);
            vesting_balance = vesting_balance.toFixed(0);
            let account_id = fullAcc.account.id;
            let account_id_int = parseInt(account_id.split('.')[2]);
            let acc = {
                id: account_id,
                id_int: account_id_int,
                name: accountName,
                address: accountName,

                owner_key: fullAcc.owner ? fullAcc.owner.key_auths : [],
                active_key: fullAcc.active ? fullAcc.active.key_auths : [],
                memo_key: fullAcc.options ? fullAcc.options.memo_key : "",

                timestamp: timestamp,

                //statistics.total_ops
                transactions: fullAcc.statistics ? fullAcc.statistics.total_ops : 0,

                //目前只显示DNA代币
                total_balance: total_balance,
                available_balance: available_balance,
                vesting_balance: vesting_balance,
                votes: fullAcc.options ? fullAcc.options.votes : []
            };
            insertAccounts.push(acc);
        }
        if (insertAccounts.length) {
            var bulk = Account.collection.initializeOrderedBulkOp();
            for (var i = 0; i < insertAccounts.length; i++) {
                bulk.find({ id: insertAccounts[i].id }).upsert().updateOne(
                    insertAccounts[i]
                );
            }
            await bulk.execute();
        }

        if (endGet < accountCount - 1) {
            return that.fastLoopAccountTime;
        }

        return that.defaultLoopAccountTime;
    }
}

async function _getAllOps(history_api, account) {
    //account stop,limit,start,不包含stop
    //从后往前查询
    let ops = [];
    let stop = "1.11.0";
    let limit = 10;
    let start = "1.11.0";
    while (true) {
        let historys = await history_api.exec('get_account_history', [account, stop, limit, start]);
        if (!historys.length) {
            break;
        }
        historys.forEach((it) => {
            it.id_int = parseInt(it.id.split('.')[2])
        })
        historys.sort((a, b) => {
            return a.id_int < b.id_int ? -1 : 1
        })
        ops.unshift(...historys);
        if (historys.length < limit) {
            break;
        }
        start = historys[0].id;
        if (ops.length > 10000) {
            return ops;//临时防止死循环
        }
    }
    return ops;
}

module.exports = AccountsScan;