import * as vscode from 'vscode'
import { MemberFormatter } from './formatter'
import { MemberParser } from './member-parser'

export const TS_MISSING_PROPERTIES: DiagnosticsMatcher = {
  codes: [2739, 2740],
  source: 'ts',
}

const EMPTY_INITIALIZER = '{}'

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
    const action = new vscode.CodeAction('Implement missing members', vscode.CodeActionKind.QuickFix)
    action.isPreferred = true
    action.edit = new vscode.WorkspaceEdit()

    const members = this.memberParser.getMissingMembersForVariable(document.getText(range))
    const startLine = document.lineAt(range.start.line)

    if (range.isSingleLine && startLine.text.endsWith(EMPTY_INITIALIZER)) {
      const replacedText = startLine.text.replace(
        EMPTY_INITIALIZER,
        this.memberFormatter.format(EMPTY_INITIALIZER, members),
      )
      action.edit.replace(document.uri, startLine.range, replacedText)
    } else {
    }

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
