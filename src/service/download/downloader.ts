import { DownloadLinkFileDecoder } from './downloadLinkFileDecoder'
import { Inject, Service } from 'typedi'
import fetch from 'cross-fetch'

import fs from 'fs'
import got from 'got'
import { pipeline } from '../stream/pipeline'

export const DOWNLOAD_TYPE_INCREMENTAL = 'INCREMENTAL'
export const DOWNLOAD_TYPE_COMPLETE = 'COMPLETE'

export type DownloadType = typeof DOWNLOAD_TYPE_INCREMENTAL | typeof DOWNLOAD_TYPE_COMPLETE

export const isSupportedDownloadType = (downloadType: string): boolean => {
  return [DOWNLOAD_TYPE_COMPLETE, DOWNLOAD_TYPE_INCREMENTAL].includes(downloadType)
}

type getUrlAddressLinks = {
  [DOWNLOAD_TYPE_INCREMENTAL]: string
  [DOWNLOAD_TYPE_COMPLETE]: string
}

const MAX_RETRY_COUNT = 8

@Service()
export class Downloader {
  constructor(@Inject('download.links') private readonly links: getUrlAddressLinks, private readonly downloadLinkFileDecoder: DownloadLinkFileDecoder) {}

  private getDownloadLinks(type: DownloadType): string {
    switch(type) {
      case DOWNLOAD_TYPE_COMPLETE:
        return this.links[DOWNLOAD_TYPE_COMPLETE]
      case DOWNLOAD_TYPE_INCREMENTAL:
        return this.links[DOWNLOAD_TYPE_INCREMENTAL]
      default:
        throw new Error(`Unrecognized download type ${type} given!`)
    }
  }

  async getFileDownloadLinks(type: DownloadType) {
    const getDownloadLinksUrl =  this.getDownloadLinks(type)

    const response = await fetch(getDownloadLinksUrl)
    const rawLinks = await response.text()

    return this.downloadLinkFileDecoder.decode(rawLinks)
  }


  // RegExp to extract the filename from Content-Disposition
  private getFilenameRegex = /filename=\"(.*)\"/gi;


  async startDownloading(link: string, filePath: string, startCallback: (size: number) => void, advanceCallback: (size: number) => void | undefined, retryCount = 0): Promise<void> {
    const url = new URL(link)

    if (retryCount >= MAX_RETRY_COUNT) {
      throw new Error('Max retry count reached')
    }

    try {
      const stream = got.stream(url, { throwHttpErrors: false, retry: { limit: 5, } }).on('response', (response) => {
        // check if response is success
        if (response.statusCode !== 200) {
          throw new Error(`start downloading failed. Status code is not 200! Unable to get downloaded filename from url: ${link}`)
        }
        if (!!startCallback && !!response.headers['content-length']) {
          // Change the total bytes value to get progress later
          const size = parseInt(response.headers['content-length']);
          startCallback(size)
        }

        response.on('data', (chunk: any) => {
          if (!!advanceCallback) {
            advanceCallback(chunk.length)
          }
        })

        response.on('retry', () => this.startDownloading(link, filePath, startCallback, advanceCallback))
      })

      return await pipeline(stream, fs.createWriteStream(filePath))
    } catch (e) {
      console.log(`Error while downloading file ${link} occured`)
      return this.startDownloading(link, filePath, startCallback, advanceCallback, retryCount + 1)
    }
  }
}