import { Process, ProgressData } from '../service/processManager'
import { Downloader, DownloadLinks, DownloadType } from '../service/download'
import cliProgress from 'cli-progress'
import path from 'path'
import fs from 'fs'
import { Extractor } from '../service/zip'
import { Service } from 'typedi'

@Service()
export class ExtractProcess implements Process<string[]> {
  constructor(private readonly extractor: Extractor) {}

   processId(): string {
     return 'extractProcess'
   }

  async doStart(previousProgressData: ProgressData<unknown> | undefined, progress: ProgressData<string[]>, progressBar: cliProgress.SingleBar, saveProgress: (progress: ProgressData<string[]>) => void) {
    if (previousProgressData === undefined) {
      throw new Error('previousProgressData cannot be empty!')
    }

    if (!progress.data) {
        progress.data = fs.readdirSync(previousProgressData.workdir);
      }

      saveProgress(progress)

    for (const filename of progress.data) {
      const sourcePath = path.join(previousProgressData.workdir, filename)
      const destinationPath = path.join(progress.workdir, filename.replace('.zip', ''))

      await this.extractor.extractFile(
        sourcePath,
        destinationPath,
        (size) => progressBar.start(size, 0),
        (size) => progressBar.increment(size))
        progressBar.stop()
        saveProgress(progress)
      }

      return progress
    }
}