import { Service } from 'typedi'

type DownloadLinks = string[]

@Service()
export class DownloadLinkFileDecoder {
  constructor() {}

  decode(linkString: string): DownloadLinks {
    return linkString.split('\n').filter(items => !!items)
  }
}