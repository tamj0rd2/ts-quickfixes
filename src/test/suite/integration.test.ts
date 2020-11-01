/* eslint-disable @typescript-eslint/no-unused-vars */
import assert from 'assert'
import { resolve } from 'path'
import * as vscode from 'vscode'
import { MemberType } from '../../member-parser'
import { getAllDocumentText, getLineByText, waitUntil } from './test-helpers'

suite('Acceptance tests', () => {
  const testEnvironmentFolder = resolve(process.cwd(), 'test-environment')
  void vscode.window.showInformationMessage('Starting acceptance tests')

  suite('Implement all memebers', () => {
    test('the command can be executed', async () => {
      const testingTsUri = vscode.Uri.file(testEnvironmentFolder + '/testing.ts')
      const document = await vscode.workspace.openTextDocument(testingTsUri)
      const textEditor = await vscode.window.showTextDocument(document)
      await waitUntil(() => vscode.languages.getDiagnostics().length > 0)

      const aPersonLine = getLineByText(document, 'const aPerson')
      const lineNumber = aPersonLine.range.start.line
      const charNumber = aPersonLine.text.indexOf('aPerson')
      textEditor.selection = new vscode.Selection(lineNumber, charNumber, lineNumber, charNumber)

      const codeActions = await vscode.commands.executeCommand<vscode.CodeAction[]>(
        'vscode.executeCodeActionProvider',
        document.uri,
        new vscode.Range(
          aPersonLine.range.start.translate(0, charNumber),
          aPersonLine.range.start.translate(0, charNumber + 'aPerson'.length),
        ),
      )
      if (!codeActions) throw new Error('Expected to get some code actions back')
      assert.strictEqual<string>(codeActions[0].title, 'Implement missing members')

      await vscode.workspace.applyEdit(codeActions[0].edit!)

      const personLines = getAllDocumentText()
        .trim()
        .split('\n')
        .reduce<string[]>((lines, line) => {
          if (lines.length === 0 && !line.includes('const aPerson')) return lines
          return [...lines, line]
        }, [])

      assert.strictEqual<string>(
        personLines.join('\n'),
        [
          'export const aPerson: Person = {',
          `  "firstName": "todo",`,
          `  "lastName": "todo",`,
          `  "birthday": null,`,
          `  "address": {`,
          `    "city": "todo",`,
          `    "postcode": "todo"`,
          `  },`,
          `  "mobileNumber": {`,
          `    "countryCode": "todo",`,
          `    "phoneNumber": 0`,
          `  },`,
          `  "status": null`,
          `}`,
        ].join('\n'),
      )
    })
  })
})
