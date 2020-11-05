import { LineEnding, MemberFormatter } from './formatter'
import { Members, MemberType } from './member-parser'

describe('Formatter', () => {
  Object.keys(LineEnding).forEach((lineEndingKey) => {
    const lineEnding = LineEnding[lineEndingKey as keyof typeof LineEnding]

    describe(`format with line ending ${lineEndingKey}`, () => {
      it(`formats members nicely when all members are missing`, () => {
        const { createMembers } = createTestDeps()
        const members = createMembers()

        const formattedMembers = new MemberFormatter().format([], members, lineEnding)

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
          ].join(lineEnding),
        )
      })

      it(`formats members nicely when only some members are missing`, () => {
        const { createMembers } = createTestDeps()
        const members = createMembers()
        delete members.lastName
        delete members.birthday

        const existingMembers = [`lastName: 'a really cool name'`, `birthday: new Date()`]

        const formattedMembers = new MemberFormatter().format(existingMembers, members, lineEnding)

        // TODO: this should eventually use the user's space and trailing comma preferences
        expect(formattedMembers).toStrictEqual(
          [
            `{`,
            `  lastName: 'a really cool name',`,
            `  birthday: new Date(),`,
            `  firstName: 'todo',`,
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
          ].join(lineEnding),
        )
      })
    })
  })
})

function createTestDeps() {
  return {
    createMembers: (): Members => ({
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
    }),
  }
}
