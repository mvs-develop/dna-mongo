const { db } = require("../config");

const mongoose = require('mongoose');

mongoose.connect(db.mongodb)

module.exports = mongoose;
