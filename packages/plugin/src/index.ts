import { CodeFixProvider } from './providers'
import { Logger } from './providers/provider'

function init(modules: Modules): { create: CreateFn } {
  function create(info: ts.server.PluginCreateInfo): ts.LanguageService {
    const originalLanguageService = info.languageService
    const ts = modules.typescript
    const log = (prefix: string, message: string | Record<string, unknown>): void =>
      info.project.projectService.logger.info(
        `ts-quickfixes-plugin: ${prefix}: ${
          typeof message === 'object'
            ? JSON.stringify(message, (_, value) => (value === undefined ? null : value))
            : message
        }`,
      )
    const logger: Logger = {
      info: (message) => log('INFO', message),
      error: (message: string | Error): void =>
        log(
          'ERROR',
          message instanceof Error ? (message.stack ?? message.message).replace('\n', '. ') : message,
        ),
      logNode: (node, note = '') => {
        const prefix = `${note} - ${ts.SyntaxKind[node.kind]}`
        const lines = node.getText().split('\n')
        if (lines.length === 1) {
          log('NODE_LIN', `${prefix} - ${lines[0]}`)
          return
        }

        log('NODE_BEG\t', prefix)
        lines.forEach((line) => log('NODE\t', line))
        log('NODE_END\t', '')
      },
    }
    logger.info('Hello world!')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const logOnError = <F extends (...args: any[]) => any>(func: F) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (...args: any[]): ReturnType<F> => {
        try {
          return func(...args)
        } catch (err) {
          logger.error(err)
          throw err
        }
      }
    }

    return {
      ...originalLanguageService,
      getCodeFixesAtPosition: logOnError(
        new CodeFixProvider(originalLanguageService, logger, ts).getCodeFixesAtPosition,
      ),
    }
  }

  return { create }
}

export = init

interface Modules {
  typescript: typeof import('typescript/lib/tsserverlibrary')
}

type CreateFn = (info: ts.server.PluginCreateInfo) => ts.LanguageService
