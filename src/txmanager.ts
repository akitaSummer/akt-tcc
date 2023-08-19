import { Options } from "./options";
import { TXStore } from "./txstore";
import { registryCenter } from "./tccregister";
import { ComponentEntity, RequestEntity, Transaction, TXStatus } from "./model";
import { TCCComponent, TCCReq } from "./component";

export class TXManager {
  registryCenter: registryCenter;
  monitor: NodeJS.Timeout | null = null;
  txStore: TXStore;
  opts: Options;

  constructor(opts: Partial<Options>, txStore: TXStore) {
    this.txStore = txStore;
    this.opts = {
      timeout: opts.timeout || 5 * 1000,
      monitorTick: opts.monitorTick || 10 * 1000,
    };
    this.registryCenter = new registryCenter();

    this.#run();
  }

  stop = () => {
    if (this.monitor) {
      clearTimeout(this.monitor);
    }
  };

  register = (component: TCCComponent) => {
    return this.registryCenter.register(component);
  };

  transaction = async (...reqs: RequestEntity[]) => {
    // 获得所有的组件
    const componentEntities = await this.#getComponents(...reqs);

    // 1 先创建事务明细记录，并取得全局唯一的事务 id
    const txID = await this.txStore.CreateTX(
      ...componentEntities.map((entity) => entity.component)
    );

    // 2. 两阶段提交， try-confirm/cancel
    return await this.#twoPhaseCommit(txID, componentEntities);
  };

  #backOffTick = (tick: number) => {
    tick <<= 1;
    const threshold = this.opts.monitorTick << 3;
    if (tick > threshold) {
      return threshold;
    }
    return tick;
  };

  #run = () => {
    let tick = 0;
    const fn = (err?: Error) => {
      if (err) {
        tick = this.#backOffTick(tick);
      }
      return setTimeout(async () => {
        tick = this.opts.monitorTick;

        try {
          await this.txStore.Lock(this.opts.monitorTick);
        } catch (e) {
          this.monitor = fn();
          return;
        }

        try {
          const txs = await this.txStore.GetHangingTXs();

          await this.#batchAdvanceProgress(txs);

          await this.txStore.Unlock();

          this.monitor = fn();
        } catch (e) {
          this.monitor = fn(e as Error);
        }
      }, tick);
    };

    this.monitor = fn();
  };

  // 对每笔事务进行状态推进
  #batchAdvanceProgress = async (txs: Transaction[]) => {
    const tasks = txs.map((tx) => this.#advanceProgress(tx));

    const res = await Promise.allSettled(tasks);

    for (const r of res) {
      if (r.status === "rejected") {
        throw r.reason;
      }
    }
  };

  #advanceProgress = async (tx: Transaction) => {
    const txStatus = tx.getStatus(Date.now() - this.opts.timeout);

    // hanging 状态的暂时不处理
    if (txStatus === TXStatus.TXHanging) {
      return;
    }

    const success = txStatus === TXStatus.TXSuccessful;

    for (let i = 0; i < tx.components.length; i++) {
      const component = tx.components[i];

      // 获取对应的 tcc component
      const components = await this.registryCenter.getComponents(
        component.componentID
      );

      if (components.length === 0) {
        throw Error("get tcc component length is 0");
      }

      // 执行二阶段的 confirm 或者 cancel 操作
      if (success) {
        const { ack } = await components[0].Confirm(tx.txID);
        if (!ack) {
          throw Error(`component: ${component.componentID} ack failed`);
        }
      } else {
        const { ack } = await components[0].Cancel(tx.txID);
        if (!ack) {
          throw Error(`component: ${component.componentID} ack failed`);
        }
      }
    }

    return await this.txStore.TXSubmit(tx.txID, success);
  };

  #advanceProgressByTXID = async (txID: string) => {
    // 获取事务日志记录
    const tx = await this.txStore.GetTX(txID);
    return await this.#advanceProgress(tx);
  };

  #twoPhaseCommit = async (
    txID: string,
    componentEntities: ComponentEntity[]
  ) => {
    const txs = componentEntities.map(async (componentEntity) => {
      const id = await componentEntity.component.ID();
      const resp = await componentEntity.component.Try(
        new TCCReq(id, txID, componentEntity.request)
      );

      // 但凡有一个 component try 报错或者拒绝，都是需要进行 cancel 的，但会放在 advanceProgressByTXID 流程处理
      if (!resp.ack) {
        await this.txStore.TXUpdate(txID, id, false);

        throw Error(`component: ${id} try failed`);
      }

      await this.txStore.TXUpdate(txID, id, true);
    });

    const resps = await Promise.allSettled(txs);

    let successful = true;

    for (const resp of resps) {
      if (resp.status === "rejected") {
        successful = false;
      }
    }

    await this.#advanceProgressByTXID(txID);

    return successful;
  };

  #getComponents = async (...reqs: RequestEntity[]) => {
    const idToReq: Record<string, RequestEntity> = {};
    const componentIDs = [];
    for (const req of reqs) {
      idToReq[req.componentName] = req;
      componentIDs.push(req.componentName);
    }

    const components = await this.registryCenter.getComponents(...componentIDs);

    if (componentIDs.length !== components.length) {
      throw Error("invalid componentIDs");
    }

    return Promise.all(
      components.map(
        async (component) =>
          ({
            request: idToReq[await component.ID()],
            component: component,
          } as ComponentEntity)
      )
    );
  };
}
