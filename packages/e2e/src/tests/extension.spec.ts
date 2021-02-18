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
    const happyPathCases = [['declares missing members for interfaces that have been extended', 'employee']]

    it.each(happyPathCases)('%s', async (_, variableName) => {
      const { getCodeActions } = createTestDeps()
      const testFileUri = vscode.Uri.file(TEST_ENV_DIR + '/testing.ts')
      const testingDocument = await vscode.workspace.openTextDocument(testFileUri)
      await vscode.window.showTextDocument(testingDocument)

      const codeActions = await getCodeActions(testingDocument, `const ${variableName}`)
      expect(codeActions[0].title).toStrictEqual('Declare missing members')
      await vscode.workspace.applyEdit(codeActions[0].edit!)

      const variableValue = getVariableValue(getAllDocumentText(testingDocument), variableName)
      expect(variableValue).toStrictEqual(await readFixture(variableName))
    })
  })

  describe('Declare missing argument members', () => {
    it('declares missing members for function arguments', async () => {
      const { getCodeActions } = createTestDeps()
      const fileUri = vscode.Uri.file(TEST_ENV_DIR + '/testing.ts')
      const document = await vscode.workspace.openTextDocument(fileUri)
      await vscode.window.showTextDocument(document)

      const argumentValue = '{ balance: 200 }'
      const codeActions = await getCodeActions(document, argumentValue)
      expect(codeActions[0].title).toStrictEqual('Declare missing argument members')
      await vscode.workspace.applyEdit(codeActions[0].edit!)

      const documentText = getAllDocumentText(document)
      expect(documentText).toContain(
        `export const newBalance = withdrawMoney({ balance: 200, accountNumber: 'todo', sortCode: 'todo' }, 123)`,
      )
    })

    it('declares missing members for const arrow function arguments', async () => {
      const { getCodeActions } = createTestDeps()
      const fileUri = vscode.Uri.file(TEST_ENV_DIR + '/testing.ts')
      const document = await vscode.workspace.openTextDocument(fileUri)
      await vscode.window.showTextDocument(document)

      const argumentValue = '{ balance: 400 }'
      const codeActions = await getCodeActions(document, argumentValue)
      expect(codeActions[0].title).toStrictEqual('Declare missing argument members')
      await vscode.workspace.applyEdit(codeActions[0].edit!)

      const documentText = getAllDocumentText(document)
      expect(documentText).toContain(
        `sendMoney({ balance: 400, accountNumber: 'todo', sortCode: 'todo' }, 200)`,
      )
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
