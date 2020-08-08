const WsRpc = require('../dna/wsRpc');
const Status = require('../models/status');
const Block = require('../models/block');
const Transaction = require('../models/transaction');

const dnaUtil = require('../dna/util');
const { remove } = require('../models/block');

class BlocksScan {
    constructor(opts) {
        this.wsRpc = new WsRpc();
        this.defaultLoopBlockStatusTime = 1000;//
        this.defaultLoopBlocksTime = 1000;//默认区块扫描间隔时间，1000
        this.fastLoopBlocksTime = 10;//快速区块扫描间隔时间，10
        this.maxScanBlocksCount = 100;//单次最多扫描区块
        this.status = null;
    }

    async init() {
        let _status = await Status.findOne({});
        if (!_status) {
            _status = new Status({
                head_block_number: 0,
                time: null,
                head_block_id: "",
                last_irreversible_block_num: 0,

                last_scan_number: 0,
                last_scan_time: null
            });
            await _status.save();
        }
        this.status = _status;
        //console.log("status:" + JSON.stringify(this.status));
    }

    start() {
        let that = this;
        (function iteratorStatus() {
            that.loopBlockStatus().then((nextTimeout) => {
                nextTimeout = nextTimeout || that.defaultLoopBlockStatusTime;
                setTimeout(() => {
                    iteratorStatus();
                }, nextTimeout)
            }).catch((err) => {
                console.log("iteratorStatus error: " + new Date().toString());
                console.log(err);
                let nextTimeout = that.defaultLoopBlockStatusTime;
                setTimeout(() => {
                    iteratorStatus();
                }, nextTimeout)
            })
        })();

        (function iteratorBlocks() {
            that.loopBlocks().then((nextTimeout) => {
                nextTimeout = nextTimeout || that.defaultLoopBlocksTime;
                setTimeout(() => {
                    iteratorBlocks();
                }, nextTimeout)
            }).catch((err) => {
                console.log("iteratorBlocks error: " + new Date().toString());
                console.log(err);
                let nextTimeout = that.defaultLoopBlocksTime;
                setTimeout(() => {
                    iteratorBlocks();
                }, nextTimeout)
            })
        })();

        (function iteratorConfirmBlocks() {
            that.loopConfirmBlocks().then((nextTimeout) => {
                nextTimeout = nextTimeout || that.defaultLoopBlocksTime;
                setTimeout(() => {
                    iteratorConfirmBlocks();
                }, nextTimeout)
            }).catch((err) => {
                console.log("iteratorConfirmBlocks error: " + new Date().toString());
                console.log(err);
                let nextTimeout = that.defaultLoopBlocksTime;
                setTimeout(() => {
                    iteratorConfirmBlocks();
                }, nextTimeout)
            })
        })();
    }

    //批量同步区块
    //返回下次同步延迟毫秒
    async loopBlocks() {
        let that = this;

        if (!that.status) {
            return that.defaultLoopBlocksTime;
        }

        let startBlock = that.status.last_scan_number + 1;
        let endBlock = startBlock + that.maxScanBlocksCount;
        if (endBlock > that.status.head_block_number) {
            endBlock = that.status.head_block_number;
        }
        let arr = [];
        for (let i = startBlock; i <= endBlock; i++) {
            arr.push(i);
        }

        if (arr.length == 0) {
            return that.defaultLoopBlocksTime;
        }

        let instance = await that.wsRpc.instance(true);

        let blocks = await instance.block_api().exec("get_blocks", [startBlock, endBlock]);

        //console.log(blocks);
        await that.saveBlocks(instance, blocks, startBlock, false);


        let nowTime = new Date().getTime();
        let lastTime = that.status.last_scan_time ? 0 : new Date(that.status.last_scan_time).getTime();
        if (nowTime - lastTime > 5000) {
            return that.fastLoopBlocksTime;
        }
        return that.defaultLoopBlocksTime;
    }

