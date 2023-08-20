import IORedis from 'ioredis';
import os from 'node:os';

const RedisLockKeyPrefix = 'REDIS_LOCK_PREFIX_';

export class MiniRedisLock {
  token: number;
  constructor(
    public key: string,
    public redis: IORedis,
    public option: {
      expireSeconds: number;
    } = {
      expireSeconds: 5,
    }
  ) {
    this.token = os.getPriority();
  }

  lock = async () => {
    await this.redis.setex(
      this.getLockKey(),
      this.token,
      this.option.expireSeconds
    );
  };

  Unlock = async () => {
    const reply = await this.redis.eval(
      `
        local lockerKey = KEYS[1]
        local targetToken = ARGV[1]
        local getToken = redis.call('get',lockerKey)
        if (not getToken or getToken ~= targetToken) then
          return 0
          else
              return redis.call('del',lockerKey)
        end
      `,
      1,
      this.getLockKey(),
      this.token
    );

    if (reply !== 1) {
      throw Error('can not unlock without ownership of lock');
    }
  };

  getLockKey = () => {
    return RedisLockKeyPrefix + this.key;
  };
}
