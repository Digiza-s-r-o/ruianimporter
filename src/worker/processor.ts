import { DataProcessorManager } from '../service/dataProcessor'
import path from 'path'
import { PlainOutputFormatter } from '../service/outputFormatter/plain'
import stdout from 'stdout-stream'
import workerpool from 'workerpool'
import yauzl from 'yauzl'

const processFile = async (workDir: string, fileName: string) => {
  const dataProcessor = new DataProcessorManager()
  const plainTextFormatter = new PlainOutputFormatter()

  const filePath = path.join(workDir, fileName)

  const promise = new Promise<void>(resolve => {
  yauzl.open(filePath, {lazyEntries: true}, function(err, zipfile) {
    zipfile.readEntry();
    zipfile.on("entry", function(entry) {
      zipfile.openReadStream(entry, function(err, readStream) {
        dataProcessor.convert(readStream, stdout, plainTextFormatter).then(() => {
          resolve()
        })
      })
    })
  })
  })

  await promise
}

workerpool.worker({
  async processFile(workdir: string, fileName: string) {
    await processFile(workdir, fileName)
  }
})