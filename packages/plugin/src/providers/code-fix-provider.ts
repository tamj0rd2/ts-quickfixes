import { MissingArgumentMembersFix } from '../code-fixes/missing-argument-members-fix'
import { MissingVariableMembersFix } from '../code-fixes/missing-variable-members-fix'
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
    const customActions: ts.CodeFixAction[] = []

    const tryAddFixAction = (fixFactory: () => ts.CodeFixAction): void => {
      try {
        customActions.push(fixFactory())
      } catch (err) {
        this.logger.error(err)
      }
    }

    if (errorCodes.some(MissingVariableMembersFix.supportsErrorCode)) {
      tryAddFixAction(
        () =>
          new MissingVariableMembersFix({
            ts: this.ts,
            start,
            end,
            filePath: fileName,
            program: this.getProgram(),
            logger: this.logger,
          }),
      )
    }

    if (errorCodes.some(MissingArgumentMembersFix.supportsErrorCode)) {
      tryAddFixAction(
        () =>
          new MissingArgumentMembersFix({
            ts: this.ts,
            start,
            end,
            filePath: fileName,
            program: this.getProgram(),
            logger: this.logger,
          }),
      )
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
