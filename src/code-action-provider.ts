import * as vscode from 'vscode'

export class TypescriptCodeActionProvider implements vscode.CodeActionProvider {
  public static readonly providedCodeActionKinds = [vscode.CodeActionKind.QuickFix]

  public provideCodeActions(): vscode.ProviderResult<(vscode.CodeAction | vscode.Command)[]> {
    return [this.createImplementAllMembersAction()]
  }

  private createImplementAllMembersAction(): vscode.CodeAction {
    const action = new vscode.CodeAction('Implement missing members', vscode.CodeActionKind.QuickFix)
    action.command = {
      command: 'ts-quickfixes.implementAllMembers',
      title: 'Implement missing members',
      tooltip: 'This will implement missing members',
    }
    action.isPreferred = true
    return action
  }
}
