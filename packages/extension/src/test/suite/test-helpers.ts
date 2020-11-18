import { readFile } from 'fs'
import * as vscode from 'vscode'
import { PACKAGE_ROOT_DIR } from '../test_constants'

export function getAllDocumentText(document?: vscode.TextDocument): string {
  if (!document) document = vscode.window.activeTextEditor?.document
  if (!document) throw new Error('No document found')

  const fullDocumentRange = new vscode.Range(
    document.lineAt(0).range.start,
    document.lineAt(document.lineCount - 1).range.end,
  )
  return document.getText(fullDocumentRange)
}

export function getLineByText(document: vscode.TextDocument, target: string): vscode.TextLine {
  const eol = document.eol === vscode.EndOfLine.LF ? '\n' : '\r\n'
  const allText = getAllDocumentText(document).split(eol)
  const lineNumber = allText.findIndex((line) => line.includes(target))
  if (lineNumber === -1) throw new Error(`Target text "${target}" was not in the document`)
  return document.lineAt(lineNumber)
}

export async function waitUntil(predicate: () => boolean | Promise<boolean>, timeout = 15): Promise<void> {
  for (let attempt = 0; attempt < timeout; attempt++) {
    if (await predicate()) return
    await sleep(1)
  }
  throw new Error('waitUntil timeout exceeded')
}

export function getVariableValue(textToSearch: string, variableName: string): string {
  const lines = textToSearch.split('\n')
  const startLineIndex = lines.findIndex((line) => line.includes(`const ${variableName}`))
  if (startLineIndex === -1) throw new Error(`Could not find variable ${variableName}`)

  const stuff = lines.slice(startLineIndex).reduce<{ curlyCount: number; declaration: string[] }>(
    ({ curlyCount, declaration }, line, index) => {
      if (curlyCount === 0 && declaration.length !== 0) return { curlyCount, declaration }

      const openCountOnLine = (line.match(/\{/g) ?? []).length
      const closedCountOnLine = (line.match(/\}/g) ?? []).length

      return {
        curlyCount: curlyCount + openCountOnLine - closedCountOnLine,
        declaration: index === 0 ? [line.substr(line.lastIndexOf('{'))] : [...declaration, line],
      }
    },
    { curlyCount: 0, declaration: [] },
  )
  return stuff.declaration.join('\n')
}

export function readFixture(fileName: string): Promise<string> {
  return new Promise((resolve, reject) => {
    readFile(`${PACKAGE_ROOT_DIR}/src/test/fixtures/${fileName}.txt`, (err, data) =>
      err ? reject(err) : resolve(data.toString()),
    )
  })
}

function sleep(seconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, seconds * 1000)
  })
}
