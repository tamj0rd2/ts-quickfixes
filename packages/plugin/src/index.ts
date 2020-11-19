import { CodeFixProvider } from './code-fixes'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function init(modules: Modules): { create: CreateFn } {
  function create(info: ts.server.PluginCreateInfo): ts.LanguageService {
    const originalLanguageService = info.languageService
    const logger = {
      info: (message: string | Record<string, unknown>): void =>
        info.project.projectService.logger.info(
          `ts-quickfixes-plugin: INFO: ${typeof message === 'object' ? JSON.stringify(message) : message}`,
        ),
      error: (message: string | Error): void =>
        info.project.projectService.logger.info(
          `ts-quickfixes-plugin: ERROR: ${message instanceof Error ? message.stack : message}`,
        ),
    }
    logger.info('Hello world!')

    return {
      ...originalLanguageService,
      getCodeFixesAtPosition: new CodeFixProvider(originalLanguageService, logger).getCodeFixesAtPosition,
    }
  }

  return { create }
}

export = init

interface Modules {
  typescript: typeof import('typescript/lib/tsserverlibrary')
}

type CreateFn = (info: ts.server.PluginCreateInfo) => ts.LanguageService
