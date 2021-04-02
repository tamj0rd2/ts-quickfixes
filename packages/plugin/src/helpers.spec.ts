import ts from 'typescript/lib/tsserverlibrary'
import { TSH } from './helpers'
import { createTestProgram, FsMocker, getNodeRange } from './test-helpers'

describe('Helpers', () => {
  afterEach(() => FsMocker.reset())

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
