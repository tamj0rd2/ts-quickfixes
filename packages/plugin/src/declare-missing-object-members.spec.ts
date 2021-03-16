import ts from 'typescript/lib/tsserverlibrary'
import { DeclareMissingObjectMembers } from './declare-missing-object-members'
import { TSH } from './helpers'
import {
  createDummyLogger,
  createImportStatement,
  createTestProgram,
  FsMocker,
  getNodeRange,
  stripLeadingWhitespace,
} from './test-helpers'

describe('declareMissingObjectMembers', () => {
  afterEach(() => FsMocker.reset())

  describe('within a variable declaration', () => {
    it('can declare missing members for a variable declaration', () => {
      const initializer = `{ name: 'tam' }`
      const [filePath, fileContent] = FsMocker.addFile(`
        interface TargetType {
          greeting: string
          name: string
          age: number
        }
        
        export const target: TargetType = ${initializer}
      `)

      const newText = getNewText({
        filePath,
        initializerPos: getNodeRange(fileContent, initializer),
        errorPos: getNodeRange(fileContent, 'target'),
      })

      expect(newText).toBe(
        stripLeadingWhitespace(`{
            name: 'tam',
            greeting: 'todo',
            age: 0
        }`),
      )
    })

    // the getInheritedMemberSymbols helper should probably be tested instead of this.
    it('can declare missing members for a variable declaration that extends a type from another file', () => {
      const initializer = `{ name: 'tam' }`
      const [importedFilePath] = FsMocker.addFile(`
        export interface GrandParentType {
          age: number
        }

        export interface ParentType extends GrandParentType {
          name: string
        }
      `)

      const [targetFilePath, fileContent] = FsMocker.addFile(`
        ${createImportStatement('ParentType', importedFilePath)}

        interface SiblingType {
          isAlive: boolean
        }

        interface TargetType extends ParentType, SiblingType {
          greeting: string
        }
        
        export const target: TargetType = ${initializer}
      `)

      const newText = getNewText({
        filePath: targetFilePath,
        initializerPos: getNodeRange(fileContent, initializer),
        errorPos: getNodeRange(fileContent, 'target'),
        additionalFiles: [importedFilePath],
      })

      expect(newText).toBe(
        stripLeadingWhitespace(`{
            name: 'tam',
            greeting: 'todo',
            age: 0,
            isAlive: false
        }`),
      )
    })

    it('can declare members nested inside a variable declaration', () => {
      const initializer = '{}'
      const [filePath, fileContent] = FsMocker.addFile(`
        interface TargetType {
          greeting: string
          name: string
        }
  
        interface ParentType {
          target: TargetType
        }
        
        export const parent: ParentType = { target: ${initializer} }
      `)

      const newText = getNewText({
        filePath,
        initializerPos: getNodeRange(fileContent, initializer),
        errorPos: getNodeRange(fileContent, 'target', { index: 1 }),
      })

      expect(newText).toBe(
        stripLeadingWhitespace(`{
            greeting: 'todo',
            name: 'todo'
        }`),
      )
    })

    it('can declare members at nesting level 2 inside a variable declaration', () => {
      const initializer = '{}'
      const [filePath, fileContent] = FsMocker.addFile(`
        interface TargetType {
          greeting: string
          name: string
        }
  
        interface GrandParentType {
          parent: { target: TargetType }
        }
        
        export const grandParent: GrandParentType = { parent: { target: ${initializer} } }
      `)

      const newText = getNewText({
        filePath,
        initializerPos: getNodeRange(fileContent, initializer),
        errorPos: getNodeRange(fileContent, 'target', { index: 1 }),
      })

      expect(newText).toBe(
        stripLeadingWhitespace(`{
            greeting: 'todo',
            name: 'todo'
        }`),
      )
    })

    it('can declare members at nesting level 3 inside a variable declaration', () => {
      const initializer = '{}'
      const [filePath, fileContent] = FsMocker.addFile(`
        interface TargetType {
          greeting: string
          name: string
        }
  
        interface GreatGrandParentType {
          grandParent: { parent: { target: TargetType } }
        }
        
        export const greatGrandParent: GreatGrandParentType = { grandParent: { parent: { target: ${initializer} } } }
      `)

      const newText = getNewText({
        filePath,
        initializerPos: getNodeRange(fileContent, initializer),
        errorPos: getNodeRange(fileContent, 'target', { index: 1 }),
      })

      expect(newText).toBe(
        stripLeadingWhitespace(`{
            greeting: 'todo',
            name: 'todo'
        }`),
      )
    })
  })

  it('can declare members in an array inside a variable declaration', () => {
    const initializer = '{}'
    const [filePath, fileContent] = FsMocker.addFile(`
      interface TargetType {
        greeting: string
        name: string
      }

      interface ParentType {
        target: TargetType[]
      }
      
      export const parent: ParentType = { target: [${initializer}] }
    `)

    const newText = getNewText({
      filePath,
      initializerPos: getNodeRange(fileContent, initializer),
    })

    expect(newText).toBe(
      stripLeadingWhitespace(`{
          greeting: 'todo',
          name: 'todo'
      }`),
    )
  })
})

interface GetNewText {
  errorPos?: TSH.NodePosition
  initializerPos: TSH.NodePosition
  filePath: string
  additionalFiles?: string[]
}

function getNewText(args: GetNewText): string {
  const { additionalFiles, errorPos, filePath, initializerPos } = args
  const program = createTestProgram(
    [filePath, ...(additionalFiles ?? [])],
    DeclareMissingObjectMembers.supportedErrorCodes,
  )
  const fix = DeclareMissingObjectMembers.createFix({
    ts,
    filePath,
    program: program,
    typeChecker: program.getTypeChecker(),
    logger: createDummyLogger(true),
    ...(errorPos ?? initializerPos),
  })
  return fix.changes[0].textChanges[0].newText
}
