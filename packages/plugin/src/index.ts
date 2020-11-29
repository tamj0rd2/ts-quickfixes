import { CodeFixProvider } from './providers'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function init(modules: Modules): { create: CreateFn } {
  function create(info: ts.server.PluginCreateInfo): ts.LanguageService {
    const originalLanguageService = info.languageService
    const logger = {
      info: (message: string | Record<string, unknown>): void =>
        info.project.projectService.logger.info(
          `ts-quickfixes-plugin: INFO: ${
            typeof message === 'object'
              ? JSON.stringify(message, (_, value) => (value === undefined ? null : value))
              : message
          }`,
        ),
      error: (message: string | Error): void =>
        info.project.projectService.logger.info(
          `ts-quickfixes-plugin: ERROR: ${
            message instanceof Error ? message.stack?.replace('\n', '. ') : message
          }`,
        ),
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
        new CodeFixProvider(originalLanguageService, logger).getCodeFixesAtPosition,
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
