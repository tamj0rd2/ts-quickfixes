import { LineEnding, MemberFormatter } from './formatter'
import { MemberType } from './member-parser'

describe('Formatter', () => {
  Object.keys(LineEnding).forEach((lineEndingKey) => {
    const lineEnding = LineEnding[lineEndingKey as keyof typeof LineEnding]

    describe(`format with line ending ${lineEndingKey}`, () => {
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

        const formattedMembers = new MemberFormatter().format('{}', members, lineEnding)

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
        const variableInitializer = [
          `{`,
          `  stuff: Greetings.Hello,`,
          `  lastName: 'a really cool name'`,
          `}`,
        ].join(lineEnding)

        const members = {
          firstName: MemberType.String,
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

        const formattedMembers = new MemberFormatter().format(variableInitializer, members, lineEnding)

        // TODO: this should eventually use the user's space and trailing comma preferences
        expect(formattedMembers).toStrictEqual(
          [
            `{`,
            `  stuff: Greetings.Hello,`,
            `  lastName: 'a really cool name',`,
            `  firstName: 'todo',`,
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
    })
  })
})
