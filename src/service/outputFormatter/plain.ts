import { OutputFormatter } from './types'
import { OutputData } from '../dataProcessor'

export class PlainOutputFormatter implements OutputFormatter {
  format(data: OutputData): string {
    return ''
    return `
    ${data.table}
    ------------------------
    ${data.values.map(val => `${val.column}: ${val.value}\n`)}`;
  }
}