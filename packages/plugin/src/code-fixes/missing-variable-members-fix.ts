import ts from 'typescript/lib/tsserverlibrary'
import { Logger } from '../providers/provider'
import { CodeFix } from './fix'

export interface MissingVariableMembersArgs {
  /** can either be the pos/fullstart or start of a node */
  start: number
  end: number
  filePath: string
  program: ts.Program
  logger: Logger
}

export class MissingVariableMembersFix extends CodeFix implements ts.CodeFixAction {
  public static readonly supportedErrorCodes = [2739, 2740, 2741]

  public readonly fixName = 'declareMissingMembers'
  public readonly description = 'Declare missing members'
  public readonly changes: ts.FileTextChanges[]

  private readonly formattingOpts = { useSingleQuotes: true }

  public constructor(args: MissingVariableMembersArgs) {
    super(args)

    const sourceFile = this.getSourceFile(args.filePath)
    const { initializer, type } = this.getVariableInfo(sourceFile, args)
    const declaredMembers = this.getAlreadyDeclaredMemberNames(initializer)
    const undeclaredMembers = this.getExpectedMemberSymbols(type).filter((s) => !declaredMembers.has(s.name))

    const replacedInitializer = ts.factory.createObjectLiteralExpression(
      [...initializer.properties, ...undeclaredMembers.map(this.createMemberForSymbol)],
      true,
    )

    const newText = ts
      .createPrinter(
        { newLine: ts.NewLineKind.LineFeed },
        { substituteNode: (_, node) => (node === initializer ? replacedInitializer : node) },
      )
      .printNode(ts.EmitHint.Unspecified, initializer, sourceFile)

    this.changes = [
      {
        fileName: args.filePath,
        textChanges: [
          {
            newText: newText,
            span: { start: initializer.getStart(), length: initializer.getText().length },
          },
        ],
        isNewFile: false,
      },
    ]
  }

  public static supportsErrorCode = (code: number): boolean => {
    return MissingVariableMembersFix.supportedErrorCodes.includes(code)
  }

  private getVariableInfo(
    sourceFile: ts.SourceFile,
    { start, end }: NodeRange,
  ): { initializer: ts.ObjectLiteralExpression; type: ObjectDeclarationLike } {
    const matchesPosition = this.curryMatchesPosition(sourceFile, { start, end })
    const identifier = this.findChildNode(
      sourceFile,
      (node): node is ts.Identifier => matchesPosition(node) && ts.isIdentifier(node),
      `Could not find a node at pos ${start}:${end}`,
    )
    const { initializer, type: typeReference } = this.findParentNode(identifier, ts.isVariableDeclaration)

    if (!initializer || !ts.isObjectLiteralExpression(initializer)) {
      throw new Error('No initializer for the given variable')
    }

    if (!typeReference || !ts.isTypeReferenceNode(typeReference)) {
      throw new Error('No type reference for the given variable')
    }

    if (!ts.isIdentifier(typeReference.typeName)) {
      throw new Error('Type reference does not have an identifier on it')
    }

    const type = this.getTypeByIdentifier(typeReference.typeName)
    return { initializer, type }
  }

  private getAlreadyDeclaredMemberNames(initializer: ts.ObjectLiteralExpression): Set<string> {
    const { symbol } = this.typeChecker.getTypeAtLocation(initializer)
    const alreadyDeclaredMemberNames = new Set<string>()
    symbol.members?.forEach((member) => alreadyDeclaredMemberNames.add(member.name))
    return alreadyDeclaredMemberNames
  }

  private getExpectedMemberSymbols = (node: ObjectDeclarationLike): ts.Symbol[] => {
    const { symbol } = this.typeChecker.getTypeAtLocation(node)
    const expectedMembers: ts.Symbol[] = []
    symbol.members?.forEach((member) => expectedMembers.push(member))

    if (ts.isInterfaceDeclaration(node)) {
      const inheritedMemberSymbols = node.heritageClauses
        ?.flatMap((clause) => clause.types.map((type) => type.expression))
        .filter(ts.isIdentifier)
        .map(this.getTypeByIdentifier)
        .flatMap(this.getExpectedMemberSymbols)

      if (inheritedMemberSymbols) {
        expectedMembers.push(...inheritedMemberSymbols)
      }
    }

    return expectedMembers
  }

