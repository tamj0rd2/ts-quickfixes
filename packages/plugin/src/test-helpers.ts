import { resolve } from 'path'
import _mockFs from 'mock-fs'
import ts from 'typescript/lib/tsserverlibrary'
import { Logger } from './providers/provider'

export const REPO_ROOT = resolve(__dirname, '../../..')

export function stripLeadingWhitespace(fileContent: string): string {
  const lineEnding = '\n'
  const lines = fileContent.split(lineEnding)

  if (fileContent.startsWith('{')) {
    const actualIndentSize = (lines[1].match(/(\s+)/) || [''])[0].length
    const wantedIndentSize = 4
    const wantedIndent = ' '.repeat(wantedIndentSize)
    return lines
      .map((line, index) => {
        if (index === 0) return line
        if (index === lines.length - 1)
          return line.replace(' '.repeat(actualIndentSize - wantedIndentSize), '')
        return line.replace(new RegExp(`^\\s{${actualIndentSize}}`), wantedIndent)
      })
      .join(lineEnding)
  }

  const firstIndexWithContent = lines.findIndex((line) => /\S/.test(line))
  if (!firstIndexWithContent) throw new Error('The given file content is empty')

  const firstLineWithContent = lines[firstIndexWithContent]
  const indentSize = (firstLineWithContent.match(/(\s+)/) || [''])[0].length
  const filteredLines = lines
    .slice(firstIndexWithContent)
    .map((line) => line.replace(new RegExp(`^\\s{${indentSize}}`), ''))

  return filteredLines.join(lineEnding)
}

export class FsMocker {
  private static nodeModulesPath = REPO_ROOT + '/node_modules'
  private static tsLibPath = FsMocker.nodeModulesPath + '/typescript/lib'
  private static tsLibFolder = _mockFs.load(FsMocker.tsLibPath)
  private static jestConsolePath = FsMocker.nodeModulesPath + '/@jest/console'
  private static jestConsoleFolder = _mockFs.load(FsMocker.jestConsolePath)

  private static readonly files = new Map<string, string>()

  public static get fileNames(): string[] {
    return Array.from(this.files.keys())
  }

  public static addFile(content: string, filePath = `mySourceFile${this.files.size}.ts`): [string, string] {
    const strippedContent = stripLeadingWhitespace(content)
    FsMocker.files.set(filePath, strippedContent)
    FsMocker.commit()
    return [filePath, strippedContent]
  }

  public static reset(): void {
    this.files.clear()
    return _mockFs.restore()
  }

  private static commit(): void {
    const filesRecord = [...FsMocker.files.entries()].reduce<Record<string, string>>(
      (files, [fileName, fileContent]) => ({ ...files, [fileName]: fileContent }),
      {},
    )

    _mockFs({
      [FsMocker.tsLibPath]: FsMocker.tsLibFolder,
      [FsMocker.jestConsolePath]: FsMocker.jestConsoleFolder,
      ...filesRecord,
    })
  }
}

export function getNodeRange(
  fileContent: string,
  search: string,
  { useFullStart = false, index = 0 }: Partial<{ useFullStart: boolean; index: number }> = {},
): { start: number; end: number } {
  const indexInsideFileContent = fileContent.split(search, index + 1).join(search).length
  const start = indexInsideFileContent + (useFullStart ? -1 : 0)
  if (start < 0) throw new Error(`Could not find ${search} in the file content`)
  return { start, end: start + search.length }
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
      disallowedErrors.map(({ file, messageText }) => ({ messageText, fileName: file?.fileName })),
    )
    throw new Error('Unexpected errors while creating the TS program')
  }

  return program
}

export function createImportStatement(importName: string, importFilePath: string): string {
  return `import { ${importName} } from './${importFilePath.replace('.ts', '')}'`
}

export function createDummyLogger(): Logger {
  return {
    error: jest.fn().mockImplementation(console.log),
    info: jest.fn().mockImplementation(console.log),
    logNode: jest
      .fn()
      .mockImplementation((node: ts.Node, prefix?: string) => console.log(prefix, node.getText())),
  }
}
