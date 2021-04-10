import { fs as memfs, vol } from 'memfs'
import * as fs from 'fs'
import { ufs } from 'unionfs'
import { resolve } from 'path'
import ts from 'typescript/lib/tsserverlibrary'
import { Logger } from './provider'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { patchFs } = require('fs-monkey')

export const REPO_ROOT = resolve(__dirname, '../../..')

export class FsMocker {
  private static isInitialized = false
  private static originalFs = { ...fs }

  public static init(): void {
    FsMocker.isInitialized = true
    vol.mkdirSync(process.cwd(), { recursive: true })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ufs.use(vol as any).use(FsMocker.originalFs)
    patchFs(ufs)
  }

  private static readonly files = new Map<string, string>()

  public static get fileNames(): string[] {
    return Array.from(this.files.keys())
  }

  public static addFile(content: string): [string, string] {
    if (!this.isInitialized) throw new Error('You forgot to initialize me...')

    const filePath = `sourcefile-${this.files.size}.ts`
    FsMocker.files.set(filePath, content)
    memfs.writeFileSync(filePath, content)
    return [filePath, content]
  }

  public static reset(): void {
    this.files.clear()
  }
}

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

export function createImportStatement(importName: string, relativeFilePath: string): string {
  return `import { ${importName} } from './${relativeFilePath.replace('.ts', '')}'`
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
