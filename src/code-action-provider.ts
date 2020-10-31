/* eslint-disable @typescript-eslint/no-unused-vars */
import * as vscode from 'vscode'

const TS_MISSING_PROPERTIES = {
  code: 2739,
  source: 'ts',
} as const

export class TypescriptCodeActionProvider implements vscode.CodeActionProvider {
  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext,
    token: vscode.CancellationToken,
  ): vscode.ProviderResult<(vscode.CodeAction | vscode.Command)[]> {
    return context.diagnostics.reduce<vscode.CodeAction[]>((actions, diagnostic) => {
      console.dir({ diagnostic })
      if (this.diagnosticsMatch(diagnostic, TS_MISSING_PROPERTIES)) {
        actions.push(this.createImplementAllMembersAction(document, range))
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
    action.command = {
      command: 'ts-quickfixes.implementAllMembers',
      title: 'Implement missing members',
      tooltip: 'This will implement missing members',
    }
    action.isPreferred = true

    return action
  }

  private diagnosticsMatch(
    diagnostic: vscode.Diagnostic,
    matcher: Pick<vscode.Diagnostic, 'code' | 'source'>,
  ): boolean {
    return diagnostic.code === matcher.code && diagnostic.source === matcher.source
  }
}
