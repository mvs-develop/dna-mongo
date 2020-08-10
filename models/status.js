const mongoose = require('../db/mongoose');
//get_dynamic_global_properties
const Status = mongoose.model('status', {
    head_block_number: Number,
    time: Date,
    head_block_id: String,
    last_irreversible_block_num: Number,

    last_scan_number: Number,//最后扫描的区块，包含
    last_scan_time: Date,//最后扫描的区块时间
});

module.exports = Status;