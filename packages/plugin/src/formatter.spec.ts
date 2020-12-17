import { LineEnding, MemberFormatter } from './formatter'
import { EnumMember, GroupedMembers, MemberType } from './member-parser'

describe('Formatter', () => {
  Object.keys(LineEnding).forEach((lineEndingKey) => {
    const lineEnding = LineEnding[lineEndingKey as keyof typeof LineEnding]

    describe(`format with line ending ${lineEndingKey}`, () => {
      it(`formats members nicely when all members are missing`, () => {
        const { createMembers } = createTestDeps()
        const groupedMembers = createMembers()

        const formattedMembers = new MemberFormatter().format([], groupedMembers, lineEnding)

        // TODO: this should eventually use the user's space and trailing comma preferences
        expect(formattedMembers).toStrictEqual(
          [
            `{`,
            `  firstName: 'todo',`,
            `  lastName: 'todo',`,
            `  birthday: null,`,
            `  address: {`,
            `    city: 'todo',`,
            `  },`,
            `  mobileNumber: {`,
            `    countryCode: 'todo',`,
            `    phoneNumber: 0,`,
            `  },`,
            `  status: null,`,
            `  isEmployed: false,`,
            `  favouriteColour: Colour.Purple,`,
            `}`,
          ].join(lineEnding),
        )
      })

      it(`formats members nicely when only some members are missing`, () => {
        const { createMembers } = createTestDeps()
        const groupedMembers = createMembers()
        delete groupedMembers.members.lastName
        delete groupedMembers.members.birthday

        const existingMembers = [`lastName: 'a really cool name'`, `birthday: new Date()`]

        const formattedMembers = new MemberFormatter().format(existingMembers, groupedMembers, lineEnding)

        // TODO: this should eventually use the user's space and trailing comma preferences
        expect(formattedMembers).toStrictEqual(
          [
            `{`,
            `  lastName: 'a really cool name',`,
            `  birthday: new Date(),`,
            `  firstName: 'todo',`,
            `  address: {`,
            `    city: 'todo',`,
            `  },`,
            `  mobileNumber: {`,
            `    countryCode: 'todo',`,
            `    phoneNumber: 0,`,
            `  },`,
            `  status: null,`,
            `  isEmployed: false,`,
            `  favouriteColour: Colour.Purple,`,
            `}`,
          ].join(lineEnding),
        )
      })
    })
  })
})

function createTestDeps() {
  return {
    createMembers: (): GroupedMembers =>
      new GroupedMembers({
        firstName: MemberType.String,
        lastName: MemberType.String,
        birthday: MemberType.BuiltIn,
        address: new GroupedMembers({
          city: MemberType.String,
          postcode: MemberType.Never,
        }),
        mobileNumber: new GroupedMembers({
          countryCode: MemberType.String,
          phoneNumber: MemberType.Number,
        }),
        status: MemberType.Union,
        isEmployed: MemberType.Boolean,
        favouriteColour: new EnumMember('Colour', 'Purple'),
      }),
  }
}
