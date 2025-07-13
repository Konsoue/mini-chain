const os = require('os');

const getLocalIP = () => {
  const interfaces = os.networkInterfaces();
  for (const name in interfaces) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal && iface.address !== '0.0.0.0') {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}


const mixin = (baseClass, ...mixins) => {
  return mixins.reduce((classBuilder, mixin) => {
    return mixin(classBuilder);
  }, baseClass);
};

const isEqualObject = (obj1, obj2) => {
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);
  if (keys1.length !== keys2.length) return false;
  for (const key of keys1) {
    if (obj1[key] !== obj2[key]) return false;
  }
  return true;
}

module.exports = {
  mixin,
  isEqualObject,
  getLocalIP
}
