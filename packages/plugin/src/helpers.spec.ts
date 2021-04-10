import ts from 'typescript/lib/tsserverlibrary'
import { TSH } from './helpers'
import { createTestProgram, FsMocker, getNodeRange } from './test-helpers'

describe('Helpers', () => {
  afterEach(() => FsMocker.reset())

  describe('findChildNode', () => {
    it('can find child node that matches the given predicate', () => {
      const [filePath] = FsMocker.addFile(/* ts */ `
        interface Target {}
      `)

      const program = createTestProgram([filePath])
      const sourceFile = program.getSourceFile(filePath)!

      expect(TSH.findChildNode(sourceFile, ts.isInterfaceDeclaration, ':(')).toBeDefined()
    })
  })

  describe('findParentNode', () => {
    it('can find a parent node that matches the given predicate', () => {
      const [filePath] = FsMocker.addFile(/* ts */ `
        interface Target {
          hello: string
        }
      `)

      const program = createTestProgram([filePath])
      const sourceFile = program.getSourceFile(filePath)!
      const startingNode = TSH.findChildNode(sourceFile, ts.isPropertySignature, 'no property signature')

      expect(TSH.findParentNode(startingNode, ts.isInterfaceDeclaration, ':(')).toBeDefined()
    })
  })

  describe('findNodeAtPosition', () => {
    it('finds the node that has an error at a specific location', () => {
      const initializer = '{ greeting: "hello" }'
      const [filePath, fileContent] = FsMocker.addFile(/* ts */ `
        interface TargetType {
          greeting: string
        }
        export const target: TargetType = ${initializer}
      `)
      const errorPosition = getNodeRange(fileContent, initializer)

      const program = createTestProgram([filePath])
      const errorNode = TSH.findNodeAtPosition(program.getSourceFile(filePath)!, errorPosition)

      expect(errorNode.getText()).toBe(initializer)
    })
  })

  describe('getMembers', () => {
    const testCases: [string, string][] = [
      [
        'when the target is an InterfaceDeclaration',
        /* ts */ `interface TargetType { firstName: string; lastName: string }`,
      ],
      [
        'when the target is a TypeAliasDeclaration',
        /* ts */ `
        type TargetType = { firstName: string; lastName: string }

        `,
      ],
      [
        'when the target is a partial',
        /* ts */ `type TargetType = Partial<{ firstName: string; lastName: string }>

        `,
      ],
      [
        'when the target is a record',
        /* ts */ `type TargetType = Record<'firstName' | 'lastName', string>

        `,
      ],
    ]

    function getMembers(text: string): ReturnType<typeof TSH['getMembers']> {
      const [filePath, fileContent] = FsMocker.addFile(text)
      const program = createTestProgram([filePath])
      const typeChecker = program.getTypeChecker()
      const sourceFile = program.getSourceFile(filePath)!
      const identifier = TSH.findNodeAtPosition(sourceFile, getNodeRange(fileContent, 'TargetType'))

      const symbol = typeChecker.getSymbolAtLocation(identifier)
      if (!symbol) throw new Error('Test setup failed. No symbol for TargetType')

      return TSH.getMembers(symbol, typeChecker)
    }

    it.each(testCases)('works %s', (_, text) => {
      const members = getMembers(text)

      const expectedProperties = ['firstName', 'lastName']
      expect(members.size).toBe(expectedProperties.length)
      expectedProperties.forEach((name) =>
        expect(members.get(name)!.type.flags).toIncludeBitwise(ts.TypeFlags.String),
      )
    })

    it('works for records with literal values', () => {
      const members = getMembers(/* ts */ `type TargetType = Record<'target', { hello: 'world' }>

      `)

      const member = members.get('target')!
      expect(member.type.flags).toIncludeBitwise(ts.TypeFlags.Object)
    })

    it('works when there is no intermediary type refernece', () => {
      const [
        filePath,
        fileContent,
      ] = FsMocker.addFile(/* ts */ `export const target: Record<'hello', string> = { hello: 'hi' }
      `)
      const program = createTestProgram([filePath])
      const typeChecker = program.getTypeChecker()
      const sourceFile = program.getSourceFile(filePath)!
      const identifier = TSH.findNodeAtPosition(sourceFile, getNodeRange(fileContent, 'target'))

      const symbol = typeChecker.getSymbolAtLocation(identifier)
      if (!symbol) throw new Error('Test setup failed. No symbol for TargetType')

      const members = TSH.getMembers(symbol, typeChecker)
      expect(members.size).toBe(1)
      expect(members.get('hello')?.type.flags).toIncludeBitwise(ts.TypeFlags.String)
    })
  })

  describe('assertSymbolsAreCompatible', () => {
    const assertSymbolsAreCompatible = (filePath: string) => () => {
      const program = createTestProgram([filePath])
      const sourceFile = program.getSourceFile(filePath)!
      const typeChecker = program.getTypeChecker()
      const symbols = typeChecker.getSymbolsInScope(sourceFile, ts.SymbolFlags.ModuleMember)

      const targetSymbol = symbols.find((x) => x.name === 'Symbol1')
      if (!targetSymbol) throw new Error(`could not get Symbol1`)

      const symbolToCompare = symbols.find((x) => x.name === 'Symbol2')
      if (!symbolToCompare) throw new Error(`could not get Symbol2`)

      TSH.assertSymbolsAreCompatible(ts, typeChecker, targetSymbol, symbolToCompare)
    }

    it('returns true if the symbols have the same members', () => {
      const [filePath] = FsMocker.addFile(/* ts */ `
        interface Symbol1 {
          name: string
          age: number
        }
        
        interface Symbol2 {
          name: string
          age: number
        }
      `)

      expect(assertSymbolsAreCompatible(filePath)).not.toThrowError()
    })

    it('returns true if the symbol to compare has extra members', () => {
      const [filePath] = FsMocker.addFile(/* ts */ `
        interface Symbol1 {
          name: string
          age: number
        }
        
        interface Symbol2 {
          name: string
          age: number
          birthday: Date
        }
      `)

      expect(assertSymbolsAreCompatible(filePath)).not.toThrowError()
    })

    it('returns false if the symbols do not have the same top level members', () => {
      const [filePath] = FsMocker.addFile(/* ts */ `
        interface Symbol1 {
          name: string
          age: number
        }
        
        interface Symbol2 {
          name: string
        }
      `)

      expect(assertSymbolsAreCompatible(filePath)).toThrowError('Required member "age" missing')
    })

    it('returns true if the symbol to compare is missing an optional member', () => {
      const [filePath] = FsMocker.addFile(/* ts */ `
        interface Symbol1 {
          name: string
          age?: number
        }
        
        interface Symbol2 {
          name: string
        }
      `)

      expect(assertSymbolsAreCompatible(filePath)).not.toThrowError()
    })

    it('return false if the members are the same but the types are mismatched', () => {
      const [filePath] = FsMocker.addFile(/* ts */ `
        interface Symbol1 {
          name: string
          age: number
        }
        
        interface Symbol2 {
          name: string
          age: boolean
        }
      `)

      expect(assertSymbolsAreCompatible(filePath)).toThrowError('Symbol flags for "age" do not match')
    })

    it('returns true if the symbols are deeply compatible', () => {
      const [filePath] = FsMocker.addFile(/* ts */ `
        interface NestedAsInterface {
          age: number
        }

        interface Symbol1 {
          name: string
          nested: { age: number }
        }
        
        interface Symbol2 {
          name: string
          nested: NestedAsInterface
        }
      `)

      expect(assertSymbolsAreCompatible(filePath)).not.toThrowError()
    })

    it('returns false if the symbols are not deeply compatible', () => {
      const [filePath] = FsMocker.addFile(/* ts */ `
        interface NestedAsInterface {
          age: number
        }

        interface Symbol1 {
          name: string
          nested: NestedAsInterface
        }
        
        interface Symbol2 {
          name: string
          nested: { age: boolean }
        }
      `)

      expect(assertSymbolsAreCompatible(filePath)).toThrowError('Symbol flags for "age" do not match')
    })
  })
})
