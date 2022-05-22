import { DownloadLinkFileDecoder } from './downloadLinkFileDecoder'
import { Inject, Service } from 'typedi'
import fetch from 'cross-fetch'

import fs from 'fs'
import got from 'got'
import { pipeline } from '../stream'

export const DOWNLOAD_TYPE_INCREMENTAL = 'INCREMENTAL'
export const DOWNLOAD_TYPE_COMPLETE = 'COMPLETE'

export type DownloadType = typeof DOWNLOAD_TYPE_INCREMENTAL | typeof DOWNLOAD_TYPE_COMPLETE

export const isSupportedDownloadType = (downloadType: string): boolean => {
  return [DOWNLOAD_TYPE_COMPLETE, DOWNLOAD_TYPE_INCREMENTAL].includes(downloadType)
}

export type getUrlAddressLinks = {
  [DOWNLOAD_TYPE_INCREMENTAL]: string
  [DOWNLOAD_TYPE_COMPLETE]: { addresses: string, regions: string }
}

const MAX_RETRY_COUNT = 8

@Service()
export class Downloader {
  constructor(@Inject('download.links') private readonly links: getUrlAddressLinks, private readonly downloadLinkFileDecoder: DownloadLinkFileDecoder) {}
  async getFileDownloadLinks(type: DownloadType) {
    let rawLinks: string

    switch(type) {
      case DOWNLOAD_TYPE_COMPLETE:
        const links = this.links[DOWNLOAD_TYPE_COMPLETE]

        const addressesResponse = await fetch(links.addresses)
        const addressesLinks = await addressesResponse.text()

        const regionsResponse = await fetch(links.regions)
        const regionsLinks = await regionsResponse.text()

        rawLinks = addressesLinks + '\n' + regionsLinks

        break
      case DOWNLOAD_TYPE_INCREMENTAL:
        const incrementalLinksUrl = this.links[DOWNLOAD_TYPE_INCREMENTAL]

        const incrementalResponse = await fetch(incrementalLinksUrl)
        rawLinks = await incrementalResponse.text()

        break
      default:
        throw new Error(`Unrecognized download type ${type} given!`)
    }


    return this.downloadLinkFileDecoder.decode(rawLinks)
  }


  // RegExp to extract the filename from Content-Disposition
  private getFilenameRegex = /filename=\"(.*)\"/gi;


  async startDownloading(link: string, filePath: string, startCallback?: ((size: number) => void), advanceCallback?: ((size: number) => void), retryCount = 0): Promise<void> {
    const url = new URL(link)

    if (retryCount >= MAX_RETRY_COUNT) {
      throw new Error('Max retry count reached')
    }

    try {
      let fileStream = fs.createWriteStream(filePath)
      const stream = got.stream(url, { throwHttpErrors: false, retry: { limit: MAX_RETRY_COUNT, } }).on('retry', function(params) {
        fileStream = fs.createWriteStream(filePath)
        console.log(params)
      })

      return await pipeline(stream, fileStream)
    } catch (e) {
      console.log(`Error while downloading file ${link} occured`)
      return this.startDownloading(link, filePath, startCallback, advanceCallback, retryCount + 1)
    }
  }
}