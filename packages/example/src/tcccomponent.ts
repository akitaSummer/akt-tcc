import IORedis from 'ioredis';

import { TCCComponent, TCCReq, TCCResp } from '@akt-tcc/txmanager';
import { MiniRedisLock } from './redisLock';
import {
  BuildDataKey,
  BuildTXDetailKey,
  BuildTXKey,
  BuildTXLockKey,
} from './dao/redis';

// tcc 组件侧记录的一笔事务的状态
enum TXStatus {
  TXTried = 'tried', // 已执行 try 操作
  TXConfirmed = 'confirmed', // 已执行 confirm 操作
  TXCanceled = 'canceled', // 已执行 cancel 操作
}

// 一笔事务对应数据的状态
enum DataStatus {
  DataFrozen = 'frozen', // 冻结态
  DataSuccessful = 'successful', // 成功态
}

export class MockComponent implements TCCComponent {
  constructor(public id: string, public client: IORedis) {}
  ID = () => this.id;
  Try = async (req: TCCReq) => {
    const lock = new MiniRedisLock(
      BuildTXLockKey(this.id, req.txID),
      this.client
    );
    try {
      await lock.lock();

      const txStatus = await this.client.get(BuildTXKey(this.id, req.txID));

      const res: TCCResp = {
        componentID: this.id,
        ack: false,
        txID: req.txID,
      };

      switch (txStatus) {
        case TXStatus.TXTried:
        case TXStatus.TXConfirmed:
          res.ack = true;
          return res;
        case TXStatus.TXCanceled: // 先 cancel，后收到 try 请求，拒绝
          return res;
      }

      const bizID = req.data.biz_id;

      await this.client.set(BuildTXDetailKey(this.id, req.txID), bizID);

      // 要求必须从零到一把 bizID 对应的数据置为冻结态
      const reply = await this.client.setnx(
        BuildDataKey(this.id, req.txID, bizID),
        DataStatus.DataFrozen
      );

      this.client.set(BuildTXKey(this.id, req.txID), TXStatus.TXTried);

      res.ack = true;

      return res;
    } catch (e) {
      throw e;
    } finally {
      await lock.Unlock();
    }
  };

  Confirm = async (txID: string) => {
    const lock = new MiniRedisLock(BuildTXLockKey(this.id, txID), this.client);
    try {
      await lock.lock();

      // 1. 要求 txID 此前状态为 tried
      const txStatus = await this.client.get(BuildTXKey(this.id, txID));

      const res: TCCResp = {
        componentID: this.id,
        ack: false,
        txID: txID,
      };

      switch (txStatus) {
        case TXStatus.TXConfirmed: // 已 confirm，直接幂等响应为成功
          res.ack = true;
          return res;
        case TXStatus.TXTried: // 只有状态为 try 放行
          break;
        default:
          return res;
      }

      const bizID = await this.client.get(BuildTXDetailKey(this.id, txID));

      // 2. 要求对应的数据状态此前为 frozen
      const dataStatus = await this.client.get(
        BuildDataKey(this.id, txID, bizID)
      );

      if (dataStatus != DataStatus.DataFrozen) {
        return res;
      }

      // 把对应数据处理状态置为 successful
      await this.client.set(
        BuildDataKey(this.id, txID, bizID),
        DataStatus.DataSuccessful
      );

      // 把事务状态更新为成功，这一步哪怕失败了也不阻塞主流程
      this.client.set(BuildTXKey(this.id, txID), TXStatus.TXConfirmed);

      res.ack = true;

      return res;
    } catch (e) {
      throw e;
    } finally {
      await lock.Unlock();
    }
  };

  Cancel = async (txID: string) => {
    const lock = new MiniRedisLock(BuildTXLockKey(this.id, txID), this.client);
    try {
      await lock.lock();

      // 查看事务的状态，只要不是 confirmed，就无脑置为 canceld
      const txStatus = await this.client.get(BuildTXKey(this.id, txID));

      // 先 confirm 后 cancel，属于非法的状态扭转链路
      if (txStatus == TXStatus.TXConfirmed) {
        throw Error(`invalid tx status: ${txStatus}, txid: ${txID}`);
      }

      // 根据事务获取对应的 bizID
      const bizID = await this.client.get(BuildTXDetailKey(this.id, txID));

      if (bizID !== '') {
        // 删除对应的 frozen 冻结记录
        this.client.del(BuildDataKey(this.id, txID, bizID));
      }

      // 把事务状态更新为 canceld
      await this.client.set(BuildTXKey(this.id, txID), TXStatus.TXCanceled);

      const res: TCCResp = {
        componentID: this.id,
        ack: true,
        txID: txID,
      };

      return res;
    } catch (e) {
      throw e;
    } finally {
      await lock.Unlock();
    }
  };
}
