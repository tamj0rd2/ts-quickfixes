import * as vscode from 'vscode'
import { TEST_ENV_DIR } from '../paths'
import {
  getAllDocumentText,
  getLineByText,
  getVariableValue,
  readFixture,
  waitForResponse,
} from './test-helpers'

describe('Acceptance tests', () => {
  beforeAll(() => {
    void vscode.window.showInformationMessage('Starting acceptance tests')
  })

  describe('Declare missing members', () => {
    it('declares missing members for interfaces that have been extended', async () => {
      const { getCodeActions } = createTestDeps()
      const testFileUri = vscode.Uri.file(TEST_ENV_DIR + '/testing.ts')
      const testingDocument = await vscode.workspace.openTextDocument(testFileUri)
      await vscode.window.showTextDocument(testingDocument)

      const variableName = 'employee'
      const codeActions = await getCodeActions(testingDocument, `const ${variableName}`)
      expect(codeActions[0].title).toStrictEqual('Declare missing members')
      await vscode.workspace.applyEdit(codeActions[0].edit!)

      const variableValue = getVariableValue(getAllDocumentText(testingDocument), variableName)
      expect(variableValue).toStrictEqual(await readFixture(variableName))
    })

    it('declares missing members for function arguments', async () => {
      const { getCodeActions } = createTestDeps()
      const fileUri = vscode.Uri.file(TEST_ENV_DIR + `/testing.ts`)
      const document = await vscode.workspace.openTextDocument(fileUri)
      await vscode.window.showTextDocument(document)

      const argumentValue = '{ balance: 200 }'
      const codeActions = await getCodeActions(document, argumentValue)
      expect(codeActions[0].title).toStrictEqual('Declare missing members')
      await vscode.workspace.applyEdit(codeActions[0].edit!)

      const documentText = getAllDocumentText(document)
      expect(documentText).toContain(await readFixture('withdraw-money'))
    })

    it('declares missing members for const arrow function arguments', async () => {
      const { getCodeActions } = createTestDeps()
      const fileUri = vscode.Uri.file(TEST_ENV_DIR + '/testing.ts')
      const document = await vscode.workspace.openTextDocument(fileUri)
      await vscode.window.showTextDocument(document)

      const argumentValue = '{ balance: 400 }'
      const codeActions = await getCodeActions(document, argumentValue)
      expect(codeActions[0].title).toStrictEqual('Declare missing members')
      await vscode.workspace.applyEdit(codeActions[0].edit!)

      const documentText = getAllDocumentText(document)
      expect(documentText).toContain(await readFixture('arrow-function'))
    })

    it('declares missing members for nested objects', async () => {
      const { getCodeActions } = createTestDeps()
      const testFileUri = vscode.Uri.file(TEST_ENV_DIR + '/testing.ts')
      const testingDocument = await vscode.workspace.openTextDocument(testFileUri)
      await vscode.window.showTextDocument(testingDocument)

      const codeActions = await getCodeActions(testingDocument, `compensation: {}`)
      expect(codeActions[0].title).toStrictEqual('Declare missing members')
      await vscode.workspace.applyEdit(codeActions[0].edit!)

      const documentText = getAllDocumentText(testingDocument)
      expect(documentText).toContain(await readFixture('compensation'))
    })

    it('declares missing members for constructor arguments', async () => {
      const { getCodeActions } = createTestDeps()
      const testFileUri = vscode.Uri.file(TEST_ENV_DIR + '/testing.ts')
      const testingDocument = await vscode.workspace.openTextDocument(testFileUri)
      await vscode.window.showTextDocument(testingDocument)

      const codeActions = await getCodeActions(testingDocument, `{ timeout: 456 }`)
      expect(codeActions[0].title).toStrictEqual('Declare missing members')
      await vscode.workspace.applyEdit(codeActions[0].edit!)

      const documentText = getAllDocumentText(testingDocument)
      expect(documentText).toContain(await readFixture('new-http-client'))
    })
  })
})

function createTestDeps() {
  const getCodeActions = (
    document: vscode.TextDocument,
    textToSearchFor: string,
  ): Promise<vscode.CodeAction[]> => {
    const line = getLineByText(document, textToSearchFor)
    const charNumber = line.text.indexOf(textToSearchFor)

    return waitForResponse(
      async () =>
        await vscode.commands.executeCommand<vscode.CodeAction[]>(
          'vscode.executeCodeActionProvider',
          document.uri,
          new vscode.Range(
            line.range.start.translate(0, charNumber),
            line.range.start.translate(0, charNumber + textToSearchFor.length),
          ),
        ),
      (response) => !!response?.length,
      'No code actions available',
    )
  }

  return {
    getCodeActions,
  }
}
