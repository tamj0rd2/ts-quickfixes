import assert from 'assert'
import { MemberParser, MemberType } from '../../member-parser'

suite('MemberParser', () => {
  test('it returns the correct members', () => {
    const memberParser = new MemberParser()

    const members = memberParser.getMembersForVariable('aPerson')

    // TODO: use the quote preference from the editor
    assert.deepStrictEqual<typeof members>(members, {
      firstName: MemberType.String,
      lastName: MemberType.String,
      birthday: MemberType.BuiltIn,
      address: { city: MemberType.String, postcode: MemberType.String },
      mobileNumber: { countryCode: MemberType.String, phoneNumber: 0 },
      status: MemberType.Union,
    })
  })
})
