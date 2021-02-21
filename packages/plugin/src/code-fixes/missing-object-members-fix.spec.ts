import ts from 'typescript/lib/tsserverlibrary'
import { createDummyLogger, createTestProgram, FsMocker, getNodeRange } from '../test-helpers'
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

    it('can declare missing members for an object inside of an array', () => {
      const initialValue = '{}'
      const [filePath, fileContent] = FsMocker.addFile(`
        interface TargetType {
          name: string
        }
        
        interface ParentType {
          targetItems: TargetType[]
        }
        
        export const parent: ParentType = {
          targetItems: [${initialValue}]
        }`)

      const errorLocation = getNodeRange(fileContent, initialValue)
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
  })
})
