import ts from 'typescript/lib/tsserverlibrary'
import { MemberParser, MemberType, VariableInfo } from './member-parser'
import mockFs from 'mock-fs'

describe('MemberParser', () => {
  afterEach(() => mockFs.restore())

  describe('getMissingMembersForVariable', () => {
    it('returns the correct members when there are none specified', () => {
      const { createProgram } = createTestDeps()
      const tsFilePath = 'file.ts'
      mockFs({
        [tsFilePath]: `
        interface PhoneNumber {
          countryCode: string
          phoneNumber: number
        }
        
        interface Person {
          firstName: string
          lastName: string
          address: { city: string; postcode: string }
          mobileNumber: PhoneNumber
          status: 'Alive' | 'Dead'
        }
        
        export const aPerson: Person = {}
        `,
      })

      const memberParser = new MemberParser(createProgram(tsFilePath))
      const members = memberParser.getMissingMembersForVariable('aPerson', tsFilePath)

      expect(members).toStrictEqual<typeof members>({
        firstName: MemberType.String,
        lastName: MemberType.String,
        address: { city: MemberType.String, postcode: MemberType.String },
        mobileNumber: { countryCode: MemberType.String, phoneNumber: 0 },
        status: MemberType.Union,
      })
    })

    it('only returns missing members when some members are already initialized', () => {
      const { createProgram } = createTestDeps()
      const tsFilePath = 'file.ts'
      mockFs({
        [tsFilePath]: `
        interface PhoneNumber {
          countryCode: string
          phoneNumber: number
        }
        
        interface Person {
          firstName: string
          lastName: string
          address: { city: string; postcode: string }
          mobileNumber: PhoneNumber
          status: 'Alive' | 'Dead'
        }
        
        export const aPerson: Person = {
          lastName: 'my last name',
          status: 'Alive',
        }
        `,
      })

      const memberParser = new MemberParser(createProgram(tsFilePath))
      const members = memberParser.getMissingMembersForVariable('aPerson', tsFilePath)

      expect(members).toStrictEqual<typeof members>({
        firstName: MemberType.String,
        address: { city: MemberType.String, postcode: MemberType.String },
        mobileNumber: { countryCode: MemberType.String, phoneNumber: 0 },
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

      it.skip('gets the correct members when they are declared in different files', () => {
        const { createProgram } = createTestDeps()
        const baseFilePath = 'base.ts'
        const filePath = 'file.ts'
        mockFs({
          [baseFilePath]: `
          export interface Animal {
            age: number
            hasLegs: boolean
          }
          `,
          [filePath]: `
          import { Animal } from '${baseFilePath}'

          interface Dog extends Animal {
            breed: string
          }
          
          export const dog: Dog = {}`,
        })

        const memberParser = new MemberParser(createProgram(filePath, baseFilePath))
        const members = memberParser.getMissingMembersForVariable('dog', filePath)

        expect(members).toStrictEqual<typeof members>({
          age: MemberType.Number,
          breed: MemberType.String,
          hasLegs: MemberType.Boolean,
        })
      })
    })
  })

  describe('getVariableInfo', () => {
    it(`returns an empty array of lines when a variable has no members`, () => {
      const { createProgram } = createTestDeps()
      const filePath = 'file.ts'
      mockFs({ [filePath]: `type Person = { name: string };export const aPerson: Person = {}` })

      const memberParser = new MemberParser(createProgram(filePath))
      const info = memberParser.getVariableInfo('aPerson', filePath)

      expect(info).toStrictEqual<VariableInfo>({
        lines: [],
        start: { character: 62, line: 0, pos: 61 },
        end: { character: 65, line: 0, pos: 64 },
      })
    })

    it(`returns the variable's value when there are some members`, () => {
      const { createProgram } = createTestDeps()
      const filePath = 'file.ts'
      mockFs({
        [filePath]: `
        interface Person {
          firstName: string
          lastName: string
          address: { city: string; postcode: string }
          mobileNumber: PhoneNumber
          status: 'Alive' | 'Dead'
        }
        
        export const targetVariable: Person = {
          lastName: 'my last name',
          status: 'Alive',
        }`,
      })

      const memberParser = new MemberParser(createProgram(filePath))
      const info = memberParser.getVariableInfo('targetVariable', filePath)

      expect(info).toStrictEqual<VariableInfo>({
        lines: [`lastName: 'my last name'`, `status: 'Alive'`],
        start: expect.any(Object),
        end: expect.any(Object),
      })
    })

    it(`returns the variable's text when it is a single line declaration`, () => {
      const { createProgram } = createTestDeps()
      const filePath = 'file.ts'
      mockFs({
        [filePath]: `
        interface Person {
          firstName: string
          lastName: string
          address: { city: string; postcode: string }
          mobileNumber: PhoneNumber
          status: 'Alive' | 'Dead'
        }
        
        export const targetVariable: Person = { status: 'Dead', lastName: 'my last name' }`,
      })

      const memberParser = new MemberParser(createProgram(filePath))
      const info = memberParser.getVariableInfo('targetVariable', filePath)

      expect(info).toStrictEqual<VariableInfo>({
        lines: [`status: 'Dead'`, `lastName: 'my last name'`],
        start: expect.any(Object),
        end: expect.any(Object),
      })
    })
  })

  describe('getVariableNameAtLocation', () => {
    it('can get a variable name at a certain location', () => {
      const { createProgram } = createTestDeps()
      const filePath = 'file.ts'
      mockFs({ [filePath]: `type Person = { name: string };export const myVariable = {}` })

      const memberParser = new MemberParser(createProgram(filePath))
      const variableName = memberParser.getVariableNameAtLocation(44, 54, filePath)

      expect(variableName).toEqual('myVariable')
    })
  })
})

function createTestDeps() {
  return {
    createProgram: (...fileNames: [string, ...string[]]) =>
      ts.createProgram(fileNames, {
        noEmit: true,
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ESNext,
        lib: ['es2019'],
        strict: true,
      }),
    makeFileContent: (...lines: string[]) => lines.join('\n'),
  }
}
