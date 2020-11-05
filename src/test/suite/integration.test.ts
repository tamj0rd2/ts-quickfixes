import assert from 'assert'
import * as vscode from 'vscode'
import { TS_MISSING_PROPERTIES } from '../../code-action-provider'
import { TEST_ENV_FOLDER } from '../test_constants'
import { getAllDocumentText, getLineByText, getVariableValue, readFixture, waitUntil } from './test-helpers'

suite('Acceptance tests', () => {
  void vscode.window.showInformationMessage('Starting acceptance tests')
  const waitForTsDiagnostics = () =>
    waitUntil(() =>
      vscode.languages
        .getDiagnostics()
        .some(([, diagnostics]) =>
          diagnostics.some((diagnostic) => diagnostic.source === TS_MISSING_PROPERTIES.source),
        ),
    )

  suite('Implement all memebers', () => {
    test('it implements members when all of them were missing', async () => {
      const testingTsUri = vscode.Uri.file(TEST_ENV_FOLDER + '/testing.ts')
      const document = await vscode.workspace.openTextDocument(testingTsUri)
      const textEditor = await vscode.window.showTextDocument(document)
      await waitForTsDiagnostics()

      const variableName = 'aPerson'
      const variableLine = getLineByText(document, `const ${variableName}`)
      const lineNumber = variableLine.range.start.line
      const charNumber = variableLine.text.indexOf(variableName)
      textEditor.selection = new vscode.Selection(lineNumber, charNumber, lineNumber, charNumber)

      const codeActions = await vscode.commands.executeCommand<vscode.CodeAction[]>(
        'vscode.executeCodeActionProvider',
        document.uri,
        new vscode.Range(
          variableLine.range.start.translate(0, charNumber),
          variableLine.range.start.translate(0, charNumber + variableName.length),
        ),
      )
      if (!codeActions?.length) throw new Error('Expected to get some code actions back')
      assert.strictEqual<string>(codeActions[0].title, 'Implement missing members')

      await vscode.workspace.applyEdit(codeActions[0].edit!)

      const variableValue = getVariableValue(getAllDocumentText(), variableName)

      assert.deepStrictEqual(variableValue, await readFixture('testing-aPerson'))
    })

    // TODO: come back and fix this
    test.skip('it implements members when they are only partially missing', async () => {
      const testingTsUri = vscode.Uri.file(TEST_ENV_FOLDER + '/testing.ts')
      const document = await vscode.workspace.openTextDocument(testingTsUri)
      const textEditor = await vscode.window.showTextDocument(document)
      await waitForTsDiagnostics()

      const variableName = 'personWithOneProperty'
      const variableLine = getLineByText(document, `const ${variableName}`)
      const lineNumber = variableLine.range.start.line
      const charNumber = variableLine.text.indexOf(variableName)
      textEditor.selection = new vscode.Selection(lineNumber, charNumber, lineNumber, charNumber)

      const codeActions = await vscode.commands.executeCommand<vscode.CodeAction[]>(
        'vscode.executeCodeActionProvider',
        document.uri,
        new vscode.Range(
          variableLine.range.start.translate(0, charNumber),
          variableLine.range.start.translate(0, charNumber + variableName.length),
        ),
      )
      if (!codeActions?.length) throw new Error('Expected to get some code actions back')
      assert.strictEqual<string>(codeActions[0].title, 'Implement missing members')

      await vscode.workspace.applyEdit(codeActions[0].edit!)

      const variableValue = getVariableValue(getAllDocumentText(), variableName)
      assert.deepStrictEqual(
        variableValue,
        [
          '{',
          `  lastName: 'my last name',`,
          // TODO: implement the quickfix replacement
          // `  "firstName": "todo",`,
          // `  "birthday": null,`,
          // `  "address": {`,
          // `    "city": "todo",`,
          // `    "postcode": "todo"`,
          // `  },`,
          // `  "mobileNumber": {`,
          // `    "countryCode": "todo",`,
          // `    "phoneNumber": 0`,
          // `  },`,
          // `  "status": null`,
          `}`,
        ].join('\n'),
      )
    })
  })
})
