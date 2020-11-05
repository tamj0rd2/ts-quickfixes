import * as vscode from 'vscode'
import { LineEnding, MemberFormatter } from './formatter'
import { MemberParser } from './member-parser'

export const TS_MISSING_PROPERTIES: DiagnosticsMatcher = {
  codes: [2739, 2740],
  source: 'ts',
}

export class TypescriptCodeActionProvider implements vscode.CodeActionProvider {
  public constructor(
    private readonly memberParser: MemberParser,
    private readonly memberFormatter: MemberFormatter,
  ) {}

  public provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext,
  ): vscode.ProviderResult<(vscode.CodeAction | vscode.Command)[]> {
    return context.diagnostics.reduce<vscode.CodeAction[]>((actions, diagnostic) => {
      if (this.diagnosticsMatch(diagnostic, TS_MISSING_PROPERTIES)) {
        actions.push(this.createImplementAllMembersAction(document, diagnostic.range))
      }

      return actions
    }, [])
  }

  public static readonly providedCodeActionKinds = [vscode.CodeActionKind.QuickFix]

  private createImplementAllMembersAction(
    document: vscode.TextDocument,
    range: vscode.Range,
  ): vscode.CodeAction {
    const variableName = document.getText(range)
    const { lines, start, end } = this.memberParser.getVariableInfo(variableName)
    const rangeToReplace = new vscode.Range(
      new vscode.Position(start.line, start.character),
      new vscode.Position(end.line, end.character),
    )
    const members = this.memberParser.getMissingMembersForVariable(variableName)
    const replacedVariable = this.memberFormatter.format(lines, members, LineEnding.LF)

    const action = new vscode.CodeAction('Implement missing members', vscode.CodeActionKind.QuickFix)
    action.isPreferred = true
    action.edit = new vscode.WorkspaceEdit()
    action.edit.replace(document.uri, rangeToReplace, replacedVariable)
    return action
  }

  private diagnosticsMatch(diagnostic: vscode.Diagnostic, matcher: DiagnosticsMatcher): boolean {
    if (typeof diagnostic.code === 'number') {
      return matcher.codes.includes(diagnostic.code) && diagnostic.source === matcher.source
    }

    return false
  }
}

interface DiagnosticsMatcher {
  codes: number[]
  source: string
}
