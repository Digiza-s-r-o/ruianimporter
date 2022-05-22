import { Process, ProgressData } from '../service/processManager'
import { Downloader, DownloadLinks, DownloadType } from '../service/download'
import cliProgress from 'cli-progress'
import path from 'path'
import { Service } from 'typedi'
import { FsManager } from '../service/fsManager'

export type DownloadProcessData = {
  downloaded: DownloadLinks,
  yetToDownload: DownloadLinks,
  currentPosition: number,
  total: number
}

@Service()
export class DownloadProcess implements Process<DownloadProcessData> {
  constructor(private readonly downloader: Downloader, private readonly fsManager: FsManager) {}

   processId(): string {
     return 'downloadProcess'
   }

    async doStart(previousProgressData: ProgressData<unknown> | undefined, progress: ProgressData<DownloadProcessData>, progressBar: cliProgress.SingleBar, saveProgress: (progress: ProgressData<DownloadProcessData>) => void) {

      const links = await this.downloader.getFileDownloadLinks(process.env.DOWNLOAD_TYPE as DownloadType) as unknown as DownloadLinks
      if (!progress.data) {
        progress.data = {yetToDownload: links, downloaded: [], currentPosition: 1, total: links.length}
      }

      saveProgress(progress)
      progressBar.start(progress.data?.total, progress.data?.currentPosition)

      for (const link of links) {
        const filename = link.split("/").pop()
        if (!filename) {
          throw new Error(`Unable to get filename for URL ${link}`)
        }

        const filePath = path.join(progress.workdir, filename)

        if (this.fsManager.isExisting(filePath)) {
          // We don't want to progress in position since we've already got downloaded this file
          // progress.data.currentPosition = progress.data?.currentPosition + 1
          // progressBar.increment(1)
          progress.data.yetToDownload.shift()
          console.log(`filePath ${filePath} already exists. ${progress.data.yetToDownload.length} left. Skipping... `)
          continue
        }
        await this.downloader.startDownloading(link, filePath)

        progressBar.increment(1)

        progress.data.currentPosition = progress.data?.currentPosition + 1
        progress.data.yetToDownload.shift()
        progress.data.downloaded = [...progress.data?.downloaded, link]
      }
      progressBar.stop()
      saveProgress(progress)

      return progress
    }
}