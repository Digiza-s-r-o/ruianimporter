
// @ts-ignore
import Parser from 'node-xml-stream'
import { MunicipalityProcessor } from './processor/municipality'
import { MunicipalityPartProcessor } from './processor/municipalityPart'
import { CadastralProcessor } from './processor/cadastral'
import { ParcelProcessor } from './processor/parcel'
import { BuildingProcessor } from './processor/building'
import { AddressProcessor } from './processor/address'
import { RegionProcessor } from './processor/region'
import { CountyProcessor } from './processor/county'
import { PragueDistrictProcessor } from './processor/pragueDistrict'
import { StreetProcessor } from './processor/street'
import { Writable } from 'stream'
import { OutputFormatter } from './outputFormatter/types'

export interface DataProcessor {
  canBeUsed(): boolean
  convertData(data: DataCollection): OutputData
}

export class DataCollection {
  constructor() {
    this.children = {}
  }

  depth!: number
  parent?: DataCollection
  nodeName!: string
  text?: string
  attributes!: {[key: string]: string}
  children!: {[key: string]: DataCollection}
}

class DataCollector {
  constructor(depth: number) {
    this.depth = depth
  }

  depth!: number
  currentNodeCollection!: DataCollection
  topLevelDataCollection!: DataCollection
}

export class OutputData {
  constructor(tableName: string) {
    this.table = tableName
    this.values = []
  }

  table!: string
  values!: OutputDataValues[]
}

export class OutputDataValues {
  column!: string
  value!: string
}

export class DataProcessorManager {
  private readonly processorsMap: {[key: string]: DataProcessor} = {
    ['vf:Obec']: new MunicipalityProcessor(),
    ['vf:CastObce']: new MunicipalityPartProcessor(),
    ['vf:KatastralniUzemi']: new CadastralProcessor(),
    ['vf:Parcela']: new ParcelProcessor(),
    ['vf:StavebniObjekt']: new BuildingProcessor(),
    ['vf:AdresniMisto']: new AddressProcessor(),
    ['vf:Vusc']: new RegionProcessor(),
    ['vf:Okres']: new CountyProcessor(),
    ['vf:Mop']: new PragueDistrictProcessor(),
    ['vf:Ulice']: new StreetProcessor(),
  }

  private readonly parser = new Parser()

    async convert(inputReader: NodeJS.ReadableStream, outputWriter: Writable, outputFormatter: OutputFormatter) {
      const collector = new DataCollector(1)
      this.parser.on('opentag', (name: string, attrs: {[key: string]: string}) => {
        collector.depth++
        const collection = new DataCollection()
        collection.nodeName = name
        collection.attributes = attrs
        collection.depth = collector.depth

        // Collectora inicializujeme jenom v případě, že vstupujeme do prvku: vf:Data
        if (!collector.topLevelDataCollection && name === 'vf:Data') {
          collector.topLevelDataCollection = collection
          collector.currentNodeCollection = collection
          return
        }

        // Nechceme pokračovat ve sbírání dat, pokud ještě nemáme pořádně inicializovaného collectora
        if (!collector.topLevelDataCollection) {
          return
        }

        const parentCollection = collector.currentNodeCollection
        collection.parent = parentCollection
        collector.currentNodeCollection = collection

        // Nechceme ukládat veškerá data
        if (collector.topLevelDataCollection !== collector.currentNodeCollection.parent) {
          parentCollection.children[name] = collection
        }
      })

      this.parser.on('text', (text: string) => {
        if (!!collector.currentNodeCollection) {
          collector.currentNodeCollection.text = text
        }
      })

      this.parser.on('error', function (error: string) {
        throw new Error(error)
      })


      const promise = new Promise<void>(resolve => {

        this.parser.on('closetag', (name: string) => {
          collector.depth--
          if (collector.depth === 1) {
            resolve()
            return
          }

          const processor = this.processorsMap[name]
          if (!processor) {
            if (!!collector?.currentNodeCollection?.parent) {
              collector.currentNodeCollection = collector.currentNodeCollection.parent
            }

            return
          }

          // U katastrálního území se jmenuje kontejner stejně jako prvek. My potřebujeme zpracovávat jedině prvek
          // Takže si ověříme, jestli vf:KatastralniUzemi obsahuje parent vf:KatastralniUzemi
          if (!!collector?.currentNodeCollection?.parent && collector.currentNodeCollection.parent?.nodeName !== name) {
            switch (true) {
              case processor instanceof CadastralProcessor:
              case processor instanceof StreetProcessor:
                collector.currentNodeCollection = collector.currentNodeCollection.parent
                return
            }
          }

          if (!!collector?.currentNodeCollection?.parent) {
            collector.currentNodeCollection = collector.currentNodeCollection.parent
          }

          const output = processor.convertData(collector.currentNodeCollection)
          const convertedOutput = outputFormatter.format(output)

          this.parser.emit('data', convertedOutput)
          outputWriter.write(convertedOutput)


        })
      })

      inputReader.once('error', function(err) {
        inputReader.emit('error', err);
      });

      inputReader.on('readable', () => {
        let chunk
        while (null !== (chunk = inputReader.read())) {
          this.parser.write(chunk)
        }
        // this.parser.end()
      })


      await promise
      this.parser.removeAllListeners()
      inputReader.removeAllListeners()
  }
}