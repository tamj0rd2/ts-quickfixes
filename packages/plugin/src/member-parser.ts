import ts from 'typescript'
import {
  BooleanMember,
  EnumMember,
  NumberMember,
  StringMember,
  ArrayMember,
  UnimplementedMember,
} from './members/simple-types'
import { Member } from './members/member'
import { ObjectLiteralMember } from './members/object-literal-member'

export class MemberParser {
  private readonly typeChecker: ts.TypeChecker
  private readonly program: ts.Program

  constructor(program: ts.Program) {
    this.program = program
    this.typeChecker = this.program.getTypeChecker()
  }

  public getMissingMembersForVariable(variableName: string, filePath: string): ObjectLiteralMember {
    const sourceFile = this.getSourceFile(filePath)
    const { initializer, type } = this.getInitializedVariableDeclaration(variableName, sourceFile)

    const declaredProperties = initializer.properties.reduce((properties, propertyNode) => {
      const propertyName = propertyNode.name?.getText()
      if (propertyName) properties.add(propertyName)
      return properties
    }, new Set<string>())

    const { symbol } = this.typeChecker.getTypeAtLocation(type)
    return this.collectMembersFromInterfaceOrTypeSymbol(symbol, declaredProperties, undefined)
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

  public fillMissingMembers(variableName: string, filePath: string): string {
    const sourceFile = this.getSourceFile(filePath)
    const variableDeclaration = this.getInitializedVariableDeclaration(variableName, sourceFile)

    const missingMembers = this.getMissingMembersForVariable(variableName, filePath)

    const newInitialiser = ts.factory.updateObjectLiteralExpression(variableDeclaration.initializer, [
      ...variableDeclaration.initializer.properties,
      ...missingMembers.toArray().map((member) => member.createPropertyAssignment()),
    ])

    return ts
      .createPrinter(undefined, {
        substituteNode: (_, node) => (node === variableDeclaration.initializer ? newInitialiser : node),
      })
      .printNode(ts.EmitHint.Unspecified, variableDeclaration.initializer, sourceFile)
  }

  private getInitializedVariableDeclaration(
    variableName: string,
    sourceFile: ts.SourceFile,
  ): {
    name: ts.BindingName
    initializer: ts.ObjectLiteralExpression
    type: ts.TypeReferenceNode
    node: ts.VariableDeclaration
  } {
    const node = this.findNode(
      sourceFile,
      (node): node is ts.VariableDeclaration => {
        if (!ts.isVariableDeclaration(node)) return false
        return node.name.getText() === variableName
      },
      `Could not find a variable identifier for ${variableName}`,
    )
    const { name, initializer, type } = node

    if (!initializer) throw new Error(`There is no initializer for ${variableName}`)
    if (!ts.isObjectLiteralExpression(initializer))
      throw new Error(`Variable ${variableName} is not an object literal`)
    if (!type || !ts.isTypeReferenceNode(type))
      throw new Error('Only typed variables are supported right now')

    return { name, initializer, type, node }
  }

  private collectMembersFromSymbol(symbol: ts.Symbol, memberName: string): Member | undefined {
    const { flags, name } = symbol

    switch (flags) {
      case ts.SymbolFlags.Interface:
        return this.collectMembersFromInterfaceOrTypeSymbol(symbol, undefined, memberName)
      case ts.SymbolFlags.Property:
        return this.collectMembersFromPropertySymbol(symbol)
      default:
        throw new Error(`unhandled symbol flag ${ts.SymbolFlags[flags]} for symbol ${name}`)
    }
  }

  private collectMembersFromInterfaceOrTypeSymbol(
    { flags, name, members, declarations }: ts.Symbol,
    membersToIgnore: ReadonlySet<string> | undefined,
    memberName: string | undefined,
  ): ObjectLiteralMember {
    if (![ts.SymbolFlags.Interface, ts.SymbolFlags.TypeLiteral].includes(flags))
      throw new Error(`Expected ${name} to be an interface or type literal`)

    if (!members) throw new Error(`symbol ${name} has no members`)

    const groupedMembers = memberName
      ? new ObjectLiteralMember(memberName)
      : ObjectLiteralMember.createTopLevel()

    members.forEach((member) => {
      if (membersToIgnore?.has(member.name)) return
      const memberToAdd = this.collectMembersFromSymbol(member, member.name)

      if (memberToAdd) groupedMembers.addMember(memberToAdd)
    })

    return declarations
      .filter((declaration): declaration is ts.InterfaceDeclaration => ts.isInterfaceDeclaration(declaration))
      .flatMap((declaration) => declaration.heritageClauses)
      .flatMap((heritageClause) => heritageClause?.types)
      .flatMap(
        (heritageTypeNode) =>
          heritageTypeNode && this.typeChecker.getTypeAtLocation(heritageTypeNode.expression),
      )
      .reduce((groupedMembers, inheritedType) => {
        if (!inheritedType) return groupedMembers
        const inheritedSymbol = inheritedType.symbol

        const inheritedMembers = this.collectMembersFromInterfaceOrTypeSymbol(
          inheritedSymbol,
          new Set(Object.keys(groupedMembers)),
          memberName,
        )

        return groupedMembers.concat(inheritedMembers)
      }, groupedMembers)
  }

  private collectMembersFromPropertySymbol(symbol: ts.Symbol): Member | undefined {
    const { name, valueDeclaration } = symbol
    if (!ts.isPropertySignature(valueDeclaration)) throw new Error('Not a property signature')
    if (!valueDeclaration.type) throw new Error('Value declaration does not have a type')

    switch (valueDeclaration.type.kind) {
      case ts.SyntaxKind.StringKeyword:
        return new StringMember(name)
      case ts.SyntaxKind.NumberKeyword:
        return new NumberMember(name)
      case ts.SyntaxKind.BooleanKeyword:
        return new BooleanMember(name)
      case ts.SyntaxKind.UnionType:
        return new UnimplementedMember(name)
      case ts.SyntaxKind.ArrayType:
        return new ArrayMember(name)
      case ts.SyntaxKind.TypeLiteral:
      case ts.SyntaxKind.TypeReference: {
        const typeReferenceType = this.typeChecker.getTypeAtLocation(valueDeclaration.type)
        if (typeReferenceType.symbol.flags === 33554497) return new UnimplementedMember(name)

        if ([ts.SymbolFlags.Interface, ts.SymbolFlags.TypeLiteral].includes(typeReferenceType.symbol.flags))
          return this.collectMembersFromInterfaceOrTypeSymbol(typeReferenceType.symbol, undefined, name)

        if (typeReferenceType.symbol.flags === ts.SymbolFlags.RegularEnum) {
          const firstEnumName = typeReferenceType.symbol.exports?.keys().next().value.toString()
          return firstEnumName
            ? new EnumMember(name, typeReferenceType.symbol.name, firstEnumName)
            : undefined
        }

        throw new Error(
          `Unsupported type reference node kind ${
            ts.SymbolFlags[typeReferenceType.symbol.flags]
          } for ${name}`,
        )
      }

      default:
        throw new Error(
          `Symbol ${name} is an unhandled syntax kind ${ts.SyntaxKind[valueDeclaration.type.kind]}`,
        )
    }
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
