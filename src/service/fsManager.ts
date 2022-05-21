import { Service } from 'typedi'
import * as fs from 'fs'

@Service()
export class FsManager {
  saveIntoFile(path: string, body: string): void {
    fs.writeFileSync(path, body)
  }

  readFromFile(path: string): string {
    return fs.readFileSync(path).toString()
  }

  isExisting(path: string): boolean {
    return fs.existsSync(path)
  }

  createDirectory(path: string): void {
    fs.mkdirSync(path)
  }

  countFiles(path: string): number {
    const result = fs.readdirSync(path)
    return result.length
  }
}