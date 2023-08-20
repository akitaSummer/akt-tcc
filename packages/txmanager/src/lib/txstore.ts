import { TCCComponent } from "./component";
import { Transaction } from "./model";

export interface TXStore {
  CreateTX(...components: TCCComponent[]): Promise<string> | string;
  TXUpdate(
    txID: string,
    componentID: string,
    accept: boolean
  ): Promise<void> | void;
  TXSubmit(txID: string, success: boolean): Promise<void> | void;
  GetHangingTXs(): Promise<Transaction[]> | Transaction[];
  GetTX(txID: string): Promise<Transaction> | Transaction;
  Lock(expireDuration: number): Promise<void> | void;
  Unlock(): Promise<void> | void;
}
