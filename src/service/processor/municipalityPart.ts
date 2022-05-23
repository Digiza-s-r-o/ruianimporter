import { DataCollection, DataProcessor, OutputData } from '../dataProcessor'

export class MunicipalityPartProcessor implements DataProcessor {
  canBeUsed(): boolean {
    return false;
  }

  convertData(data: DataCollection): OutputData {
    return new OutputData('municipalityPart');
  }
}