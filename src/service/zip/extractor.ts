import * as fs from 'fs'
import unzip from 'unzip-stream'
import { Service } from 'typedi'

@Service()
export class Extractor {
  async extractFile(sourceFilepath: string, detinationFilepath: string, progressStart: (size: number) => void, progressCallback: (chunk: number) => void): Promise<void> {
    return new Promise((resolve) => {
    fs.createReadStream(sourceFilepath)
      .pipe(unzip.Parse())
      .on('entry', function (entry) {
        var filePath = entry.path;
        var type = entry.type; // 'Directory' or 'File'
        var size = entry.size; // might be undefined in some archives

        if (!!progressStart) {
          progressStart(size)
        }

        entry.on('data', (chunk: any) => {
          const size = chunk.length
          progressCallback(size)
        }).pipe(fs.createWriteStream(detinationFilepath)).on('finish', () => {
          resolve()
        })
      })
    })
  }
}