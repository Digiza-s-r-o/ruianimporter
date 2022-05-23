import { OutputData } from '../dataProcessor'

export interface OutputFormatter {
  format(data: OutputData): string
}