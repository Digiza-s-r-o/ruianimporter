import 'dotenv/config'
import cliProgress from 'cli-progress'
import * as fs from 'fs/promises';
import saxes from 'saxes'

(async () => {
  const workdir = process.env.WORK_DIR
  if (!workdir) {
    throw new Error('WORK_DIR environment variable is not specified inside .env file!')
  }

  await fs.mkdir(workdir, {recursive:true}).catch((err) => {
    //decide what you want to do if this failed
    console.error(err);
  });
})()