export class TCCReq {
  constructor(
    public componentID: string,
    public txID: string,
    public data: Record<string, any> = {}
  ) {}
}

export class TCCResp {
  constructor(
    public componentID: string,
    public ack: boolean,
    public txID: string
  ) {}
}

export interface TCCComponent {
  ID(): Promise<string> | string;
  Try(req: TCCReq): Promise<TCCResp> | TCCResp;
  Confirm(txID: string): Promise<TCCResp> | TCCResp;
  Cancel(txID: string): Promise<TCCResp> | TCCResp;
}
