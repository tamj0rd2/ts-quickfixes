import { resolve } from 'path'
import ts from 'typescript/lib/tsserverlibrary'
import { MemberParser, MemberType, VariableInfo } from './member-parser'

describe('MemberParser', () => {
  describe('getMissingMembersForVariable', () => {
    it('returns the correct members when there are none specified', () => {
      const { program, testFilePath } = createTestDeps()
      const memberParser = new MemberParser(program)

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
      const { program, testFilePath } = createTestDeps()
      const memberParser = new MemberParser(program)

      const members = memberParser.getMissingMembersForVariable('personWithOneProperty', testFilePath)

      expect(members).toStrictEqual<typeof members>({
        firstName: MemberType.String,
        birthday: MemberType.BuiltIn,
        address: { city: MemberType.String, postcode: MemberType.String },
        mobileNumber: { countryCode: MemberType.String, phoneNumber: 0 },
        status: MemberType.Union,
      })
    })
  })

  describe('getVariableInfo', () => {
    it(`returns the variable's value when there are no members`, () => {
      const { program, testFilePath } = createTestDeps()
      const memberParser = new MemberParser(program)

      const info = memberParser.getVariableInfo('aPerson', testFilePath)

      expect(info).toStrictEqual<VariableInfo>({
        lines: [],
        start: { character: 31, line: 14, pos: 280 },
        end: { character: 34, line: 14, pos: 283 },
      })
    })

    it(`returns the variable's value when there are some members`, () => {
      const { program, testFilePath } = createTestDeps()
      const memberParser = new MemberParser(program)

      const info = memberParser.getVariableInfo('personWithOneProperty', testFilePath)

      expect(info).toStrictEqual<VariableInfo>({
        lines: [`lastName: 'my last name'`],
        start: { character: 45, line: 16, pos: 329 },
        end: { character: 2, line: 18, pos: 361 },
      })
    })

    it(`returns the variable's text when it is a single line declaration`, () => {
      const { program, testFilePath } = createTestDeps()
      const memberParser = new MemberParser(program)

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
      const { program, testFilePath } = createTestDeps()
      const expectedVariableName = 'singleLinePerson'
      const start = 376
      const end = start + expectedVariableName.length

      const variableName = new MemberParser(program).getVariableNameAtLocation(start, end, testFilePath)

      expect(variableName).toEqual(expectedVariableName)
    })
  })
})

function createTestDeps() {
  const testFilePath = resolve(process.cwd(), `../../test-environment/testing.ts`)
  const program = ts.createProgram([testFilePath], {
    noEmit: true,
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.Latest,
  })

  return {
    testFilePath,
    program,
  }
}
