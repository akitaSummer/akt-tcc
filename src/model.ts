import { TCCComponent } from "./component";

export enum TXStatus {
  TXHanging = "hanging",
  TXSuccessful = "successful",
  TXFailure = "failure",
}

export enum ComponentTryStatus {
  TryHanging = "hanging",
  TrySucceesful = "successful",
  TryFailure = "failure",
}

export type RequestEntity = {
  componentName: string;
  request: Record<string, any>;
};

export type ComponentEntity = {
  request: Record<string, any>;
  component: TCCComponent;
};

export type ComponentTryEntity = {
  componentID: string;
  tryStatus: ComponentTryStatus;
};

export class Transaction {
  constructor(
    public txID: string,
    public components: ComponentTryEntity[] = [],
    // public status: TXStatus = TXStatus.TXHanging,
    public createdAt: number = Date.now()
  ) {}

  getStatus = (createdBefore: number) => {
    // 获取事务的状态
    // 1 如果事务超时了，都还未被置为成功，直接置为失败
    if (this.createdAt < createdBefore) {
      return TXStatus.TXFailure;
    }

    let hangingExist = false;

    // 如果当中出现失败的，直接置为失败
    for (let i = 0; i < this.components.length; i++) {
      if (this.components[i].tryStatus == ComponentTryStatus.TryFailure) {
        return TXStatus.TXFailure;
      }

      hangingExist =
        this.components[i].tryStatus !== ComponentTryStatus.TrySucceesful;
    }

    // 如果存在组件 try 操作没执行成功，则返回 hanging 状态
    if (hangingExist) {
      return TXStatus.TXHanging;
    }
    return TXStatus.TXSuccessful;
  };
}
