import ts from 'typescript/lib/tsserverlibrary'
import {
  createDummyLogger,
  createImportStatement,
  createTestProgram,
  FsMocker,
  getNodeRange,
  stripLeadingWhitespace,
} from '../test-helpers'
import { NodeRange } from './fix'
import { MissingVariableMembersFix } from './missing-variable-members-fix'

describe('missing variable members fix', () => {
  afterEach(() => FsMocker.reset())

  describe('when all members are missing', () => {
    it('can declare a missing member', () => {
      const [filePath, fileContent] = FsMocker.addFile(`
        interface TargetType {
          name: string
        }
        
        export const targetVariable: TargetType = {}
      `)

      const errorLocation = getNodeRange(fileContent, 'targetVariable')
      const fix = createFix(filePath, errorLocation)

      const initializerLocation = getNodeRange(fileContent, '{}')
      expect(fix.changes).toStrictEqual<ts.FileTextChanges[]>([
        {
          fileName: filePath,
          textChanges: [
            {
              span: { start: initializerLocation.start, length: 2 },
              newText: stripLeadingWhitespace(
                `{
                     name: 'todo'
                 }`,
              ),
            },
          ],
          isNewFile: false,
        },
      ])
    })

    it('can declare multiple missing members', () => {
      const [filePath, fileContent] = FsMocker.addFile(`
        interface TargetType {
          name: string
          age: number
        }
        
        export const targetVariable: TargetType = {}
      `)

      const errorLocation = getNodeRange(fileContent, 'targetVariable')
      const fix = createFix(filePath, errorLocation)

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

    it('can declare members from extended interfaces', () => {
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
      const fix = createFix(filePath, errorLocation)

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

  describe('when some members have been declared', () => {
    it('can declare the missing members without overwriting the old ones', () => {
      const value = stripLeadingWhitespace(`{
          age: 123
        }`)
      const [filePath, fileContent] = FsMocker.addFile(`
          interface TargetType {
            name: string
            age: number
          }
          
          export const targetVariable: TargetType = ${value}
        `)

      const errorLocation = getNodeRange(fileContent, 'targetVariable')
      const fix = createFix(filePath, errorLocation)

      const initializerLocation = getNodeRange(fileContent, value)
      expect(fix.changes).toStrictEqual<ts.FileTextChanges[]>([
        {
          fileName: filePath,
          textChanges: [
            {
              span: { start: initializerLocation.start, length: 18 },
              newText: stripLeadingWhitespace(
                `{
                       age: 123,
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

  describe.skip('when a nested object has missing members', () => {
    it('declares the missing members', () => {
      const value = '{}'
      const [filePath, fileContent] = FsMocker.addFile(`
        interface TargetInterface {
          age: number
          favourites: {
            colour: string
            film: string
          }
        }

        export const targetVariable: TargetInterface = {
          age: 100,
          favourites: ${value}
        }
      `)

      const errorLocation = getNodeRange(fileContent, 'favourites', { occurrence: 2 })
      const fix = createFix(filePath, errorLocation)

      const initializerLocation = getNodeRange(fileContent, value)
      expect(fix.changes).toHaveLength(1)
      expect(fix.changes[0].textChanges).toStrictEqual<ts.TextChange[]>([
        {
          span: { start: initializerLocation.start, length: 2 },
          newText: stripLeadingWhitespace(
            `{
                 colour: 'todo',
                 film: 'todo'
             }`,
          ),
        },
      ])
    })
  })

  describe('member types', () => {
    const testInitializer = (memberType: string, expectedInitializer: string) => {
      it(`can declare a missing ${memberType} member`, () => {
        const [filePath, fileContent] = FsMocker.addFile(`
          interface TargetType {
            targetMember: ${memberType}
          }
          
          export const targetVariable: TargetType = {}
        `)

        const errorLocation = getNodeRange(fileContent, 'targetVariable')
        const fix = createFix(filePath, errorLocation)

        expect(fix.changes).toHaveLength(1)
        expect(fix.changes[0].textChanges).toHaveLength(1)
        expect(fix.changes[0].textChanges[0].newText).toBe(stripLeadingWhitespace(expectedInitializer))
      })
    }

    testInitializer('string', `{\n    targetMember: 'todo'\n}`)
    testInitializer('number', `{\n    targetMember: 0\n}`)
    testInitializer('boolean', `{\n    targetMember: false\n}`)
    testInitializer('true', `{\n    targetMember: true\n}`)
    testInitializer('false', `{\n    targetMember: false\n}`)
    testInitializer('"Dead" | "Alive"', `{\n    targetMember: null\n}`)
    testInitializer('string[]', `{\n    targetMember: []\n}`)
    testInitializer('Date', `{\n    targetMember: new Date()\n}`)
    testInitializer(
      '{ city: string; postcode: string }',
      stripLeadingWhitespace(`{
          targetMember: {
              city: 'todo',
              postcode: 'todo'
          }
      }`),
    )

    it(`can declare a missing member that is an interface`, () => {
      const [filePath, fileContent] = FsMocker.addFile(`
        interface TargetType {
          targetMember: NestedInterface
        }

        interface NestedInterface {
          nestedValue: string
        }
        
        export const targetVariable: TargetType = {}
      `)

      const errorLocation = getNodeRange(fileContent, 'targetVariable')
      const fix = createFix(filePath, errorLocation)

      expect(fix.changes).toHaveLength(1)
      expect(fix.changes[0].textChanges).toHaveLength(1)
      expect(fix.changes[0].textChanges[0].newText).toBe(
        stripLeadingWhitespace(`{
              targetMember: {
                  nestedValue: 'todo'
              }
          }`),
      )
    })

    it(`can declare a misisng member that is an enum`, () => {
      const [filePath, fileContent] = FsMocker.addFile(`
        interface TargetType {
          targetMember: TargetEnum
        }

        enum TargetEnum {
          Value1,
          Value2,
          Value3,
        }
        
        export const targetVariable: TargetType = {}
      `)

      const errorLocation = getNodeRange(fileContent, 'targetVariable')
      const fix = createFix(filePath, errorLocation)

      expect(fix.changes).toHaveLength(1)
      expect(fix.changes[0].textChanges).toHaveLength(1)
      expect(fix.changes[0].textChanges[0].newText).toBe(
        stripLeadingWhitespace(`{\n    targetMember: TargetEnum.Value1\n}`),
      )
    })

    it('can declare missing members whose type definitions have been imported', () => {
      const [importedFilePath] = FsMocker.addFile(`
        export interface NestedInterface {
          nestedValue: string
        }
      `)

      const [targetFilePath, targetFileContent] = FsMocker.addFile(`
          import { NestedInterface } from './${importedFilePath.replace('.ts', '')}'

          interface TargetType {
            targetMember: NestedInterface
          }

          export const targetVariable: TargetType = {}
        `)

      const errorLocation = getNodeRange(targetFileContent, 'targetVariable')
      const fix = createFix(targetFilePath, errorLocation)

      expect(fix.changes).toHaveLength(1)
      expect(fix.changes[0].textChanges).toHaveLength(1)
      expect(fix.changes[0].textChanges[0].newText).toBe(
        stripLeadingWhitespace(`{
              targetMember: {
                  nestedValue: 'todo'
              }
          }`),
      )
    })
  })
})

function createFix(filePath: string, errorLocation: NodeRange): MissingVariableMembersFix {
  return new MissingVariableMembersFix({
    ts,
    filePath,
    program: createTestProgram(FsMocker.fileNames, MissingVariableMembersFix.supportedErrorCodes),
    logger: createDummyLogger(),
    ...errorLocation,
  })
}
