import ts from 'typescript'

export const MemberType = {
  String: 'todo',
  Number: 0,
  Union: null,
  BuiltIn: null,
} as const

export type Member = typeof MemberType[keyof typeof MemberType] | Members
export type Members = { [index: string]: Member }

export class MemberParser {
  private readonly sourceFile: ts.SourceFile
  private readonly typeChecker: ts.TypeChecker
  private readonly program: ts.Program

  constructor(filePath: string) {
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
    const { name, initializer } = this.getVariableDeclaration(variableName)
    if (!initializer) throw new Error(`Could not find an initializer for ${variableName}`)
    if (!ts.isObjectLiteralExpression(initializer)) throw new Error(':O wat')

    const declaredProperties = initializer.properties.reduce((properties, propertyNode) => {
      const propertyName = propertyNode.name?.getText()
      if (propertyName) properties.add(propertyName)
      return properties
    }, new Set<string>())

    const members: Members = {}
    const { symbol } = this.typeChecker.getTypeAtLocation(name)
    symbol.members?.forEach((symbol) => {
      if (declaredProperties.has(symbol.name)) return
      this.collectMembersFromSymbol(symbol, members)
    })
    return members
  }

  public getVariableInfo(variableName: string): VariableInfo {
    const { initializer } = this.getVariableDeclaration(variableName)
    if (!initializer) throw new Error(`There is no initializer for ${variableName}`)

    const getPos = (pos: number): Position => {
      const { line, character } = this.sourceFile.getLineAndCharacterOfPosition(pos)
      return { line: line, character: character + 1 }
    }

    return {
      text: initializer.getText(),
      start: getPos(initializer.pos),
      end: getPos(initializer.end),
    }
  }

  private getVariableDeclaration(variableName: string): ts.VariableDeclaration {
    return this.findNode(
      this.sourceFile,
      (node): node is ts.VariableDeclaration => {
        if (!ts.isVariableDeclaration(node)) return false
        return node.name.getText() === variableName
      },
      `Could not find a variable identifier for ${variableName}`,
    )
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
        throw new Error(`unhandled object type for property ${name}`)
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

interface Position {
  /** lines are 0 indexed */
  line: number
  character: number
}

export interface VariableInfo {
  text: string
  start: Position
  end: Position
}
