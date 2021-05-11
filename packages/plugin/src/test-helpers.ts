// import { vol } from 'memfs'
// import * as realFs from 'fs'
// import { ufs } from 'unionfs'
// eslint-disable-next-line @typescript-eslint/no-var-requires
// const { patchFs } = require('fs-monkey')

import { resolve } from 'path'
import ts from 'typescript/lib/tsserverlibrary'
import { Logger } from './provider'
import _mockFs from 'mock-fs'

export const REPO_ROOT = resolve(__dirname, '../../..')

// class FsMockerLocal {
//   private static isInitialized = false
//   private static originalFs = { ...realFs }

//   public static init(): void {
//     if (this.isInitialized) return
//     FsMockerLocal.isInitialized = true

//     vol.mkdirSync(process.cwd(), { recursive: true })
//     vol.mkdirSync(resolve(process.cwd(), 'fixtures'), { recursive: true })

//     // eslint-disable-next-line @typescript-eslint/no-explicit-any
//     ufs.use(vol as any).use(FsMockerLocal.originalFs)
//     patchFs(ufs)
//   }

//   private static readonly files = new Map<string, string>()

//   public static get fileNames(): string[] {
//     return Array.from(this.files.keys())
//   }

//   public static addFile(content: string): [string, string] {
//     if (!this.isInitialized) throw new Error('You forgot to initialize me...')

//     const filePath = resolve(process.cwd(), 'fixtures', `sourcefile-${this.files.size}.ts`)
//     FsMockerLocal.files.set(filePath, content)
//     vol.writeFileSync(filePath, content)

//     return [filePath, content]
//   }

//   public static reset(): void {
//     this.files.clear()
//   }
// }

class FsMockerCI {
  private static nodeModulesPath = REPO_ROOT + '/node_modules'
  private static tsLibPath = FsMockerCI.nodeModulesPath + '/typescript/lib'
  private static tsLibFolder = _mockFs.load(FsMockerCI.tsLibPath)
  private static jestConsolePath = FsMockerCI.nodeModulesPath + '/@jest/console'
  private static jestConsoleFolder = _mockFs.load(FsMockerCI.jestConsolePath)

  private static readonly files = new Map<string, string>()

  public static init(): void {
    return
  }

  public static get fileNames(): string[] {
    return Array.from(this.files.keys())
  }

  public static addFile(content: string, filePath = `mySourceFile${this.files.size}.ts`): [string, string] {
    FsMockerCI.files.set(filePath, content)
    FsMockerCI.commit()
    return [filePath, content]
  }

  public static reset(): void {
    this.files.clear()
    return _mockFs.restore()
  }

  private static commit(): void {
    const filesRecord = [...FsMockerCI.files.entries()].reduce<Record<string, string>>(
      (files, [fileName, fileContent]) => ({ ...files, [fileName]: fileContent }),
      {},
    )

    _mockFs({
      [FsMockerCI.tsLibPath]: FsMockerCI.tsLibFolder,
      [FsMockerCI.jestConsolePath]: FsMockerCI.jestConsoleFolder,
      ...filesRecord,
    })
  }
}

export const FsMocker = FsMockerCI
// export const FsMocker = process.env.CI === 'true' ? FsMockerCI : FsMockerLocal

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

export function createImportStatement(importName: string, absoluteFilePath: string): string {
  return `import { ${importName} } from '${absoluteFilePath.replace('.ts', '')}'`
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
