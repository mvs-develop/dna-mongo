module.exports = {
    Internal: 1,
    Vote: 2,
    Transfer: 3,
    Lock: 4,
    AccountUpgrade: 5,
    WitnessCreate: 6,
    WitnessUpdata: 7,
    Withdraw: 8,
    Register: 9,

    //默认交易type为空
    //检查的时候，对于未知检查器，把交易标记为UnKnown
    //如果新增检查器，需要重新检查，可以把所有为UnKnown的交易标记为check=false
    UnKnown: 1000,
}