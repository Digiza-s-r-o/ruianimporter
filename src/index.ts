import 'reflect-metadata'
import 'dotenv/config'
import cliProgress, { SingleBar } from 'cli-progress'
import * as fsPromises from 'fs/promises'
import {Container} from 'typedi'
import {
  DOWNLOAD_TYPE_COMPLETE,
  DOWNLOAD_TYPE_INCREMENTAL, getUrlAddressLinks,
  isSupportedDownloadType
} from './service/download'
import { ProcessManager } from './service/processManager'
import { DownloadProcess } from './process/downloadProcess'
import { DataProcessorManager } from './service/dataProcessor'
import StreamZip from 'node-stream-zip'
import stdout from 'stdout-stream'
import { FsManager } from './service/fsManager'
import * as path from 'path'
import { PlainOutputFormatter } from './service/outputFormatter/plain'
import workerpool, { Promise as WorkerpoolPromise } from 'workerpool'
import * as fs from 'fs'
import { OutputFormatter } from './service/outputFormatter/types'
import { spawn, Worker } from 'threads'
import { v4 } from 'uuid'

(async () => {
  const workdir = process.env.WORK_DIR
  if (!workdir) {
    throw new Error('WORK_DIR environment variable is not specified inside of .env file!')
  }

  const incrementaldatabaselinks = process.env.INCREMENTAL_DATABASE_LINKS
  if (!incrementaldatabaselinks) {
    throw new Error('INCREMENTAL_DATABASE_LINKS environment variable is not specified inside of .env file!')
  }

  const fulldatabaselinks = process.env.FULL_ADDRESS_LINKS
  if (!fulldatabaselinks) {
    throw new Error('FULL_ADDRESS_LINKS environment variable is not specified inside of .env file!')
  }

  const fullregionslinks = process.env.FULL_REGIONS_LINKS
  if (!fullregionslinks) {
    throw new Error('FULL_REGIONS_LINKS environment variable is not specified inside of .env file!')
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

  const downloadLinks: getUrlAddressLinks = {
    [DOWNLOAD_TYPE_INCREMENTAL]: process.env.INCREMENTAL_DATABASE_LINKS as string,
    [DOWNLOAD_TYPE_COMPLETE]: { addresses: process.env.FULL_ADDRESS_LINKS as string, regions: process.env.FULL_REGIONS_LINKS as string}
  }

  Container.set('download.links', downloadLinks)
  Container.set('process.workdir', workdir)
  const processManager = Container.get(ProcessManager)
  const downloadProcess = Container.get(DownloadProcess)
  const fsManager = Container.get(FsManager)

  const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic)

  // Start downloading files;

  console.log('Starting to download .zip files...')
  // const result = await processManager.start(downloadProcess, progressBar)
  // if (!result.data?.total) {
  //   throw new Error('Malformed download progress data!')
  // }


  progressBar.start(31295, 1)
  const workDirPath = 'workdir/downloadProcess'

  console.log('Starting to unzip .zip files...')
  const dataProcessor = new DataProcessorManager()


  // const filePath = path.join(workDirPath, '20211231_OB_500101_UKSH.xml')
  // const readStream = fs.createReadStream(filePath)
  // await dataProcessor.convert(readStream, stdout, plainTextFormatter)
  // process.exit()

  const MAX_THREADS = 8

  const pool = workerpool.pool('./worker/processor.js');
  let promises: {[key: string]: WorkerpoolPromise<ReturnType<any>>} = {}
  const files = fsManager.getFilesInDir(workDirPath)
  for (const fileName of files) {
    const idWorker = v4()
    const currentPromise = pool.exec('processFile', [workDirPath, fileName])
    currentPromise.then(() => {
      delete promises[idWorker]
    })

    promises[idWorker] = currentPromise

    if (Object.keys(promises).length >= MAX_THREADS && await Promise.any(Object.values(promises))) {
      continue
    }

    progressBar.increment(1)
  }

  process.exit(0)
})()

