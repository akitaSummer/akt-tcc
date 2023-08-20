import { prisma } from './mysql';

export class TXRecordDAO {
  static async GetTXRecords(
    args?: Parameters<typeof prisma.tx_record.findMany>[0]
  ) {
    return await prisma.tx_record.findMany(args);
  }

  static async CreateTXRecord(
    args?: Parameters<typeof prisma.tx_record.create>[0]
  ) {
    return await prisma.tx_record.create(args);
  }

  static async UpdateTXRecord(
    args?: Parameters<typeof prisma.tx_record.update>[0]
  ) {
    return await prisma.tx_record.update(args);
  }

  static async UpdateComponentStatus(
    id: string,
    componentID: string,
    status: string
  ) {
    const res = await prisma.tx_record.findFirst({
      where: {
        id,
      },
    });

    const component_try_statuses = JSON.parse(
      res.component_try_statuses.toString()
    );

    component_try_statuses[componentID].tryStatus = status;
    return await prisma.tx_record.update({
      where: {
        id,
      },
      data: {
        component_try_statuses: JSON.stringify(component_try_statuses),
      },
    });
  }
}
