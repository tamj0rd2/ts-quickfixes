import { resolve } from 'path'
import * as vscode from 'vscode'

suite('Acceptance tests', () => {
  const testEnvironmentFolder = resolve(process.cwd(), 'test-environment')
  void vscode.window.showInformationMessage('Starting acceptance tests')

  suite('Implement all memebers', () => {
    test('the command can be executed', async () => {
      const testingTsUri = vscode.Uri.file(testEnvironmentFolder + '/testing.ts')
      const testingDocument = await vscode.workspace.openTextDocument(testingTsUri)
      await vscode.window.showTextDocument(testingDocument)
      await sleep(1)

      await vscode.commands.executeCommand('ts-quickfixes.implementAllMembers')
      await sleep(1)
    })
  })
})

function sleep(seconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, seconds * 1000)
  })
}
