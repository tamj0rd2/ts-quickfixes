import { Logger } from '../providers/provider'
import { MissingVariableMembersArgs } from './missing-variable-members-fix'

export type ts = typeof import('typescript/lib/tsserverlibrary')

export interface CodeFixArgs {
  program: ts.Program
  logger: Logger
  ts: ts
}

export abstract class CodeFix implements ts.CodeFixAction {
  public abstract readonly fixName: string
  public abstract readonly description: string
  public abstract readonly changes: ts.FileTextChanges[]

  protected readonly ts: ts
  protected readonly program: ts.Program
  protected readonly typeChecker: ts.TypeChecker
  protected readonly logger: Logger
  private readonly formattingOpts = { useSingleQuotes: true }

  constructor(args: CodeFixArgs) {
    this.ts = args.ts
    this.program = args.program
    this.typeChecker = args.program.getTypeChecker()
    this.logger = args.logger
  }

  protected getSourceFile(filePath: string): ts.SourceFile {
    const sourceFile = this.program.getSourceFile(filePath)
    if (sourceFile) return sourceFile

    throw new Error(`expected to get a sourcefile for ${filePath}`)
  }

  protected findChildNode<T extends ts.Node>(
    rootNode: ts.Node,
    predicate: (node: ts.Node) => node is T,
    failureMessage: string,
  ): T {
    let foundNode: T | undefined

    rootNode.forEachChild((child) => {
      if (foundNode) return
      if (predicate(child)) {
        foundNode = child
        return
      }

      try {
        foundNode = this.findChildNode(child, predicate, failureMessage)
      } catch {
        // ignore
      }
    })

    if (foundNode) return foundNode
    throw new Error(failureMessage)
  }

  protected findParentNode<T extends ts.Node>(
    startingNode: ts.Node,
    predicate: (node: ts.Node) => node is T,
    failureMessage = 'Node not found',
  ): T {
    const parent = startingNode.parent
    if (!parent) {
      throw new Error(failureMessage ?? 'Could not find a matching parent node')
    }

    return predicate(parent) ? parent : this.findParentNode(parent, predicate, failureMessage)
  }

  protected curryMatchesPosition = (sourceFile: ts.SourceFile, position: { start: number; end: number }) => (
    node: ts.Node,
  ): boolean => {
    return [node.pos, node.getStart(sourceFile, true)].includes(position.start) && node.end === position.end
  }

  protected getUndeclaredMemberSymbols = (
    initializer: ts.ObjectLiteralExpression,
    expectedType: ObjectDeclarationLike,
  ): ts.Symbol[] => {
    const declaredMembers = this.getAlreadyDeclaredMemberNames(initializer)
    return this.getExpectedMemberSymbols(expectedType).filter((s) => !declaredMembers.has(s.name))
  }

  protected isObjectDeclarationLike = (node: ts.Node | undefined): node is ObjectDeclarationLike => {
    return !!node && (this.ts.isTypeLiteralNode(node) || this.ts.isInterfaceDeclaration(node))
  }

  protected getTypeNodeByIdentifier = (identifier: ts.Identifier): ObjectDeclarationLike => {
    const { symbol } = this.typeChecker.getTypeAtLocation(identifier)
    const declaration = symbol.declarations[0]
    this.logger.logNode(declaration, 'declaration')

    if (this.isObjectDeclarationLike(declaration)) {
      return declaration
    }

    throw new Error('The type of the variable is not an object declaration')
  }

  protected getReplacedObject(
    sourceFile: ts.SourceFile,
    originalInitializer: ts.ObjectLiteralExpression,
    additionalMemberSymbols: ts.Symbol[],
  ): string {
    const replacedInitializer = this.ts.factory.createObjectLiteralExpression(
      [...originalInitializer.properties, ...additionalMemberSymbols.map(this.createMemberForSymbol)],
      true,
    )

    return this.ts
      .createPrinter(
        { newLine: this.ts.NewLineKind.LineFeed },
        { substituteNode: (_, node) => (node === originalInitializer ? replacedInitializer : node) },
      )
      .printNode(this.ts.EmitHint.Unspecified, originalInitializer, sourceFile)
  }

