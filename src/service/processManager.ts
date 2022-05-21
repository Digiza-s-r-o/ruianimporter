import cliProgress from 'cli-progress'
import { Inject, Service } from 'typedi'
import { FsManager } from './fsManager'
import * as path from 'path'

export interface ProgressData<T> {
  finished: boolean
  workdir: string
  data: T | null
}

export interface Process<T> {
  doStart(previousProgressData: ProgressData<unknown> | undefined, progress: ProgressData<T>, progressBar: cliProgress.SingleBar, saveProgress: (progress: ProgressData<T>) => void): Promise<ProgressData<T>>
  processId(): string
}

const CURRENT_PROGRESS_FILE = 'currentProgress.json'
const MAX_RETRY_COUNT = 8

@Service()
export class ProcessManager {
  constructor(
    @Inject('process.workdir') private readonly progressDirectory: string,
    private readonly fsManager: FsManager
  ) {}

  async start<T>(process: Process<T>, progressBar: cliProgress.SingleBar, previousProgressData: ProgressData<unknown> | undefined = undefined, retryCount = 0): Promise<ProgressData<T>> {
      if (retryCount > MAX_RETRY_COUNT) {
        throw new Error('Maximum number of retries reached!')
      }

      const progressDir = path.join(this.progressDirectory, process.processId())
      const progressFile = path.join(progressDir, CURRENT_PROGRESS_FILE)

      if (!this.fsManager.isExisting(progressDir)) {
        this.fsManager.createDirectory(progressDir)
      }

      let lastProgress = { finished: false, data: null, workdir: progressDir }
      if (this.fsManager.isExisting(progressFile)) {
        lastProgress = JSON.parse(this.fsManager.readFromFile(progressFile))
      }

      try {
        let finishedData = await process.doStart(previousProgressData, lastProgress, progressBar, this.saveProgress(progressFile))
        finishedData.finished = true
        this.saveProgress(progressFile)(finishedData)

        return finishedData
      } catch (e) {
        return this.start(process, progressBar, previousProgressData, retryCount + 1)
      }
  }

  private saveProgress = (path: string) => <T>(progress: ProgressData<T>) => {
    this.fsManager.saveIntoFile(path, JSON.stringify(progress))
  }
}