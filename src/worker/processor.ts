import { DataProcessorManager } from '../service/dataProcessor'
import path from 'path'
import StreamZip from 'node-stream-zip'
import { PlainOutputFormatter } from '../service/outputFormatter/plain'
import stdout from 'stdout-stream'
import workerpool from 'workerpool'


const dataProcessor = new DataProcessorManager()
const plainTextFormatter = new PlainOutputFormatter()

const processFile = async (workDir: string, fileName: string) => {

  const filePath = path.join(workDir, fileName)
  const fileNameInside =  fileName.replace(/\.zip$/, '')

  const zip = new StreamZip.async({ file: filePath });
  const unzipStream = await zip.stream(fileNameInside)

  await dataProcessor.convert(unzipStream, stdout, plainTextFormatter)
}

workerpool.worker({
  async processFile(workdir: string, fileName: string) {
    await processFile(workdir, fileName)
  }
})