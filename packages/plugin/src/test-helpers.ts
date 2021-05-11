import { resolve } from 'path'
import _mockFs from 'mock-fs'
import type { DirectoryItem } from 'mock-fs/lib/filesystem'
import ts from 'typescript/lib/tsserverlibrary'
import { Logger } from './provider'

export const REPO_ROOT = resolve(__dirname, '../../..')

export class FsMockerCI {
  private readonly files = new Map<string, string>()
  private readonly tsLibPath: string
  private readonly tsLibFolder: DirectoryItem
  private readonly jestConsolePath: string
  private readonly jestConsoleFolder: DirectoryItem

  private static _instance: FsMockerCI | undefined

  public static get instance(): FsMockerCI {
    if (!this._instance) this._instance = new FsMockerCI()
    return this._instance
  }

  private constructor() {
    const nodeModulesPath = REPO_ROOT + '/node_modules'
    this.tsLibPath = nodeModulesPath + '/typescript/lib'
    this.tsLibFolder = _mockFs.load(this.tsLibPath)
    this.jestConsolePath = nodeModulesPath + '/@jest/console'
    this.jestConsoleFolder = _mockFs.load(this.jestConsolePath)
  }

  public get fileNames(): string[] {
    return Array.from(this.files.keys())
  }

  public addFile(content: string, filePath = `mySourceFile${this.files.size}.ts`): [string, string] {
    this.files.set(filePath, content)
    this.commit()
    return [filePath, content]
  }

  public reset(): void {
    this.files.clear()
    return _mockFs.restore()
  }

  private commit(): void {
    const filesRecord = [...this.files.entries()].reduce<Record<string, string>>(
      (files, [fileName, fileContent]) => ({ ...files, [fileName]: fileContent }),
      {},
    )

    _mockFs({
      [this.tsLibPath]: this.tsLibFolder,
      [this.jestConsolePath]: this.jestConsoleFolder,
      ...filesRecord,
    })
  }
}

export const FsMocker = FsMockerCI

export function getNodeRange(
  fileContent: string,
  search: string,
  { useFullStart = false, index = 0 }: Partial<{ useFullStart: boolean; index: number }> = {},
): { start: number; end: number; text: string } {
  const indexInsideFileContent = fileContent.split(search, index + 1).join(search).length
  if (indexInsideFileContent < 0) throw new Error(`Could not find ${search} in the file content`)

  const start = indexInsideFileContent + (useFullStart ? -1 : 0)
  if (start < 0) throw new Error(`Could not find ${search} in the file content`)
  const end = start + search.length
  return { start, end, text: fileContent.substring(start, end) }
}

export function createTestProgram(fileNames: string[], allowedErrorCodes: number[] = []): ts.Program {
  const program = ts.createProgram(fileNames, {
    noEmit: true,
    module: ts.ModuleKind.CommonJS,
    baseUrl: REPO_ROOT,
  })

  /** ===================================================================================/
   * uncomment to enable diagnostics for the created typescript program.
   * of course, if the typescript compilation has errors (other than the one we expect),
   * parsing the AST will probably give very strange results/errors.
   * ===================================================================================*/
  const diagnostics = ts.getPreEmitDiagnostics(program)
  const disallowedErrors = diagnostics.filter(({ code }) => !allowedErrorCodes.includes(code))

  if (disallowedErrors.length > 0) {
    debugger
    console.error(
      disallowedErrors.map(({ file, messageText, code }) => ({
        code,
        messageText,
        fileName: file?.fileName,
      })),
    )
    throw new Error('Unexpected errors while creating the TS program')
  }

  return program
}

export function createImportStatement(importName: string, importFilePath: string): string {
  return `import { ${importName} } from './${importFilePath.replace('.ts', '')}'`
}

export function createDummyLogger(enableLogging = false): Logger {
  const dummyLogger = {
    error: jest.fn(),
    info: jest.fn(),
    logNode: jest.fn(),
  }

  if (enableLogging) {
    dummyLogger.info.mockImplementation(console.log)
    dummyLogger.error.mockImplementation(console.log)
    dummyLogger.logNode.mockImplementation((node: ts.Node, prefix?: string) =>
      console.dir({
        kind: ts.SyntaxKind[node.kind],
        prefix,
        text: node.getText().substring(0, 100),
      }),
    )
  }

  return dummyLogger
}

export function TODO(suffix = ''): never {
  throw new Error(`not yet implemented ${suffix}`)
}
