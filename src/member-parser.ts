import * as ts from 'typescript'
import { resolve } from 'path'

export const MemberType = {
  String: 'todo',
  Null: null,
  Number: 0,
  Union: null,
  BuiltIn: null,
} as const

type Member = typeof MemberType[keyof typeof MemberType] | Members
type Members = { [index: string]: Member }

export class MemberParser {
  private readonly sourceFile: ts.SourceFile
  private readonly typeChecker: ts.TypeChecker
  private readonly program: ts.Program

  constructor() {
    const filePath = resolve(process.cwd(), './test-environment/testing.ts')
    this.program = ts.createProgram([filePath], {
      noEmit: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.Latest,
    })

    const sourceFile = this.program.getSourceFile(filePath)
    if (!sourceFile) throw new Error(`expected to get a sourcefile for ${filePath}`)
    this.sourceFile = sourceFile

    this.typeChecker = this.program.getTypeChecker()
  }

  public getMissingMembersForVariable(variableName: string): Members {
    const { name, initializer } = this.findNode(
      this.sourceFile,
      (node): node is ts.VariableDeclaration => {
        if (!ts.isVariableDeclaration(node)) return false
        return node.name.getText() === variableName
      },
      `Could not find a variable identifier for ${variableName}`,
    )

    if (!initializer) throw new Error(`Could not find an initializer for ${variableName}`)
    if (!ts.isObjectLiteralExpression(initializer)) throw new Error(':O wat')
    const declaredProperties = initializer.properties.reduce((properties, propertyNode) => {
      const propertyName = propertyNode.name?.getText()
      if (propertyName) properties.add(propertyName)
      return properties
    }, new Set<string>())

    const members: Members = {}
    const typeSymbol = this.typeChecker.getTypeAtLocation(name).symbol
    typeSymbol.members?.forEach((symbol) => {
      if (declaredProperties.has(symbol.name)) return
      this.collectMembersFromSymbol(symbol, members)
    })
    return members
  }

  private collectMembersFromSymbol({ name, valueDeclaration }: ts.Symbol, members: Members): Member {
    if (!ts.isPropertySignature(valueDeclaration) || !valueDeclaration.type) {
      throw new Error(`bad property :O ${name}`)
    }

    const type = this.typeChecker.getTypeAtLocation(valueDeclaration.type)

    switch (type.flags) {
      case ts.TypeFlags.String:
        members[name] = MemberType.String
        break
      case ts.TypeFlags.Number:
        members[name] = MemberType.Number
        break
      case ts.TypeFlags.Union:
        members[name] = MemberType.Union
        break
      case ts.TypeFlags.Object: {
        const typeSymbol = type.getSymbol()
        if (!typeSymbol) throw new Error(`No type symbol found for ${name}`)

        if (
          typeSymbol
            .getDeclarations()
            ?.some((declaration) => this.program.isSourceFileDefaultLibrary(declaration.getSourceFile()))
        ) {
          members[name] = MemberType.BuiltIn
          break
        }

        if ([ts.SymbolFlags.TypeLiteral, ts.SymbolFlags.Interface].includes(typeSymbol.flags)) {
          const nestedMembers: Members = {}
          typeSymbol.members?.forEach((symbol) => this.collectMembersFromSymbol(symbol, nestedMembers))
          members[name] = nestedMembers
          break
        }
      }
      default:
        console.error(`unhandled object type for property ${name}`)
        members[name] = MemberType.Null
    }

    return members
  }

  private findNode<T extends ts.Node>(
    rootNode: ts.Node,
    predicate: (node: ts.Node) => node is T,
    failureMessage = 'Node not found',
  ): T {
    if (predicate(rootNode)) return rootNode as T

    for (const childNode of rootNode.getChildren()) {
      try {
        const foundNode = this.findNode(childNode, predicate)
        if (foundNode) return foundNode as T
      } catch (err) {
        // ignore
      }
    }

    throw new Error(failureMessage)
  }
}
