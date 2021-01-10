import ts from 'typescript/lib/tsserverlibrary'
import { MissingArgumentMembersFix } from './missing-argument-members-fix'
import { createDummyLogger, createTestProgram, FsMocker, getNodeRange } from '../test-helpers'

describe('Fill Missing Argument Member', () => {
  afterEach(() => FsMocker.reset())

  it('fills in undeclared argument members when none are declared', () => {
    const argumentValue = '{}'
    const [filePath, fileContent] = FsMocker.addFile(`
      function targetFunction(someArgument: { min: number; max: number } ) {
        return 123
      }
      export const functionOutput = targetFunction(${argumentValue})
    `)

    const initializerLocation = getNodeRange(fileContent, argumentValue)
    const fix = new MissingArgumentMembersFix({
      filePath,
      ts,
      program: createTestProgram([filePath], MissingArgumentMembersFix.supportedErrorCodes),
      logger: createDummyLogger(),
      ...initializerLocation,
    })

    expect(fix.changes).toStrictEqual<ts.FileTextChanges[]>([
      {
        fileName: filePath,
        textChanges: [
          {
            span: { start: initializerLocation.start, length: argumentValue.length },
            newText: `{ min: 0, max: 0 }`,
          },
        ],
        isNewFile: false,
      },
    ])
  })

  it('fills in undeclared argument members when some are declared', () => {
    const argumentValue = '{ max: 123 }'
    const [filePath, fileContent] = FsMocker.addFile(`
      function targetFunction(someArgument: { min: number; max: number } ) {
        return 123
      }
      export const functionOutput = targetFunction(${argumentValue})
    `)

    const initializerLocation = getNodeRange(fileContent, argumentValue)
    const fix = new MissingArgumentMembersFix({
      filePath,
      ts,
      program: createTestProgram([filePath], MissingArgumentMembersFix.supportedErrorCodes),
      logger: createDummyLogger(),
      ...initializerLocation,
    })

    expect(fix.changes).toStrictEqual<ts.FileTextChanges[]>([
      {
        fileName: filePath,
        textChanges: [
          {
            span: { start: initializerLocation.start, length: argumentValue.length },
            newText: `{ max: 123, min: 0 }`,
          },
        ],
        isNewFile: false,
      },
    ])
  })

  it('fills in undeclared argument members that were defined in an interface', () => {
    const argumentValue = '{}'
    const [filePath, fileContent] = FsMocker.addFile(`
      interface TargetArgs {
        name: string
        date: Date
      }
      function targetFunction(someArgument: TargetArgs) {
        return 123
      }
      export const functionOutput = targetFunction(${argumentValue})
    `)

    const initializerLocation = getNodeRange(fileContent, argumentValue)
    const fix = new MissingArgumentMembersFix({
      filePath,
      ts,
      program: createTestProgram([filePath], MissingArgumentMembersFix.supportedErrorCodes),
      logger: createDummyLogger(),
      ...initializerLocation,
    })

    expect(fix.changes).toStrictEqual<ts.FileTextChanges[]>([
      {
        fileName: filePath,
        textChanges: [
          {
            span: { start: initializerLocation.start, length: argumentValue.length },
            newText: `{ name: 'todo', date: new Date() }`,
          },
        ],
        isNewFile: false,
      },
    ])
  })
})
