import { MemberFormatter } from './formatter'
import { MemberType } from './member-parser'

describe('Formatter', () => {
  describe('format', () => {
    it(`formats members nicely when all members are missing`, () => {
      const members = {
        firstName: MemberType.String,
        lastName: MemberType.String,
        birthday: MemberType.BuiltIn,
        address: {
          city: MemberType.String,
          postcode: MemberType.String,
        },
        mobileNumber: {
          countryCode: MemberType.String,
          phoneNumber: MemberType.Number,
        },
        status: MemberType.Union,
      }

      const formattedMembers = new MemberFormatter().format('{}', members)

      // TODO: this should eventually use the user's space and trailing comma preferences
      expect(formattedMembers).toStrictEqual(
        [
          `{`,
          `  firstName: 'todo',`,
          `  lastName: 'todo',`,
          `  birthday: null,`,
          `  address: {`,
          `    city: 'todo',`,
          `    postcode: 'todo',`,
          `  },`,
          `  mobileNumber: {`,
          `    countryCode: 'todo',`,
          `    phoneNumber: 0,`,
          `  },`,
          `  status: null,`,
          `}`,
        ].join('\n'),
      )
    })
  })
})
