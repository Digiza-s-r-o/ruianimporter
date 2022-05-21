import { Process, ProgressData } from '../service/processManager'
import { Downloader, DownloadLinks, DownloadType } from '../service/download'
import cliProgress from 'cli-progress'
import path from 'path'
import { Service } from 'typedi'

@Service()
export class DownloadProcess implements Process<DownloadLinks> {
  constructor(private readonly downloader: Downloader) {}

   processId(): string {
     return 'downloadProcess'
   }

    async doStart(previousProgressData: ProgressData<unknown> | undefined, progress: ProgressData<DownloadLinks>, progressBar: cliProgress.SingleBar, saveProgress: (progress: ProgressData<DownloadLinks>) => void) {
      if (!progress.data) {
        progress.data = await this.downloader.getFileDownloadLinks(process.env.DOWNLOAD_TYPE as DownloadType) as unknown as DownloadLinks
      }

      saveProgress(progress)

      for (const link of progress.data) {
        const filename = link.split("/").pop()
        if (!filename) {
          throw new Error(`Unable to get filename for URL ${link}`)
        }

        const filePath = path.join(progress.workdir, filename)
        await this.downloader.startDownloading(
          link,
          filePath,
          (size) => progressBar.start(size, 0),
          (size) => progressBar.increment(size))
          progressBar.stop()

        progress.data.shift()
        saveProgress(progress)
      }

      return progress
    }
}