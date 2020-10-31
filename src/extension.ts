// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode'
import { TypescriptCodeActionProvider } from './code-action-provider'

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext): void {
  console.log('Congratulations, your extension "ts-quickfixes" is now active!')

  context.subscriptions.push(
    vscode.commands.registerTextEditorCommand('ts-quickfixes.implementAllMembers', () => {
      void vscode.window.showInformationMessage('Hello World from TS QuickFixes!')
    }),
  )

  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider('typescript', new TypescriptCodeActionProvider(), {
      providedCodeActionKinds: TypescriptCodeActionProvider.providedCodeActionKinds,
    }),
  )
}

// this method is called when your extension is deactivated
// eslint-disable-next-line @typescript-eslint/no-empty-function
export function deactivate(): void {}
