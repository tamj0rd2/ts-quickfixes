import ts from 'typescript/lib/tsserverlibrary'
import { DeclareMissingObjectMembers } from './declare-missing-object-members'
import { TSH } from './helpers'
import {
  createDummyLogger,
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

  describe('within an array', () => {
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
})

interface GetNewText {
  errorPos?: TSH.NodePosition
  initializerPos: TSH.NodePosition
  filePath: string
  additionalFiles?: string[]
}

function getNewText(args: GetNewText): string {
  const { additionalFiles, errorPos, filePath, initializerPos } = args
  const fix = DeclareMissingObjectMembers.createFix({
    ts,
    filePath,
    program: createTestProgram(
      [filePath, ...(additionalFiles ?? [])],
      DeclareMissingObjectMembers.supportedErrorCodes,
    ),
    logger: createDummyLogger(true),
    ...(errorPos ?? initializerPos),
  })
  return fix.changes[0].textChanges[0].newText
}
