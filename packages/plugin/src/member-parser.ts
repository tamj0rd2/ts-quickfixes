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
  private readonly typeChecker: ts.TypeChecker
  private readonly program: ts.Program

  constructor(program: ts.Program) {
    this.program = program
    this.typeChecker = this.program.getTypeChecker()
  }

  public getMissingMembersForVariable(variableName: string, filePath: string): Members {
    const sourceFile = this.getSourceFile(filePath)
    const { name, initializer } = this.getInitializedVariableDeclaration(variableName, sourceFile)

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

  public getVariableInfo(variableName: string, filePath: string): VariableInfo {
    const sourceFile = this.getSourceFile(filePath)
    const { initializer } = this.getInitializedVariableDeclaration(variableName, sourceFile)

    const getPos = (pos: number): Position => {
      const { line, character } = sourceFile.getLineAndCharacterOfPosition(pos)
      return { line: line, character: character + 1, pos }
    }

    return {
      lines: initializer.properties.map((property) => property.getText()),
      start: getPos(initializer.pos),
      end: getPos(initializer.end),
    }
  }

  public getVariableNameAtLocation(start: number, end: number, filePath: string): string {
    const sourceFile = this.getSourceFile(filePath)
    return sourceFile.getFullText().slice(start, end)
  }

  private getInitializedVariableDeclaration(
    variableName: string,
    sourceFile: ts.SourceFile,
  ): { name: ts.BindingName; initializer: ts.ObjectLiteralExpression } {
    const { name, initializer } = this.findNode(
      sourceFile,
      (node): node is ts.VariableDeclaration => {
        if (!ts.isVariableDeclaration(node)) return false
        return node.name.getText() === variableName
      },
      `Could not find a variable identifier for ${variableName}`,
    )

    if (!initializer) throw new Error(`There is no initializer for ${variableName}`)
    if (!ts.isObjectLiteralExpression(initializer))
      throw new Error(`Variable ${variableName} is not an object literal`)

    return { name, initializer }
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

  private getSourceFile(filePath: string): ts.SourceFile {
    const sourceFile = this.program.getSourceFile(filePath)
    if (sourceFile) return sourceFile

    throw new Error(`expected to get a sourcefile for ${filePath}`)
  }
}

interface Position {
  /** lines are 0 indexed */
  line: number
  character: number
  pos: number
}

export interface VariableInfo {
  lines: string[]
  start: Position
  end: Position
}
