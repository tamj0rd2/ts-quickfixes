import ts from 'typescript/lib/tsserverlibrary'
import { MemberParser, VariableInfo } from './member-parser'
import _mockFs from 'mock-fs'
import { resolve } from 'path'
import { ObjectLiteralMember } from './members/object-literal-member'
import {
  ArrayMember,
  BooleanMember,
  EnumMember,
  NumberMember,
  StringMember,
  UnimplementedMember,
} from './members/simple-types'

const LineEnding = {
  LF: '\n',
  CRLF: '\r\n',
} as const

type LineEnding = typeof LineEnding[keyof typeof LineEnding]

describe('MemberParser', () => {
  afterEach(() => _mockFs.restore())

  const createTestDeps = curryTestDeps()

  describe('getMissingMembersForVariable', () => {
    it('returns the correct members when there are none specified', () => {
      const { createProgram, setupMockFiles } = createTestDeps()
      const tsFilePath = 'file.ts'
      setupMockFiles({
        [tsFilePath]: `
        interface PhoneNumber {
          countryCode: string
          phoneNumber: number
        }
        
        interface Person {
          firstName: string
          favouriteFilms: string[]
          birthday: Date
          address: { city: string; postcode: string }
          mobileNumber: PhoneNumber
          status: 'Alive' | 'Dead'
        }
        
        export const aPerson: Person = {}
        `,
      })

      const memberParser = new MemberParser(createProgram(tsFilePath))
      const members = memberParser.getMissingMembersForVariable('aPerson', tsFilePath)

      expect(members).toStrictEqual<typeof members>(
        ObjectLiteralMember.createTopLevel([
          new StringMember('firstName'),
          new ArrayMember('favouriteFilms'),
          new UnimplementedMember('birthday'),
          new ObjectLiteralMember('address', [new StringMember('city'), new StringMember('postcode')]),
          new ObjectLiteralMember('mobileNumber', [
            new StringMember('countryCode'),
            new NumberMember('phoneNumber'),
          ]),
          new UnimplementedMember('status'),
        ]),
      )
    })

    it('only returns missing members when some members are already initialized', () => {
      const { createProgram, setupMockFiles } = createTestDeps()
      const tsFilePath = 'file.ts'
      setupMockFiles({
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

      expect(members).toStrictEqual<typeof members>(
        ObjectLiteralMember.createTopLevel([
          new StringMember('firstName'),
          new ObjectLiteralMember('address', [new StringMember('city'), new StringMember('postcode')]),
          new ObjectLiteralMember('mobileNumber', [
            new StringMember('countryCode'),
            new NumberMember('phoneNumber'),
          ]),
        ]),
      )
    })

    it('can get missing enum members', () => {
      const { createProgram, setupMockFiles } = createTestDeps()
      const tsFilePath = 'file.ts'
      setupMockFiles({
        [tsFilePath]: `
        enum Colour {
          Orange,
          Green,
          Blue
        }
        
        interface Person {
          favouriteColour: Colour
        }
        
        export const person: Person = {}
        `,
      })

      const memberParser = new MemberParser(createProgram(tsFilePath))
      const members = memberParser.getMissingMembersForVariable('person', tsFilePath)

      expect(members).toStrictEqual<typeof members>(
        ObjectLiteralMember.createTopLevel([new EnumMember('favouriteColour', 'Colour', 'Orange')]),
      )
    })

    describe('when the interface extends another interface', () => {
      it('gets the correct members when they are declared in the same file', () => {
        const { createProgram, setupMockFiles } = createTestDeps()
        const filePath = 'file.ts'
        setupMockFiles({
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

        expect(members).toStrictEqual<typeof members>(
          ObjectLiteralMember.createTopLevel([
            new StringMember('breed'),
            new NumberMember('age'),
            new BooleanMember('hasLegs'),
          ]),
        )
      })

      it('gets the correct members when they are declared in different files', () => {
        const { createProgram, setupMockFiles, createImportStatement } = createTestDeps()
        const baseFilePath = 'base.ts'
        const filePath = 'file.ts'

        setupMockFiles({
          [baseFilePath]: `
          export interface Animal {
            age: number
            hasLegs: boolean
          }
          `,
          [filePath]: `
          ${createImportStatement('Animal', baseFilePath)}

          interface Dog extends Animal {
            breed: string
          }
          
          export const dog: Dog = {}`,
        })

        const memberParser = new MemberParser(createProgram(filePath, baseFilePath))
        const members = memberParser.getMissingMembersForVariable('dog', filePath)

        expect(members).toStrictEqual<typeof members>(
          ObjectLiteralMember.createTopLevel([
            new StringMember('breed'),
            new NumberMember('age'),
            new BooleanMember('hasLegs'),
          ]),
        )
      })
    })
  })

  describe('getVariableInfo', () => {
    it(`returns an empty array of lines when a variable has no members`, () => {
      const { createProgram, setupMockFiles } = createTestDeps()
      const filePath = 'file.ts'
      setupMockFiles({ [filePath]: `type Person = { name: string };export const aPerson: Person = {}` })

      const memberParser = new MemberParser(createProgram(filePath))
      const info = memberParser.getVariableInfo('aPerson', filePath)

      expect(info).toStrictEqual<VariableInfo>({
        lines: [],
        start: { character: 62, line: 0, pos: 61 },
        end: { character: 65, line: 0, pos: 64 },
      })
    })

    it(`returns the variable's value when there are some members`, () => {
      const { createProgram, setupMockFiles } = createTestDeps()
      const filePath = 'file.ts'
      setupMockFiles({
        [filePath]: `
        interface Person {
          firstName: string
          lastName: string
          address: { city: string; postcode: string }
          mobileNumber: string
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
      const { createProgram, setupMockFiles } = createTestDeps()
      const filePath = 'file.ts'
      setupMockFiles({
        [filePath]: `
        interface Person {
          firstName: string
          lastName: string
          address: { city: string; postcode: string }
          mobileNumber: string
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
      const { createProgram, setupMockFiles } = createTestDeps()
      const filePath = 'file.ts'
      setupMockFiles({ [filePath]: `type Person = { name: string };export const myVariable = {}` })

      const memberParser = new MemberParser(createProgram(filePath))
      const variableName = memberParser.getVariableNameAtLocation(44, 54, filePath)

      expect(variableName).toEqual('myVariable')
    })
  })

  describe('fillMissingMembers', () => {
    it('fills in missing members when none are declared', () => {
      const { createProgram, setupMockFiles } = createTestDeps()
      const filePath = 'file.ts'
      setupMockFiles({
        [filePath]: `
          type Person = { firstName: string; lastName: string }
          export const myVariable: Person = {}`,
      })

      const memberParser = new MemberParser(createProgram(filePath))
      const result = memberParser.fillMissingMembers('myVariable', filePath)

      expect(result).toBe(`{ firstName: "", lastName: "" }`)
    })

    it('fills in missing members when some are declared', () => {
      const { createProgram, setupMockFiles, trimOutput } = createTestDeps()
      const filePath = 'file.ts'
      setupMockFiles({
        [filePath]: `
          type Person = { firstName: string; lastName: string }
          export const myVariable: Person = {
            firstName: "Nick"
          }`,
      })

      const memberParser = new MemberParser(createProgram(filePath))
      const result = memberParser.fillMissingMembers('myVariable', filePath)

      expect(trimOutput(result)).toBe(
        trimOutput(`{
          firstName: "Nick",
          lastName: ""
        }`),
      )
    })
  })
})

function curryTestDeps() {
  const repoRoot = resolve(__dirname, '../../..')
  const nodeModulesFolder = repoRoot + '/node_modules'
  const tsLibFolder = nodeModulesFolder + '/typescript/lib'
  const realTsLibFolder = _mockFs.load(tsLibFolder)

  return function createTestDeps() {
    return {
      createProgram: (...fileNames: [string, ...string[]]) => {
        const program = ts.createProgram(fileNames, {
          noEmit: true,
          module: ts.ModuleKind.CommonJS,
          baseUrl: repoRoot,
        })

        /** ===================================================================================/
         * uncomment to enable diagnostics for the created typescript program.
         * of course, if the typescript compilation has errors (other than the one we expect),
         * parsing the AST will probably give very strange results/errors.
         * ===================================================================================*/
        const diagnostics = ts.getPreEmitDiagnostics(program)
        if (diagnostics?.length > 1) {
          debugger
          process.stdout.write(
            JSON.stringify(
              diagnostics.map(({ file, messageText }) => ({ messageText, filePath: file?.fileName })),
              null,
              2,
            ),
          )
          throw new Error('Unexpected errors while creating the TS program')
        }

        return program
      },
      setupMockFiles: (files: Record<string, string>) =>
        _mockFs({
          [tsLibFolder]: realTsLibFolder,
          ...files,
        }),
      createImportStatement(name: string, fileToImportFrom: string) {
        return `import { ${name} } from './${fileToImportFrom.replace('.ts', '')}'`
      },
      trimOutput: (output: string, lineEnding: LineEnding = LineEnding.LF) =>
        output
          .split(lineEnding)
          .map((line) => line.trim())
          .join(lineEnding),
    }
  }
}
