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
    const TS_FOLDER = TEST_ENV_DIR + '/declare-missing-members'
    const ACTION_NAME = 'Declare missing members'

    it('declares missing members for interfaces that have been extended', async () => {
      const { getCodeAction } = createTestDeps()
      const testFileUri = vscode.Uri.file(TS_FOLDER + '/variable-members.ts')
      const testingDocument = await vscode.workspace.openTextDocument(testFileUri)
      await vscode.window.showTextDocument(testingDocument)

      const variableName = 'employee'
      const codeAction = await getCodeAction(testingDocument, `const ${variableName}`, ACTION_NAME)
      await vscode.workspace.applyEdit(codeAction.edit!)

      const variableValue = getVariableValue(getAllDocumentText(testingDocument), variableName)
      expect(variableValue).toStrictEqual(await readFixture(variableName))
    })

    it('declares missing members for function arguments', async () => {
      const { getCodeAction } = createTestDeps()
      const fileUri = vscode.Uri.file(TS_FOLDER + `/argument-members.ts`)
      const document = await vscode.workspace.openTextDocument(fileUri)
      await vscode.window.showTextDocument(document)

      const argumentValue = '{ balance: 200 }'
      const codeAction = await getCodeAction(document, argumentValue, ACTION_NAME)
      await vscode.workspace.applyEdit(codeAction.edit!)

      const documentText = getAllDocumentText(document)
      expect(documentText).toContain(await readFixture('withdraw-money'))
    })

    it('declares missing members for const arrow function arguments', async () => {
      const { getCodeAction } = createTestDeps()
      const fileUri = vscode.Uri.file(TS_FOLDER + '/argument-members.ts')
      const document = await vscode.workspace.openTextDocument(fileUri)
      await vscode.window.showTextDocument(document)

      const argumentValue = '{ balance: 400 }'
      const codeAction = await getCodeAction(document, argumentValue, ACTION_NAME)
      await vscode.workspace.applyEdit(codeAction.edit!)

      const documentText = getAllDocumentText(document)
      expect(documentText).toContain(await readFixture('arrow-function'))
    })

    it('declares missing members for nested objects', async () => {
      const { getCodeAction } = createTestDeps()
      const testFileUri = vscode.Uri.file(TS_FOLDER + '/nesting.ts')
      const testingDocument = await vscode.workspace.openTextDocument(testFileUri)
      await vscode.window.showTextDocument(testingDocument)

      const codeAction = await getCodeAction(testingDocument, `compensation: {}`, ACTION_NAME)
      await vscode.workspace.applyEdit(codeAction.edit!)

      const documentText = getAllDocumentText(testingDocument)
      expect(documentText).toContain(await readFixture('compensation'))
    })

    it('declares missing members for constructor arguments using locals if available', async () => {
      const { getCodeAction } = createTestDeps()
      const testFileUri = vscode.Uri.file(TS_FOLDER + '/constructor-argument-members.ts')
      const testingDocument = await vscode.workspace.openTextDocument(testFileUri)
      await vscode.window.showTextDocument(testingDocument)

      const codeAction = await getCodeAction(testingDocument, `{ timeout: 456 }`, ACTION_NAME)
      await vscode.workspace.applyEdit(codeAction.edit!)

      const documentText = getAllDocumentText(testingDocument)
      expect(documentText).toContain(await readFixture('new-http-client'))
    })
  })
})

function createTestDeps() {
  const getCodeAction = (
    document: vscode.TextDocument,
    textToSearchFor: string,
    codeActionName: string,
  ): Promise<vscode.CodeAction> => {
    const line = getLineByText(document, textToSearchFor)
    const charNumber = line.text.indexOf(textToSearchFor)

    return waitForResponse(
      async () => {
        const actions = await vscode.commands.executeCommand<vscode.CodeAction[]>(
          'vscode.executeCodeActionProvider',
          document.uri,
          new vscode.Range(
            line.range.start.translate(0, charNumber),
            line.range.start.translate(0, charNumber + textToSearchFor.length),
          ),
        )
        return actions?.find((x) => x.title === codeActionName)
      },
      (response) => !!response,
      'No code actions available',
    )
  }

  return {
    getCodeAction,
  }
}
