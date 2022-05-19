import 'reflect-metadata'
import 'dotenv/config'
import cliProgress from 'cli-progress'
import * as fsPromises from 'fs/promises'
import * as fs from 'fs'
import {Container} from 'typedi'
import saxes from 'saxes'
import {
  DOWNLOAD_TYPE_COMPLETE,
  DOWNLOAD_TYPE_INCREMENTAL,
  Downloader, DownloadType,
  isSupportedDownloadType
} from './download/downloader'
import path from 'path'
import { Extractor } from './zip/extractor'

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

  // Start downloading files
  const links = await downloader.getFileDownloadLinks(process.env.DOWNLOAD_TYPE as DownloadType)

  const downloadEachFilesProgressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);

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
  }

  // Our downloading got finished!
  // Now we need to extract the files
  // After the extraction, let's delete old .zip files

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