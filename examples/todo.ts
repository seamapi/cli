import type { Builder, Command, Describe, Handler } from 'landlubber'

import { todo } from '@seamapi/cli'

interface Options {
  x: string
}

export const command: Command = 'todo x'

export const describe: Describe = 'TODO'

export const builder: Builder = {
  x: {
    type: 'string',
    default: 'TODO',
    describe: 'TODO',
  },
}

export const handler: Handler<Options> = async ({ x, logger }) => {
  await Promise.resolve()
  logger.info({ data: todo(x) }, 'TODO')
}
