import { MemberParser, MemberType, VariableInfo } from './member-parser'

describe('MemberParser', () => {
  // TODO: get rid of this grossness!
  const filePath = `${__dirname}/../../../../test-environment/testing.ts`

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
        lines: [],
        start: { character: 31, line: 14 },
        end: { character: 34, line: 14 },
      })
    })

    it(`returns the variable's value when there are some members`, () => {
      const parser = new MemberParser(filePath)

      const info = parser.getVariableInfo('personWithOneProperty')

      expect(info).toStrictEqual<VariableInfo>({
        lines: [`lastName: 'my last name'`],
        start: { character: 45, line: 16 },
        end: { character: 2, line: 18 },
      })
    })

    it(`returns the variable's text when it is a single line declaration`, () => {
      const parser = new MemberParser(filePath)

      const info = parser.getVariableInfo('inlinePersonWithTwoProperties')

      expect(info).toStrictEqual<VariableInfo>({
        lines: [`birthday: new Date()`, `status: 'Alive'`],
        start: { character: 53, line: 20 },
        end: { character: 95, line: 20 },
      })
    })
  })
})