    //检查一下未确认的区块
    //看看是否已经确认，是否需要回滚
    async loopConfirmBlocks() {
        let that = this;

        if (!that.status) {
            return that.defaultLoopBlocksTime;
        }

        let unconfirmBlocks = await Block.find({
            confirmed: false,
            height: { $lte: that.status.last_irreversible_block_num }
        }).limit(that.maxScanBlocksCount)
            .sort({ height: 1 })
            .select({ height: 1 });

        //console.log("unconfirmBlocks:" + unconfirmBlocks.length);
        if (unconfirmBlocks.length) {
            //从第1个开始，获取length个
            let instance = await that.wsRpc.instance(true);
            let startBlock = unconfirmBlocks[0].height;
            let endBlock = startBlock + unconfirmBlocks.length;
            let blocks = await instance.block_api().exec("get_blocks", [startBlock, endBlock]);

            await that.saveBlocks(instance, blocks, startBlock, true);
        }

        return that.defaultLoopBlocksTime;
    }

    async saveBlocks(instance, blocks, startBlock, isCheckConfirm = false) {
        let that = this;
        let insertBlocks = [];
        let insertTrans = [];
        let blockHeights = [];
        for (let i = 0; i < blocks.length; i++) {
            let b = blocks[i];
            if (!b) {
                break;
            }
            let height = startBlock + i;
            blockHeights.push(height);
            if (i == 0) {
                if (startBlock == 1) {
                    //创世块
                } else {
                    //设置上一个区块的hash
                    await Block.updateOne({ height: startBlock - 1 }, {
                        $set: {
                            hash: b.previous
                        }
                    })
                }
            } else {
                insertBlocks[i - 1].hash = b.previous;
            }
            let bytes = dnaUtil.getBlockBytes(b);
            let confirmed = height <= that.status.last_irreversible_block_num - 10;//防止网络延迟导致的误差
            insertBlocks.push({
                previous: b.previous,
                height: height,
                hash: "",
                confirmed: confirmed,
                transactions: b.transactions.length,
                bytes: bytes,
                timestamp: b.timestamp,
                witness: b.witness,
                //witness_signature: b.witness_signature
            })
            //todo:交易
            if (b.transactions.length) {
                for (let j = 0; j < b.transactions.length; j++) {
                    let tran = b.transactions[j];
                    let tranHash = await dnaUtil.getTransactionHash(instance, tran);
                    insertTrans.push({
                        block_height: height,
                        block_index: j,
                        hash: tranHash,
                        confirmed: confirmed,
                        sender: "",
                        receiver: "",
                        value: "",
                        token: "",
                        operations: tran.operations,
                        operation_results: tran.operation_results
                    });
                }
            }
        }

        if (insertBlocks.length) {
            var bulk = Block.collection.initializeOrderedBulkOp();
            let insertLength = isCheckConfirm ? insertBlocks.length - 1 : insertBlocks.length
            for (var i = 0; i < insertLength; i++) {
                bulk.find({ height: insertBlocks[i].height }).upsert().updateOne(
                    insertBlocks[i]
                );
            }
            await bulk.execute();

            if (!isCheckConfirm) {
                that.status.set({
                    last_scan_number: insertBlocks[insertBlocks.length - 1].height,
                    last_scan_time: insertBlocks[insertBlocks.length - 1].timestamp,
                })
                //Can't save() the same doc multiple times in parallel. Document: 5f2eaf171c5daf7f7ba29f93
                await that.status.save();
            }
        }


        //删除这些区块未确认的交易
        await Transaction.find({
            block_height: { $in: blockHeights },
            confirmed: false
        }).remove();
        //重新插入
        if (insertTrans.length) {
            var bulk = Transaction.collection.initializeOrderedBulkOp();
            for (var i = 0; i < insertTrans.length; i++) {
                bulk.find({ hash: insertTrans[i].hash }).upsert().updateOne(
                    insertTrans[i]
                );
            }
            await bulk.execute();
        }


        return true;
    }



    //同步最新区块，确认区块
    //返回下次同步延迟毫秒
    async loopBlockStatus() {
        let that = this;
        let instance = await that.wsRpc.instance();

        let res = await instance.db_api().exec("get_dynamic_global_properties", [])
        //console.log(res);
        this.status.set({
            head_block_number: res.head_block_number,
            time: res.time,
            head_block_id: res.head_block_id,
            last_irreversible_block_num: res.last_irreversible_block_num
        })

        await this.status.save();

        //console.log(this.status);

        return 10 * 1000;
    }
}


module.exports = BlocksScan;