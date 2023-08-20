import IORedis from 'ioredis';
import {
  TCCComponent,
  ComponentTryStatus,
  TXStore,
  TXStatus,
  ComponentTryEntity,
  Transaction,
} from '@akt-tcc/txmanager';

import { TXRecordDAO } from './dao/txrecord';
import { MiniRedisLock } from './redisLock';
import { BuildTXRecordLockKey } from './dao/redis';

export class MockTXStore implements TXStore {
  dao: typeof TXRecordDAO;
  constructor(public client: IORedis) {
    this.dao = TXRecordDAO;
  }

  CreateTX = async (...components: TCCComponent[]) => {
    // 创建一项内容，里面以唯一事务 id 为 key
    const componentTryStatuses = {};

    for (const component of components) {
      componentTryStatuses[await component.ID()] = {
        tryStatus: ComponentTryStatus.TryHanging,
      };
    }

    const rec = await this.dao.CreateTXRecord({
      data: {
        component_try_statuses: JSON.stringify(componentTryStatuses),
        status: TXStatus.TXHanging,
        deleted_at: -1,
        created_at: Date.now(),
        updated_at: Date.now(),
      },
    });

    return rec.id;
  };

  TXUpdate = async (txID: string, componentID: string, accept: boolean) => {
    await this.dao.UpdateComponentStatus(
      txID,
      componentID,
      accept ? ComponentTryStatus.TrySucceesful : ComponentTryStatus.TryFailure
    );
  };

  GetHangingTXs = async () => {
    const records = await this.dao.GetTXRecords({
      where: {
        status: TXStatus.TXHanging,
      },
    });

    const txs: Transaction[] = [];

    for (const record of records) {
      const componentTryStatuses = JSON.parse(
        record.component_try_statuses.toString()
      );

      const components: ComponentTryEntity[] = [];

      for (const componentID in componentTryStatuses) {
        components.push({
          componentID,
          tryStatus: componentTryStatuses[componentID].tryStatus,
        });
      }

      txs.push(new Transaction(record.id, components));
    }

    return txs;
  };

  Lock = async (expireDuration: number) => {
    const lock = new MiniRedisLock(BuildTXRecordLockKey(), this.client, {
      expireSeconds: expireDuration,
    });

    return lock.lock();
  };

  Unlock = async () => {
    const lock = new MiniRedisLock(BuildTXRecordLockKey(), this.client);

    return lock.Unlock();
  };

  TXSubmit = async (txID: string, success: boolean) => {
    await this.dao.UpdateTXRecord({
      where: {
        id: txID,
      },
      data: {
        status: success ? TXStatus.TXSuccessful : TXStatus.TXFailure,
        updated_at: Date.now(),
      },
    });
  };

  GetTX = async (txID: string) => {
    const records = await this.dao.GetTXRecords({
      where: {
        id: txID,
      },
    });

    if (records.length !== 1) {
      throw Error('get tx failed');
    }

    const record = records[0];

    const componentTryStatuses = JSON.parse(
      record.component_try_statuses.toString()
    );

    const components: ComponentTryEntity[] = [];

    for (const componentID in componentTryStatuses) {
      components.push({
        componentID,
        tryStatus: componentTryStatuses[componentID].tryStatus,
      });
    }

    return new Transaction(record.id, components);
  };
}
