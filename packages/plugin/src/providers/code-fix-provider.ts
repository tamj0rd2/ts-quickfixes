import { DeclareMissingObjectMembers } from '../declare-missing-object-members'
import { BaseProvider } from './provider'

export class CodeFixProvider extends BaseProvider {
  public getCodeFixesAtPosition = (
    fileName: string,
    start: number,
    end: number,
    errorCodes: readonly number[],
    formatOptions: ts.FormatCodeSettings,
    preferences: ts.UserPreferences,
  ): readonly ts.CodeFixAction[] => {
    this.logger.info('Trying to get code fix actions')
    this.logger.info({ start, end, fileName, errorCodes })
    const program = this.getProgram()
    const args = {
      ts: this.ts,
      start,
      end,
      filePath: fileName,
      program: program,
      logger: this.logger,
      typeChecker: program.getTypeChecker(),
    }

    const customActions: ts.CodeFixAction[] = []

    const tryAddFixAction = (
      fixFactory: (args: DeclareMissingObjectMembers.Args) => ts.CodeFixAction,
    ): void => {
      try {
        const action = fixFactory(args)
        customActions.push(action)
        this.logger.info(`Fix ${action.fixName} will be available for selection`)
      } catch (err) {
        this.logger.error(err)
      }
    }

    if (errorCodes.some(DeclareMissingObjectMembers.supportsErrorCode)) {
      tryAddFixAction(DeclareMissingObjectMembers.createFix)
    }

    this.logger.info('Done trying to get code fix actions')

    return [
      ...this.originalLanguageService.getCodeFixesAtPosition(
        fileName,
        start,
        end,
        errorCodes,
        formatOptions,
        preferences,
      ),
      ...customActions,
    ]
  }
}
