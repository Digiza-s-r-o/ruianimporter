import { DataCollection, DataProcessor, OutputData } from '../dataProcessor'

export class StreetProcessor implements DataProcessor {
  canBeUsed(): boolean {
    return false;
  }

  convertData(data: DataCollection): OutputData {
    return new OutputData('street');
  }
}