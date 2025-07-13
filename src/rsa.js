const EC = require('elliptic').ec
const fs = require('fs')
const path = require('path')
const ec = new EC('secp256k1')

let key = ec.genKeyPair()

function getPub(privateKey) {
  return ec.keyFromPrivate(privateKey).getPublic('hex').toString()
}


// 1. 获取公钥和私钥（持久化）
function generateKeys() {
  const fileName = 'wallet.json'
  const filePath = path.join(process.cwd(), fileName)
  try {
    const res = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    if (res.private && res.public && getPub(res.private) === res.public) {
      // 文件存在 且 文件合法
      key = ec.keyFromPrivate(res.private)
      return res
    } else {
      // 验证失败，重新生成
      throw new Error('Invalid wallet file')
    }
  } catch (error) {
    // 文件不存在 或 文件不合法
    const res = {
      private: key.getPrivate('hex').toString(),
      public: key.getPublic('hex').toString()
    }
    fs.writeFileSync(filePath, JSON.stringify(res), 'utf8')
    return res
  }
}



// 签名
function sign({ from, to, amount, timestamp }) {
  const bufferMsg = Buffer.from(`${from}-${to}-${amount}-${timestamp}`)
  let signature = Buffer.from(key.sign(bufferMsg).toDER()).toString('hex')
  return signature
}

// 校验签名
function verifySign({ from, to, amount, timestamp, signature }, publicKey) {
  // 用公钥生成 私钥
  const keyPrivateTmp = ec.keyFromPublic(publicKey, 'hex')
  const bufferMsg = Buffer.from(`${from}-${to}-${amount}-${timestamp}`)
  return keyPrivateTmp.verify(bufferMsg, signature)
}

const keys = generateKeys()


module.exports = {
  sign,
  verifySign,
  keys
}