import 'reflect-metadata'
import 'dotenv/config'
import cliProgress from 'cli-progress'
import * as fsPromises from 'fs/promises'
import {Container} from 'typedi'
import {
  DOWNLOAD_TYPE_COMPLETE,
  DOWNLOAD_TYPE_INCREMENTAL,
  isSupportedDownloadType
} from './service/download'
import { ProcessManager } from './service/processManager'
import { DownloadProcess } from './process/downloadProcess'
import { ExtractProcess } from './process/extractFilesProcess'

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
  Container.set('process.workdir', workdir)
  const processManager = Container.get(ProcessManager)
  const downloadProcess = Container.get(DownloadProcess)
  const extractProcess = Container.get(ExtractProcess)

  const progressBar = new cliProgress.SingleBar({ }, cliProgress.Presets.shades_classic)

  // Start downloading files;

  console.log('Starting to download .zip files...')
  const result = await processManager.start(downloadProcess, progressBar)




  // Our downloading got finished!
  // Now we need to extract the files
  // After the extraction, let's delete old .zip files
  console.log('Starting to extract .zip files...')
  await processManager.start(extractProcess, progressBar, result)




})()