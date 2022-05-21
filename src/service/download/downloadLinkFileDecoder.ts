import { Service } from 'typedi'

export type DownloadLinks = string[]

@Service()
export class DownloadLinkFileDecoder {
  constructor() {}

  decode(linkString: string): DownloadLinks {
    return linkString.split('\n').filter(items => !!items)
  }
}