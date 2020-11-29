import { LineEnding, MemberFormatter } from '../formatter'
import { MemberParser } from '../member-parser'
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
    const codeFixArgs: CodeFixArgs = { fileName, start, end, errorCodes, formatOptions, preferences }
    const customActions: ts.CodeFixAction[] = []

    if (errorCodes.some((code) => ERROR_CODES.implementMissingMembers.includes(code))) {
      customActions.push(this.createImplementMissingMembersFix(codeFixArgs))
    } else {
      this.logger.info('no fixable error codes')
    }

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

  private createImplementMissingMembersFix({ start, end, fileName }: CodeFixArgs): ts.CodeFixAction {
    const program = this.getProgram()
    const memberParser = new MemberParser(program)
    const variableName = memberParser.getVariableNameAtLocation(start, end, fileName)
    const members = memberParser.getMissingMembersForVariable(variableName, fileName)
    const variableInfo = memberParser.getVariableInfo(variableName, fileName)
    const replacedVariable = new MemberFormatter().format(variableInfo.lines, members, LineEnding.LF)

    return {
      fixName: 'implementMissingMembers',
      description: 'Implement missing members',
      changes: [
        {
          fileName,
          textChanges: [
            {
              newText: replacedVariable,
              span: {
                start: variableInfo.start.pos + 1,
                length: variableInfo.end.pos - variableInfo.start.pos - 1,
              },
            },
          ],
        },
      ],
    }
  }
}

const ERROR_CODES = {
  implementMissingMembers: [2739, 2740, 2741],
}

interface CodeFixArgs {
  fileName: string
  start: number
  end: number
  errorCodes: readonly number[]
  formatOptions: ts.FormatCodeSettings
  preferences: ts.UserPreferences
}