  private createMemberForSymbol = (memberSymbol: ts.Symbol): ts.PropertyAssignment => {
    const createInitializer = (memberSymbol: ts.Symbol): ts.Expression => {
      const propertySignature = memberSymbol.valueDeclaration
      if (!ts.isPropertySignature(propertySignature))
        throw new Error('The given symbol is not a property signature')

      if (propertySignature.type && ts.isLiteralTypeNode(propertySignature.type)) {
        if (propertySignature.type.literal.kind === ts.SyntaxKind.TrueKeyword) {
          return ts.factory.createTrue()
        }

        if (propertySignature.type.literal.kind === ts.SyntaxKind.FalseKeyword) {
          return ts.factory.createFalse()
        }
      }

      if (propertySignature.type && ts.isArrayTypeNode(propertySignature.type)) {
        return ts.factory.createArrayLiteralExpression()
      }

      if (propertySignature.type && ts.isArrayTypeNode(propertySignature.type)) {
        return ts.factory.createArrayLiteralExpression()
      }

      const type = this.typeChecker.getTypeAtLocation(propertySignature)

      if (type.flags & ts.TypeFlags.String) {
        return ts.factory.createStringLiteral('todo', this.formattingOpts.useSingleQuotes)
      }

      if (type.flags & ts.TypeFlags.Number) {
        return ts.factory.createNumericLiteral(0)
      }

      if (type.flags & ts.TypeFlags.Boolean) {
        return ts.factory.createFalse()
      }

      if (type.flags & ts.TypeFlags.EnumLiteral && type.isUnionOrIntersection() && type.aliasSymbol) {
        const firstEnumMember = type.aliasSymbol.exports?.keys().next().value.toString()

        return firstEnumMember
          ? ts.factory.createPropertyAccessExpression(
              ts.factory.createIdentifier(type.aliasSymbol.name),
              ts.factory.createIdentifier(firstEnumMember),
            )
          : ts.factory.createNull()
      }

      const typeDeclaration = type.getSymbol()?.valueDeclaration ?? type.getSymbol()?.declarations[0]
      if (
        typeDeclaration &&
        (ts.isTypeLiteralNode(typeDeclaration) || ts.isInterfaceDeclaration(typeDeclaration))
      ) {
        const memberSymbols = this.getExpectedMemberSymbols(typeDeclaration)
        return ts.factory.createObjectLiteralExpression(memberSymbols.map(this.createMemberForSymbol), true)
      }

      if (type.getSymbol()?.name === 'Date') {
        return ts.factory.createNewExpression(ts.factory.createIdentifier('Date'), undefined, [])
      }

      return ts.factory.createNull()
    }

    return ts.factory.createPropertyAssignment(
      ts.factory.createIdentifier(memberSymbol.name),
      createInitializer(memberSymbol),
    )
  }

  private isObjectDeclarationLike = (node: ts.Node | undefined): node is ObjectDeclarationLike => {
    return !!node && (ts.isTypeLiteralNode(node) || ts.isInterfaceDeclaration(node))
  }

  private getTypeByIdentifier = (identifier: ts.Identifier): ObjectDeclarationLike => {
    const { symbol } = this.typeChecker.getTypeAtLocation(identifier)
    const declaration = symbol.declarations[0]
    if (this.isObjectDeclarationLike(declaration)) {
      return declaration
    }

    throw new Error('The type of the variable is not an object declaration')
  }
}

export type NodeRange = Pick<MissingVariableMembersArgs, 'start' | 'end'>

type ObjectDeclarationLike = ts.TypeLiteralNode | ts.InterfaceDeclaration
