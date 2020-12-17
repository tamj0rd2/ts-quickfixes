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

  describe('Implement missing members', () => {
    const happyPathCases = [
      ['implements all object members when all of them were missing', 'aPerson'],
      ['only implements missing members if some members are already defined', 'personWithOneProperty'],
      ['implements missing members for objects that have been defined on a single line', 'singleLinePerson'],
      ['implements missing members for interfaces that have been extended', 'employee'],
      ['implements missing members for interfaces that have been extended from other files', 'dog'],
    ]

    it.each(happyPathCases)('%s', async (_, variableName) => {
      const { testFileUri, getCodeActionsForVariable } = createTestDeps()
      const testingDocument = await vscode.workspace.openTextDocument(testFileUri)
      await vscode.window.showTextDocument(testingDocument)

      const codeActions = await getCodeActionsForVariable(testingDocument, variableName)
      expect(codeActions[0].title).toStrictEqual('Implement missing members')
      await vscode.workspace.applyEdit(codeActions[0].edit!)

      const variableValue = getVariableValue(getAllDocumentText(testingDocument), variableName)
      expect(variableValue).toStrictEqual(await readFixture(variableName))
    })
  })
})

function createTestDeps() {
  const getCodeActionsForVariable = (
    document: vscode.TextDocument,
    variableName: string,
  ): Promise<vscode.CodeAction[]> => {
    const variableLine = getLineByText(document, `const ${variableName}`)
    const charNumber = variableLine.text.indexOf(variableName)

    return waitForResponse(
      async () =>
        await vscode.commands.executeCommand<vscode.CodeAction[]>(
          'vscode.executeCodeActionProvider',
          document.uri,
          new vscode.Range(
            variableLine.range.start.translate(0, charNumber),
            variableLine.range.start.translate(0, charNumber + variableName.length),
          ),
        ),
      (response) => !!response?.length,
    )
  }

  return {
    testFileUri: vscode.Uri.file(TEST_ENV_DIR + '/testing.ts'),
    getCodeActionsForVariable,
  }
}
