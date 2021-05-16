import { readFile } from 'fs'
import * as vscode from 'vscode'
import { E2E_ROOT_DIR } from '../paths'

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
    await wait(1)
  }
  throw new Error('waitUntil timeout exceeded')
}

export async function waitForResponse<T, Res extends T>(
  getResponse: () => T | Promise<T>,
  predicate: (response: T) => boolean,
  message?: string,
  timeout = 5,
): Promise<Res> {
  for (let attempt = 0; attempt < timeout; attempt++) {
    const response = await getResponse()
    if (predicate(response)) return response as Res
    await wait(1)
  }

  throw new Error(message ?? 'tryGetResponse timeout exceeded')
}

export function readFixture(fileName: string): Promise<string> {
  return new Promise((resolve, reject) => {
    readFile(`${E2E_ROOT_DIR}/src/fixtures/${fileName}.txt`, (err, data) =>
      err ? reject(err) : resolve(data.toString()),
    )
  })
}

export function wait(seconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, seconds * 1000)
  })
}
