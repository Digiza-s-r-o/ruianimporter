import { DataCollection, DataProcessor, OutputData } from '../dataProcessor'

export class AddressProcessor implements DataProcessor {
  canBeUsed(): boolean {
    return false;
  }

  convertData(data: DataCollection): OutputData {
    const outputData = new OutputData('address')
    if (!!data.children['ami:CisloDomovni']?.text) {
      outputData.values.push({ column: 'houseNumber', value: data.children['ami:CisloDomovni'].text})
    }

    return outputData
  }
}