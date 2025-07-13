const crypto = require('crypto');
const rsa = require('../rsa'); // 引入非对称加密模块
const { isEqualObject } = require('../utils/index');

/**
 * 创世区块
 * 
 * [
 *  {
 *   "index": 0,
 *   "timestamp": 1633072800,
 *   "data": [], 区块的具体信息，主要是交易信息
 *   "hash": "", 当前的区块的哈希值, hash 1
 *   "prevHash": "0", 上一个区块的哈希值，hash 0
 *   "nonce": 0, 挖矿的随机数
 *  }
 * ]
 */


// 创世区块
const initBlock = {
  index: 0,
  timestamp: 0, // 创世区块不能有实时时间戳，不然每个新节点获取到的创世区块时间戳都不一样
  data: [],
  hash: '',
  prevHash: '0',
  nonce: 0
};

const TradeClass = (Base) => class extends Base {
  constructor() {
    super()
    this.blockchain = [initBlock];
    this.data = [];
    this.difficulty = 4; // 挖矿难度
  }

  // 获取最新区块
  getLastBlock() {
    return this.blockchain[this.blockchain.length - 1];
  }

  // 交易
  transfer(from, to, amount) {
    // 1. 签名校验
    // 这里可以添加签名校验逻辑
    if (from === to) {
      console.error("Cannot transfer to the same address")
      return
    }
    if (amount <= 0) {
      console.error('Amount must be greater than zero');
      return
    }
    if (from !== 'system' && this.balanceOf(from) < amount) {
      console.error('Insufficient balance');
      return
    }

    // 2. 构建交易数据
    const transObj = { from, to, amount, timestamp: Date.now() };
    const signature = rsa.sign(transObj);
    const signTransObj = { ...transObj, signature }
    this.data.push(signTransObj);
    // 3. 广播交易数据到网络（系统产生的奖励交易不用广播）
    if (from !== 'system') {
      this.boardcast({
        type: 'transaction',
        data: signTransObj
      })
    }
    return signTransObj;
  }

  // 查看余额
  balanceOf(address) {
    let balance = 0;
    // 遍历区块链中的所有交易数据
    for (const block of this.blockchain) {
      for (const transaction of block.data) {
        if (transaction.from === address) {
          balance -= transaction.amount; // 如果是支出，减少余额
        }
        if (transaction.to === address) {
          balance += transaction.amount; // 如果是收入，增加余额
        }
      }
    }
    return balance;
  }
  // 校验交易合法性
  isValidTranfer(trans) {
    if (trans.from === 'system') return true; // 系统账户的交易不需要校验
    return rsa.verifySign(trans, trans.from)
  }

  // 挖矿
  mine(address) {
    // 校验交易合法性。如果节点没有任何交易数据，也可以进行挖矿
    if (!this.data.every(v => this.isValidTranfer(v))) {
      console.error('Invalid transactions, can not mine');
      return;
    }

    // 挖矿成功的话,给 address 账户增加奖励
    this.transfer('system', address, 50); // 假设挖矿奖励为50
    // 1. 生成新区块
    const newBlock = this.generateNewBlock();
    // 2. 校验新区块的哈希值
    if (this.isValidBlock(newBlock) && this.isValidChain()) {
      // 3. 将新区块添加到区块链中
      this.blockchain.push(newBlock);
      this.data = []; // 清空数据
    } else {
      console.error('Invalid block', newBlock);
    }

    // 4. 广播新区块到网络
    this.boardcast({
      type: 'mine',
      data: newBlock
    });
  }

  // 新增区块
  generateNewBlock() {
    const prevBlock = this.getLastBlock();
    // 1. 生成新区块
    const index = this.blockchain.length;
    const prevHash = prevBlock.hash;
    const timestamp = Date.now();
    // 2. 计算新区块的哈希值
    let nonce = 0;
    let hash = this.computeHash(index, prevHash, timestamp, this.data, nonce);
    // 3. 挖矿，直到找到满足难度要求的哈希值
    while (!hash.startsWith('0'.repeat(this.difficulty))) {
      nonce++;
      hash = this.computeHash(index, prevHash, timestamp, this.data, nonce);
    }
    // 4. 新增新区块
    const newBlock = {
      index,
      timestamp,
      data: this.data,
      hash,
      prevHash,
      nonce
    };
    return newBlock;
  }
  // 计算区块的哈希值
  computeHashForBlock({ index, prevHash, timestamp, data, nonce }) {
    return this.computeHash(index, prevHash, timestamp, data, nonce);
  }

  // 计算 Hash
  computeHash(index, prevHash, timestamp, data, nonce) {
    return crypto.createHash('sha256')
      .update(index + prevHash + timestamp + JSON.stringify(data) + nonce)
      .digest('hex');
  }

  // 校验区块
  isValidBlock(newBlock, lastBlock = this.getLastBlock()) {
    // 校验区块的哈希值是否正确
    // 1. 新区块的 index 等于 最后一个区块的 index + 1
    if (newBlock.index !== lastBlock.index + 1) {
      return false;
    }
    // 2. 新区块的 timestamp 大于最后一个区块的 timestamp
    if (newBlock.timestamp <= lastBlock.timestamp) {
      return false;
    }
    // 3. 新区块的 prevHash 等于最后一个区块的 hash
    if (newBlock.prevHash !== lastBlock.hash) {
      return false;
    }
    // 4. 新区块的 hash 是否符合难度
    if (!newBlock.hash.startsWith('0'.repeat(this.difficulty))) {
      return false;
    }
    // 5. 新区块的 hash 是否正确
    if (newBlock.hash !== this.computeHashForBlock(newBlock)) {
      return false;
    }
    return true;
  }

  // 校验区块链
  isValidChain(chain = this.blockchain) {
    // 1. 校验除创世区块以外的所有区块
    for (let i = chain.length - 1; i > 0; i--) {
      if (!this.isValidBlock(chain[i], chain[i - 1])) {
        return false;
      }
    }
    // 2. 校验创世区块
    if (JSON.stringify(chain[0]) !== JSON.stringify(initBlock)) {
      return false;
    }
    return true;
  }

  // 新节点进入时，替换新节点的区块链
  replaceChain(newChain) {
    // 1. 新链比旧链长
    if (newChain.length <= this.blockchain.length) {
      console.error('Received chain is not longer than current chain');
      return;
    }
    // 2. 新链是合法的
    if (!this.isValidChain(newChain)) {
      console.error('Received chain is not valid');
      return;
    }
    // 3. 替换旧链
    this.blockchain = newChain;
  }

  // 新节点进入时，替换新节点的交易数据
  replaceTransactions(newData) {
    // 1. 判断所有交易是否合法
    if (newData.every(v => this.isValidTranfer(v))) {
      // 2. 替换旧交易数据
      this.data = newData;
    } else {
      console.error('Received transactions are not valid');
    }
  }

  // 网络上其他节点挖矿成功，广播到当前节点，进行区块链更新
  addNewBlock(block) {
    const lastBlock = this.getLastBlock();
    if (lastBlock.hash === block.hash) return; // 已经存在这个区块
    // 1. 校验区块是否合法
    if (!this.isValidBlock(block, lastBlock)) {
      console.error('Invalid block', block);
      return;
    }
    // 2. 添加区块到区块链
    this.blockchain.push(block);
    // 3. 清空交易数据（由于网络延迟丢包等情况，每个节点的交易可能不完全一致）
    // 3.1 自己打包成功后，需要清空交易，对于自身的过滤，相当于清空了
    // 3.2 其他节点打包成功后，需要对交易数据进行过滤
    const packedTxs = block.data
    this.data = this.data.filter(tx => !packedTxs.some(ptx => isEqualObject(tx, ptx)));
    // 4. 广播新区块到网络(因为不是每个节点都保存着完整的节点列表，所以需要广播。上面有做已存在该区块的 hash 判断去做去重，避免了无限广播)
    this.boardcast({
      type: 'mine',
      data: block
    })
  }

  // 把其他节点的交易数据添加到自己的交易池
  addNewTransaction(transaction) {
    // 1. 查看交易是否重复
    if (this.data.find(v => isEqualObject(v, transaction))) {
      console.error('Transaction already exists', transaction);
      return;
    }
    // 2. 校验交易是否合法
    if (!this.isValidTranfer(transaction)) {
      console.error('Invalid transaction', transaction);
      return;
    }
    // 3. 添加交易到交易池
    this.data.push(transaction);
    // 4. 广播交易数据到网络
    this.boardcast({
      type: 'transaction',
      data: transaction
    });
  }
}

module.exports = TradeClass;