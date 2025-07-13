const dgram = require('dgram');
const { isEqualObject, getLocalIP } = require('../utils/index');

const P2PNetwork = (Base) => class extends Base {
  constructor() {
    super()
    // 种子节点
    this.seed = { port: process.env.port || 8081, address: process.env.host || getLocalIP() }; // 假设种子节点的地址和端口，必须是公网IP让其他人能访问到
    this.peers = [this.seed]; // P2P网络中的节点列表（address、port）
    this.remote = null; // 存储远程节点信息
    // 自己的节点
    this.udp = dgram.createSocket('udp4'); // 创建UDP套接字
    this.selfNode = {}
    // 初始化P2P网络
    this.init()
  }
  init() {
    this.bindP2P()
    this.bindExit()
  }
  bindP2P() {
    // 绑定UDP套接字
    this.udp.on('message', (msg, remote) => {
      const { address, port } = remote;
      const message = JSON.parse(msg.toString());
      console.log(`Received message: ${message.type} from ${address}:${port}`);
      if (message.type) {
        this.dispatch(message, { address, port });
      }
    });
    this.udp.on('listening', () => {
      const address = this.udp.address();
      this.selfNode = { address: getLocalIP(), port: address.port };
      console.log(`UDP server listening on ${getLocalIP()}:${address.port}`);
    });

    // 区分种子节点和普通节点，普通节点的端口是0即可，随便一个空闲端口都行
    // 种子节点的端口必须约定好
    console.log(`Binding UDP server on port ${this.seed.port}`);
    const PORT = Number(process.argv[2]) || process.env.PORT || 0; // 如果没有设置端口，就使用0，系统会分配一个空闲端口
    this.startNode(PORT);
  }

  bindExit() {
    process.on('exit', () => {
      console.log('Exiting the blockchain application...');
      this.udp.close(); // 关闭UDP套接字
    });
  }

  startNode(port) {
    this.udp.bind(port)
    // 如果不是种子节点，就发个消息给种子节点说，我来了
    if (port !== this.seed.port) {
      const message = {
        type: 'new_peer',
      };
      this.sendMessage(message, this.seed.address, this.seed.port);
    }
  }
  // 发送消息
  sendMessage(message, address, port) {
    console.log(`Sending message: ${message.type} to ${address}:${port}`);
    this.udp.send(JSON.stringify(message), port, address)
  }
  // 接受消息后的处理
  dispatch(message, remote) {
    console.log('Dispatching message:', message);
    switch (message.type) {
      // 新种子节点加入网络
      case 'new_peer':
        this.addNewPeer(remote);
        break;
      // 存储远程节点信息，用于退出
      case 'remote_peer':
        console.log('dispatch remote_peer:', message.data);
        this.remote = message.data; // 存储远程节点信息
        break;
      // 新种子节点，接受到原有种子节点的列表
      case 'peer_list':
        const peers = message.data;
        this.addPeers(peers);
        break;
      case 'sayhi':
        // 当其他种子节点接收到新种子节点时，将其放入自己的peers列表中
        const newPeer = message.data;
        this.addPeers([newPeer]);
        // 向新种子节点回复响应消息
        this.sendMessage({
          type: 'hi',
        }, newPeer.address, newPeer.port);
        break;
      case 'hi':
        console.log('Received hi from other peer:', message, remote.address, remote.port);
        break;
      case 'blockchain_data':
        // 接收到区块链数据
        const { blockchain, trans } = message.data;
        this.replaceChain(blockchain);
        this.replaceTransactions(trans);
        break;
      case 'transaction':
        // 网络上有人发送交易数据，接受后进行挖矿（即交易打包）
        this.addNewTransaction(message.data);
        break;
      case 'mine':
        // 网络上有人挖矿成功，接受新区块
        this.addNewBlock(message.data);
        break;
      default:
        console.error('Unknown message type:', message.type);
    }
  }

  addPeers(peers) {
    // 新种子节点把现有的种子节点添加到自己的列表
    peers.forEach(peer => {
      if (!this.peers.some(p => isEqualObject(p, peer))) {
        this.peers.push(peer);
      }
    });
  }

  // 将数据广播出去
  // 1. 当该节点产生交易时，需要将交易数据广播给其他所有节点(√)，除了系统给的奖励交易
  // 2. 当该节点挖矿成功时，需要将新区块广播给其他所有节点(√)
  // 3. 当有新节点加入网络时，需要将新节点信息广播给其他所有节点(√)
  // 4. 当有其他节点产生交易时，发到该节点，该节点将数据广播到除了自己与来源节点以外的所有节点(√)，除了系统给的奖励交易
  // 5. 当有其他节点挖矿成功时，发到该节点，该节点将新区块广播到除了自己与来源节点以外的所有节点(√)
  boardcast(message) {
    this.peers.forEach(peer => {
      // 不发送给自己
      if (isEqualObject(peer, this.selfNode)) return
      this.sendMessage(message, peer.address, peer.port);
    })
  }

  // 新种子节点加入网络时，原有种子节点需要做的事情
  addNewPeer(remote) {
    const { address, port } = remote;
    this.addPeers([remote]); // 添加新种子节点到自己的列表
    // 1. 收集新种子节点的IP和PORT
    this.sendMessage({
      type: 'remote_peer',
      data: this.seed
    }, address, port);
    // 2. 把现在全部种子节点的列表告诉新种子节点
    this.sendMessage({
      type: 'peer_list',
      data: this.peers
    }, address, port);
    // 3. 广播，告诉原有种子节点，来了新的节点
    this.boardcast({
      type: 'sayhi',
      data: { address, port }
    });
    // 4. 把现有区块链数据发送给新节点
    this.sendMessage({
      type: "blockchain_data",
      data: {
        blockchain: this.blockchain,
        trans: this.data // 交易数据
      }
    }, address, port);
  }


}

module.exports = P2PNetwork