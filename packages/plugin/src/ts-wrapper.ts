import { dirname } from 'path'
import ts from 'typescript'

export default class TsWrapper {
  private readonly compilationErrorMessage =
    'Your typescript project has compilation errors. Run tsc to debug.'

  public createProgram(tsconfigPath: string): ts.Program {
    const config = this.readTsConfig(tsconfigPath)
    return this.buildProgramFromParsedCommandLine(config)
  }

  public formatErrorDiagnostic = (diagnostic: ts.Diagnostic): string => {
    return `Error ${diagnostic.code}: ${ts.flattenDiagnosticMessageText(
      diagnostic.messageText,
      ts.sys.newLine,
    )}`
  }

  public readTsConfig(tsconfigPath: string): ts.ParsedCommandLine {
    const rawTsConfigFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile)
    if (rawTsConfigFile.error) throw new Error(this.formatErrorDiagnostic(rawTsConfigFile.error))
    if (!rawTsConfigFile.config) throw new Error(`Could not parse your tsconfig file ${tsconfigPath}`)

    const configFile = ts.parseJsonConfigFileContent(
      rawTsConfigFile.config,
      ts.sys,
      dirname(tsconfigPath),
      {},
      tsconfigPath,
    )
    if (configFile.errors.length) {
      throw new Error(configFile.errors.map(this.formatErrorDiagnostic).join('\n'))
    }

    const shouldEmit = !!configFile.options.incremental || !!configFile.options.composite
    const fallbackTsbuild = configFile.options.outDir && `${configFile.options.outDir}/tsconfig.tsbuildinfo`

    configFile.options.incremental = shouldEmit
    configFile.options.tsBuildInfoFile = configFile.options.tsBuildInfoFile || fallbackTsbuild
    configFile.options.noEmit = true
    return configFile
  }

  public buildProgramFromParsedCommandLine(config: ts.ParsedCommandLine): ts.Program {
    const programArgs = {
      options: config.options,
      rootNames: config.fileNames,
      projectReferences: config.projectReferences,
      configFileParsingDiagnostics: ts.getConfigFileParsingDiagnostics(config),
    }

    try {
      const program = config.options.incremental
        ? ts.createIncrementalProgram(programArgs).getProgram()
        : ts.createProgram(programArgs)
      return program
    } catch (err) {
      console.error(err.message)
      throw new Error(this.compilationErrorMessage)
    }
  }

  public buildProgram(config: ts.CompilerOptions, rootFiles: string[]): ts.Program {
    return this.buildProgramFromParsedCommandLine({
      errors: [],
      fileNames: rootFiles,
      options: config,
    })
  }
}