  protected createMemberForSymbol = (memberSymbol: ts.Symbol): ts.PropertyAssignment => {
    const createInitializer = (memberSymbol: ts.Symbol): ts.Expression => {
      const propertySignature = memberSymbol.valueDeclaration
      if (!this.ts.isPropertySignature(propertySignature))
        throw new Error('The given symbol is not a property signature')

      if (propertySignature.type && this.ts.isLiteralTypeNode(propertySignature.type)) {
        if (propertySignature.type.literal.kind === this.ts.SyntaxKind.TrueKeyword) {
          return this.ts.factory.createTrue()
        }

        if (propertySignature.type.literal.kind === this.ts.SyntaxKind.FalseKeyword) {
          return this.ts.factory.createFalse()
        }
      }

      if (propertySignature.type && this.ts.isArrayTypeNode(propertySignature.type)) {
        return this.ts.factory.createArrayLiteralExpression()
      }

      if (propertySignature.type && this.ts.isArrayTypeNode(propertySignature.type)) {
        return this.ts.factory.createArrayLiteralExpression()
      }

      const type = this.typeChecker.getTypeAtLocation(propertySignature)

      if (type.flags & this.ts.TypeFlags.String) {
        return this.ts.factory.createStringLiteral('todo', this.formattingOpts.useSingleQuotes)
      }

      if (type.flags & this.ts.TypeFlags.Number) {
        return this.ts.factory.createNumericLiteral(0)
      }

      if (type.flags & this.ts.TypeFlags.Boolean) {
        return this.ts.factory.createFalse()
      }

      if (type.flags & this.ts.TypeFlags.EnumLiteral && type.isUnionOrIntersection() && type.aliasSymbol) {
        const firstEnumMember = (type.aliasSymbol.exports?.keys().next().value as ts.__String)?.toString()

        return firstEnumMember
          ? this.ts.factory.createPropertyAccessExpression(
              this.ts.factory.createIdentifier(type.aliasSymbol.name),
              this.ts.factory.createIdentifier(firstEnumMember),
            )
          : this.ts.factory.createNull()
      }

      const typeDeclaration = type.getSymbol()?.valueDeclaration ?? type.getSymbol()?.declarations[0]
      if (
        typeDeclaration &&
        (this.ts.isTypeLiteralNode(typeDeclaration) || this.ts.isInterfaceDeclaration(typeDeclaration))
      ) {
        const memberSymbols = this.getExpectedMemberSymbols(typeDeclaration)
        return this.ts.factory.createObjectLiteralExpression(
          memberSymbols.map(this.createMemberForSymbol),
          true,
        )
      }

      if (type.getSymbol()?.name === 'Date') {
        return this.ts.factory.createNewExpression(this.ts.factory.createIdentifier('Date'), undefined, [])
      }

      return this.ts.factory.createNull()
    }

    return this.ts.factory.createPropertyAssignment(
      this.ts.factory.createIdentifier(memberSymbol.name),
      createInitializer(memberSymbol),
    )
  }

  protected derefTypeReferenceNode(typeReference: ts.TypeReferenceNode): ObjectDeclarationLike {
    if (!this.ts.isIdentifier(typeReference.typeName)) {
      throw new Error('TypeReference typeName does not have an identifier')
    }

    return this.getTypeNodeByIdentifier(typeReference.typeName)
  }

  protected TODO(prefix: string): never {
    throw new Error(`not yet implemented - ${prefix}`)
  }

  private getAlreadyDeclaredMemberNames = (initializer: ts.ObjectLiteralExpression): Set<string> => {
    const { symbol } = this.typeChecker.getTypeAtLocation(initializer)
    const alreadyDeclaredMemberNames = new Set<string>()
    symbol.members?.forEach((member) => alreadyDeclaredMemberNames.add(member.name))
    return alreadyDeclaredMemberNames
  }

  private getExpectedMemberSymbols = (node: ObjectDeclarationLike): ts.Symbol[] => {
    const { symbol } = this.typeChecker.getTypeAtLocation(node)
    const expectedMembers: ts.Symbol[] = []
    symbol.members?.forEach((member) => expectedMembers.push(member))

    if (this.ts.isInterfaceDeclaration(node)) {
      const inheritedMemberSymbols = node.heritageClauses
        ?.flatMap((clause) => clause.types.map((type) => type.expression))
        .filter(this.ts.isIdentifier)
        .map(this.getTypeNodeByIdentifier)
        .flatMap(this.getExpectedMemberSymbols)

      if (inheritedMemberSymbols) {
        expectedMembers.push(...inheritedMemberSymbols)
      }
    }

    return expectedMembers
  }
}

export type NodeRange = Pick<MissingVariableMembersArgs, 'start' | 'end'>

export type ObjectDeclarationLike = ts.TypeLiteralNode | ts.InterfaceDeclaration
