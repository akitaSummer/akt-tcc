import Redis from 'ioredis';

export const redis = new Redis();

// 构造事务 id key，用于幂等去重
export const BuildTXKey = (componentID: string, txID: string) => {
  return `txKey:componentID:txID`;
};

export const BuildTXDetailKey = (componentID: string, txID: string) => {
  return `txDetailKey:${componentID}:${txID}`;
};

// 构造请求 id，用于记录状态机
export const BuildDataKey = (
  componentID: string,
  txID: string,
  bizID: string
) => {
  return `txKey:${componentID}:${txID}:${bizID}`;
};

// 构造事务锁 key
export const BuildTXLockKey = (componentID: string, txID: string) => {
  return `txLockKey:${componentID}:${txID}`;
};

export const BuildTXRecordLockKey = () => {
  return 'akt-tcc:txRecord:lock';
};
