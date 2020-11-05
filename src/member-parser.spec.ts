import { MemberParser, MemberType } from './member-parser'
import { TEST_ENV_FOLDER } from './test/test_constants'

describe('MemberParser', () => {
  const filePath = TEST_ENV_FOLDER + '/testing.ts'

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
