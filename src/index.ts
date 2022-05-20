import 'reflect-metadata'
import 'dotenv/config'
import cliProgress from 'cli-progress'
import * as fsPromises from 'fs/promises'
import * as fs from 'fs'
import {Container} from 'typedi'
import {
  DOWNLOAD_TYPE_COMPLETE,
  DOWNLOAD_TYPE_INCREMENTAL,
  Downloader, DownloadLinks, DownloadType,
  isSupportedDownloadType
} from './download'
import { Extractor } from './zip'
import path from 'path'

(async () => {
  const workdir = process.env.WORK_DIR
  if (!workdir) {
    throw new Error('WORK_DIR environment variable is not specified inside of .env file!')
  }

  const incrementaldatabaselinks = process.env.INCREMENTAL_DATABASE_LINKS
  if (!incrementaldatabaselinks) {
    throw new Error('INCREMENTAL_DATABASE_LINKS environment variable is not specified inside of .env file!')
  }

  const fulldatabaselinks = process.env.FULL_DATABASE_LINKS
  if (!fulldatabaselinks) {
    throw new Error('FULL_DATABASE_LINKS environment variable is not specified inside of .env file!')
  }

  if (!process.env.DOWNLOAD_TYPE) {
    throw new Error('DOWNLOAD_TYPE environment variable is required!')
  }

  if (!isSupportedDownloadType(process.env.DOWNLOAD_TYPE)) {
    throw new Error('DOWNLOAD_TYPE environment variable is required!')
  }

  await fsPromises.mkdir(workdir, {recursive:true}).catch((err) => {
    //decide what you want to do if this failed
    console.error(err);
  });

  const downloadLinks = {
    [DOWNLOAD_TYPE_INCREMENTAL]: process.env.INCREMENTAL_DATABASE_LINKS,
    [DOWNLOAD_TYPE_COMPLETE]: process.env.FULL_DATABASE_LINKS
  }

  Container.set('download.links', downloadLinks)
  const downloader = Container.get(Downloader)
  const extractor = Container.get(Extractor)

  // Start downloading files;
  console.log('Starting to download .zip files...')

  const downloadLinksFilePath = path.join(workdir, 'downloadLinks.json')
  let links: DownloadLinks = []

  if (fs.existsSync(downloadLinksFilePath)) {
    if (fs.readFileSync(downloadLinksFilePath).length > 0) {
      links = JSON.parse(fs.readFileSync(downloadLinksFilePath).toString()) as DownloadLinks
    }
  } else {
    links = await downloader.getFileDownloadLinks(process.env.DOWNLOAD_TYPE as DownloadType) as DownloadLinks
    fs.writeFileSync(downloadLinksFilePath, JSON.stringify(links))
  }


  const downloadProgressPath = path.join(workdir, 'downloadProgress.txt')

  if (fs.existsSync(downloadProgressPath)) {
    const currentLink = fs.readFileSync(downloadProgressPath).toString()

    if (!!currentLink) {
      links = links.splice(0, links.indexOf(currentLink) + 1)
    }
  }

  const downloadEachFilesProgressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic)

  for (const link of links) {
    const filename = link.split("/").pop()
    if (!filename) {
      throw new Error(`Unable to get filename for URL ${link}`)
    }

    const filePath = path.join(workdir, filename)
      await downloader.startDownloading(
        link,
        filePath,
        (size) => downloadEachFilesProgressBar.start(size, 0),
        (size) => downloadEachFilesProgressBar.increment(size))
      downloadEachFilesProgressBar.stop()

    fs.writeFileSync(downloadProgressPath, link)
  }



  // Our downloading got finished!
  // Now we need to extract the files
  // After the extraction, let's delete old .zip files
  console.log('Starting to extract .zip files...')
  const fileNames = fs.readdirSync(workdir);
  for (const filename of fileNames) {
    const sourcePath = path.join(workdir, filename)
    const destinationPath = path.join(workdir, filename.replace('.zip', ''))

    await extractor.extractFile(
      sourcePath,
      destinationPath,
      (size) => downloadEachFilesProgressBar.start(size, 0),
      (size) => downloadEachFilesProgressBar.increment(size))
    downloadEachFilesProgressBar.stop()
  }



})()