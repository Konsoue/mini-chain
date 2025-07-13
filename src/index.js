const vorpal = require('vorpal')();
const Table = require('cli-table3'); // 引入表格模块

const Blockchain = require('./blockchain'); // 引入区块链模块
const chain = new Blockchain(); // 创建区块链实例
const rsa = require('./rsa'); // 引入非对称加密模块

function formatLog(data) {
  if (!data || data.length === 0) return
  if (!Array.isArray(data)) {
    data = [data];
  }
  const head = Object.keys(data[0])
  const table = new Table({
    head,
    colWidths: head.map(() => 20), // 设置每列的宽度
    wordWrap: true, // 开启自动换行
    wrapOnWordBoundary: false,
  });

  const values = data.map(item => {
    return head.map(key => JSON.stringify(item[key]));
  })
  table.push(...values);
  console.log(table.toString());
}

vorpal
  .command('tranfer  <to> <amount>', 'Transfer amount from local account to another')
  .action(function (args, callback) {
    const { to, amount } = args;
    // 调用区块链的转账方法
    const transaction = chain.transfer(rsa.keys.public, to, amount);
    formatLog(transaction);
    callback();
  });

vorpal
  .command('mine', 'Mine a new block')
  .action(function (args, callback) {
    // 调用区块链的挖矿方法
    chain.mine(rsa.keys.public);
    formatLog(chain.blockchain);
    callback();
  });


vorpal.command('chain', 'Get the current blockchain')
  .action(function (args, callback) {
    // 获取当前区块链
    formatLog(chain.blockchain);
    callback();
  });

vorpal.command('blance <address>', 'Get the blance of an address')
  .action(function (args, callback) {
    const { address } = args;
    // 获取指定地址的余额
    const balance = chain.balanceOf(address);
    formatLog({ address, balance });
    callback();
  });

vorpal.command('pub', 'Get local wallet public key')
  .action(function (args, callback) {
    // 获取当前区块链
    console.log(`Public Key: ${rsa.keys.public}`);
    callback();
  });


vorpal.command('peers', 'Get all peers in the network')
  .action(function (args, callback) {
    // 获取所有节点信息
    formatLog(chain.peers);
    callback();
  });

vorpal.command('data', 'Get all transactions in the node')
  .action(function (args, callback) {
    // 获取所有节点信息
    formatLog(chain.data);
    callback();
  });


vorpal
  .exec('help')

vorpal
  .delimiter('konsoue-chain => ')
  .show();