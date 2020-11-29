import { resolve } from 'path'
import ts from 'typescript/lib/tsserverlibrary'
import { MemberParser, MemberType, VariableInfo } from './member-parser'
import mockFs from 'mock-fs'

describe('MemberParser', () => {
  afterEach(() => mockFs.restore())

  describe('getMissingMembersForVariable', () => {
    it('returns the correct members when there are none specified', () => {
      const { createProgram, getFilePath } = createTestDeps()
      const testFilePath = getFilePath('testing')
      const memberParser = new MemberParser(createProgram(testFilePath))

      const members = memberParser.getMissingMembersForVariable('aPerson', testFilePath)

      expect(members).toStrictEqual<typeof members>({
        firstName: MemberType.String,
        lastName: MemberType.String,
        birthday: MemberType.BuiltIn,
        address: { city: MemberType.String, postcode: MemberType.String },
        mobileNumber: { countryCode: MemberType.String, phoneNumber: 0 },
        status: MemberType.Union,
      })
    })

    it('returns the correct members when there is already one specified', () => {
      const { createProgram, getFilePath } = createTestDeps()
      const testFilePath = getFilePath('testing')
      const memberParser = new MemberParser(createProgram(testFilePath))

      const members = memberParser.getMissingMembersForVariable('personWithOneProperty', testFilePath)

      expect(members).toStrictEqual<typeof members>({
        firstName: MemberType.String,
        birthday: MemberType.BuiltIn,
        address: { city: MemberType.String, postcode: MemberType.String },
        mobileNumber: { countryCode: MemberType.String, phoneNumber: 0 },
        status: MemberType.Union,
      })
    })

    describe('when the interface extends another interface', () => {
      it('gets the correct members when they are declared in the same file', () => {
        const { createProgram } = createTestDeps()
        const filePath = 'file.ts'
        mockFs({
          [filePath]: `
          interface Animal {
            age: number
            hasLegs: boolean
          }

          interface Dog extends Animal {
            breed: string
          }
          
          export const dog: Dog = {}`,
        })

        const memberParser = new MemberParser(createProgram(filePath))
        const members = memberParser.getMissingMembersForVariable('dog', filePath)

        expect(members).toStrictEqual<typeof members>({
          age: MemberType.Number,
          breed: MemberType.String,
          hasLegs: MemberType.Boolean,
        })
      })

      it.todo('gets the correct members when they are declared in different files')
    })
  })

  describe('getVariableInfo', () => {
    it(`returns the variable's value when there are no members`, () => {
      const { createProgram, getFilePath } = createTestDeps()
      const testFilePath = getFilePath('testing')
      const memberParser = new MemberParser(createProgram(testFilePath))

      const info = memberParser.getVariableInfo('aPerson', testFilePath)

      expect(info).toStrictEqual<VariableInfo>({
        lines: [],
        start: { character: 31, line: 14, pos: 280 },
        end: { character: 34, line: 14, pos: 283 },
      })
    })

    it(`returns the variable's value when there are some members`, () => {
      const { createProgram, getFilePath } = createTestDeps()
      const testFilePath = getFilePath('testing')
      const memberParser = new MemberParser(createProgram(testFilePath))

      const info = memberParser.getVariableInfo('personWithOneProperty', testFilePath)

      expect(info).toStrictEqual<VariableInfo>({
        lines: [`lastName: 'my last name'`],
        start: { character: 45, line: 16, pos: 329 },
        end: { character: 2, line: 18, pos: 361 },
      })
    })

    it(`returns the variable's text when it is a single line declaration`, () => {
      const { createProgram, getFilePath } = createTestDeps()
      const testFilePath = getFilePath('testing')
      const memberParser = new MemberParser(createProgram(testFilePath))

      const info = memberParser.getVariableInfo('singleLinePerson', testFilePath)

      expect(info).toStrictEqual<VariableInfo>({
        lines: [`birthday: new Date()`, `status: 'Alive'`],
        start: { character: 40, line: 20, pos: 402 },
        end: { character: 82, line: 20, pos: 444 },
      })
    })
  })

  describe('getVariableNameAtLocation', () => {
    it('can get a variable name at a certain location', () => {
      const { createProgram, getFilePath } = createTestDeps()
      const testFilePath = getFilePath('testing')
      const program = createProgram(testFilePath)

      const expectedVariableName = 'singleLinePerson'
      const start = 376
      const end = start + expectedVariableName.length

      const variableName = new MemberParser(program).getVariableNameAtLocation(start, end, testFilePath)

      expect(variableName).toEqual(expectedVariableName)
    })
  })
})

function createTestDeps() {
  const fixtureFolder = resolve(process.cwd(), `../../test-environment`)
  return {
    createProgram: (...fileNames: [string, ...string[]]) =>
      ts.createProgram(fileNames, {
        noEmit: true,
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.Latest,
      }),
    getFilePath: (fileName: string) => `${fixtureFolder}/${fileName}.ts`,
    makeFileContent: (...lines: string[]) => lines.join('\n'),
  }
}
