export abstract class BaseProvider {
  constructor(
    protected readonly originalLanguageService: ts.LanguageService,
    protected readonly logger: Logger,
    protected readonly ts: typeof import('typescript/lib/tsserverlibrary'),
  ) {}

  protected getProgram(): ts.Program {
    const program = this.originalLanguageService.getProgram()
    if (program) return program

    const error = new Error('No program :(')
    this.logger.error(error)
    throw error
  }
}

export interface Logger {
  info: (message: string | Record<string, unknown>) => void
  error: (message: string | Error) => void
  logNode(node: ts.Node, prefix?: string): void
}
