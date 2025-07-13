// 1. 迷你区块链
// 2．区块链的生成，新增，校验
// 3. 交易
// 4. 非对称加密
// 5. 挖矿
// 6. p2p网络

const { mixin } = require("./utils/index")
const Base = require('./mixinClass/Base');
const P2PNetwork = require('./mixinClass/P2PNetwork');
const TradeClass = require('./mixinClass/TradeClass');

class Blockchain extends mixin(Base, TradeClass, P2PNetwork) {

}

module.exports = Blockchain;