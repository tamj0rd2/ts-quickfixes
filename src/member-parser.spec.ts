import { MemberParser, MemberType, VariableInfo } from './member-parser'
import { TEST_ENV_FOLDER } from './test/test_constants'

describe('MemberParser', () => {
  const filePath = TEST_ENV_FOLDER + '/testing.ts'

  describe('getMissingMembersForVariable', () => {
    it('returns the correct members when there are none specified', () => {
      const memberParser = new MemberParser(filePath)

      const members = memberParser.getMissingMembersForVariable('aPerson')

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
      const memberParser = new MemberParser(filePath)

      const members = memberParser.getMissingMembersForVariable('personWithOneProperty')

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
      const parser = new MemberParser(filePath)

      const info = parser.getVariableInfo('aPerson')

      expect(info).toStrictEqual<VariableInfo>({
        text: `{}`,
        start: { character: 31, line: 14 },
        end: { character: 34, line: 14 },
      })
    })

    it(`returns the variable's value when there are some members`, () => {
      const parser = new MemberParser(filePath)

      const info = parser.getVariableInfo('personWithOneProperty')

      expect(info).toStrictEqual<VariableInfo>({
        text: `{\n  lastName: 'my last name',\n}`,
        start: { character: 45, line: 16 },
        end: { character: 2, line: 18 },
      })
    })
  })
})
