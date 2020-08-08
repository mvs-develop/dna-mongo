
const { ops, hash } = require("bitsharesjs");

// function getBlockHash(block) {
//     delete block.witness_signature;
//     let obj = ops.signed_block.fromObject(block);
//     let buf = ops.signed_block.toBuffer(obj);
//     buf = buf.slice(0, 20);
//     // let buf = obj.toByteBuffer();
//     return buf.toString('hex');
// }

async function getTransactionHash(instance, tran) {
    //try {
    let tran1 = await instance.db_api().exec("get_transaction_hex", [tran]);
    var tran2 = ops.transaction.fromHex(tran1);
    var tran3 = ops.transaction.toBuffer(tran2)
    var id = hash.sha256(tran3).toString('hex').substring(0, 40);
    //let obj = ops.signed_transaction.fromObject(tran);
    return id;
    // } catch (err) {
    //     console.log('transaction toBuffer error:' + err.message);
    //     let tran1 = await instance.db_api().exec("get_transaction", [block_height, block_index]);
    //     var tran3 = ops.transaction.fromHex(tran2);
    //     var tranBuf = ops.transaction.toBuffer(tran3);
    //     var id = hash.sha256(tranBuf).toString('hex').substring(0, 40);
    //     console.log('find in rpc:' + id);
    //     return id;

    // }
}

function getBlockBytes(block) {
    return _roughSizeOfObject(block);
}

function _roughSizeOfObject(object) {
    var objectList = [];
    var stack = [object];
    var bytes = 0;

    while (stack.length) {
        var value = stack.pop();

        if (typeof value === 'boolean') {
            bytes += 4;
        }
        else if (typeof value === 'string') {
            bytes += value.length * 2;
        }
        else if (typeof value === 'number') {
            bytes += 8;
        }
        else if
            (
            typeof value === 'object'
            && objectList.indexOf(value) === -1
        ) {
            objectList.push(value);

            for (var i in value) {
                stack.push(value[i]);
            }
        }
    }
    return bytes;
}


module.exports = {
    //getBlockHash,
    getTransactionHash,
    getBlockBytes
}