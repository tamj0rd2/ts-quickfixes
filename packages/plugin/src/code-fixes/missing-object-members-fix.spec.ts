import ts from 'typescript/lib/tsserverlibrary'
import {
  createDummyLogger,
  createImportStatement,
  createTestProgram,
  FsMocker,
  getNodeRange,
  stripLeadingWhitespace,
} from '../test-helpers'
import { MissingObjectMembersFix } from './missing-object-members-fix'
import { MissingVariableMembersFix } from './missing-variable-members-fix'

describe('missing object members fix', () => {
  afterEach(() => FsMocker.reset())

  describe('when all members are missing', () => {
    it('can declare missing members for a nested object', () => {
      const initialValue = '{}'
      const [filePath, fileContent] = FsMocker.addFile(`
        interface TargetType {
          name: string
        }
        
        interface ParentType {
          targetItem: TargetType
        }
        
        export const parent: ParentType = {
          targetItem: ${initialValue}
        }
      `)

      const errorLocation = getNodeRange(fileContent, 'targetItem', { index: 1 })
      const fix = new MissingObjectMembersFix({
        ts,
        filePath,
        program: createTestProgram([filePath], MissingVariableMembersFix.supportedErrorCodes),
        logger: createDummyLogger(),
        ...errorLocation,
      })

      const initializerLocation = getNodeRange(fileContent, initialValue)
      expect(fix.changes).toStrictEqual<ts.FileTextChanges[]>([
        {
          fileName: filePath,
          textChanges: [
            {
              span: { start: initializerLocation.start, length: initialValue.length },
              newText: `{\n    name: 'todo'\n}`,
            },
          ],
          isNewFile: false,
        },
      ])
    })

    it.skip('can declare multiple missing members', () => {
      const [filePath, fileContent] = FsMocker.addFile(`
        interface TargetType {
          name: string
          age: number
        }
        
        export const targetVariable: TargetType = {}
      `)

      const errorLocation = getNodeRange(fileContent, 'targetVariable')
      const fix = new MissingVariableMembersFix({
        ts,
        filePath,
        program: createTestProgram([filePath], MissingVariableMembersFix.supportedErrorCodes),
        logger: createDummyLogger(),
        ...errorLocation,
      })

      const initializerLocation = getNodeRange(fileContent, '{}')
      expect(fix.changes).toStrictEqual<ts.FileTextChanges[]>([
        {
          fileName: filePath,
          textChanges: [
            {
              span: { start: initializerLocation.start, length: 2 },
              newText: stripLeadingWhitespace(
                `{
                     name: 'todo',
                     age: 0
                 }`,
              ),
            },
          ],
          isNewFile: false,
        },
      ])
    })

    it.skip('can declare members from extended interfaces', () => {
      const [inheritedFilePath] = FsMocker.addFile(`
        export interface SuperType {
          name: string
        }
      `)
      const [filePath, fileContent] = FsMocker.addFile(`
        ${createImportStatement('SuperType', inheritedFilePath)}

        interface TargetType extends SuperType {
          age: number
        }
        
        export const targetVariable: TargetType = {}
      `)

      const errorLocation = getNodeRange(fileContent, 'targetVariable')
      const fix = new MissingVariableMembersFix({
        ts,
        filePath,
        program: createTestProgram(
          [filePath, inheritedFilePath],
          MissingVariableMembersFix.supportedErrorCodes,
        ),
        logger: createDummyLogger(),
        ...errorLocation,
      })

      const initializerLocation = getNodeRange(fileContent, '{}')
      expect(fix.changes).toStrictEqual<ts.FileTextChanges[]>([
        {
          fileName: filePath,
          textChanges: [
            {
              span: { start: initializerLocation.start, length: 2 },
              newText: stripLeadingWhitespace(
                `{
                     age: 0,
                     name: 'todo'
                 }`,
              ),
            },
          ],
          isNewFile: false,
        },
      ])
    })
  })
})
