import { CodeFix, CodeFixArgs, NodeRange } from './fix'

interface MissingObjectMembersArgs extends CodeFixArgs {
  filePath: string
  start: number
  end: number
}

export class MissingObjectMembersFix extends CodeFix {
  public static readonly supportedErrorCodes = [2739, 2740, 2741]
  public static supportsErrorCode = (code: number): boolean => {
    return MissingObjectMembersFix.supportedErrorCodes.includes(code)
  }

  public readonly fixName = 'declareMissingObjectMembers'
  public readonly description = 'Declare missing object members'
  public readonly changes: ts.FileTextChanges[]

  constructor(args: MissingObjectMembersArgs) {
    super(args)

    const sourceFile = this.getSourceFile(args.filePath)
    const initializer = this.getInitializer(sourceFile, args)

    this.logger.logNode(initializer, 'objectLiteral')

    const { expectedTypeNode } = this.getExpectedTypeNodeForObject(initializer)
    const undeclaredMembers = this.getUndeclaredMemberSymbols(initializer, expectedTypeNode)
    const newText = this.getReplacedObject(sourceFile, initializer, undeclaredMembers)

    this.changes = [
      {
        fileName: args.filePath,
        textChanges: [
          {
            newText,
            span: { start: initializer.getStart(), length: initializer.getText().length },
          },
        ],
        isNewFile: false,
      },
    ]
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  private getExpectedTypeNodeForObject(objectLiteral: ts.ObjectLiteralExpression) {
    const { propertyName } = this.getPropertyInfo(objectLiteral)
    const { expectedVariableTypeNode } = this.getVariableInfo(objectLiteral)

    const wantedMember = expectedVariableTypeNode.members.find(
      (m): m is ts.PropertySignature => m.name?.getText() === propertyName && this.ts.isPropertySignature(m),
    )
    if (!wantedMember) this.TODO(`Could not find definition for the member ${propertyName}`)
    if (!this.ts.isIdentifier(wantedMember.name)) this.TODO(`Member ${propertyName} not an identifier`)

    const expectedTypeNode = this.getTypeNodeByIdentifier(wantedMember.name)
    this.logger.logNode(expectedTypeNode, 'wantedMemberType')

    return { expectedTypeNode }
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  private getPropertyInfo(objectLiteral: ts.ObjectLiteralExpression) {
    const propertyAssignment = this.findParentNode(objectLiteral, this.ts.isPropertyAssignment)
    this.logger.logNode(propertyAssignment, 'propertyAssignment')

    const propertyName = propertyAssignment.name
    this.logger.logNode(propertyName, 'propertyName')

    return { propertyAssignment, propertyName: propertyName.getText() as ts.__String }
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  private getVariableInfo(objectLiteral: ts.ObjectLiteralExpression) {
    const variableDeclaration = this.findParentNode(objectLiteral, this.ts.isVariableDeclaration)
    this.logger.logNode(variableDeclaration, 'variableDeclaration')

    const variableType = this.findChildNode(
      variableDeclaration,
      this.ts.isTypeReferenceNode,
      `could not find variable declaration for ${objectLiteral.getText()}`,
    )
    this.logger.logNode(variableType, 'variableType')

    if (!this.ts.isIdentifier(variableType.typeName)) {
      this.TODO('type reference typeName is not an identifier')
    }

    const expectedVariableTypeNode = this.getTypeNodeByIdentifier(variableType.typeName)
    this.logger.logNode(expectedVariableTypeNode, 'expectedVariableTypeNode')

    const expectedVariableType = this.typeChecker.getTypeAtLocation(expectedVariableTypeNode)

    return {
      expectedVariableTypeNode,
      expectedVariableType,
      expectedVariableSymbol: expectedVariableType.symbol,
    }
  }

  private getInitializer(sourceFile: ts.SourceFile, { start, end }: NodeRange): ts.ObjectLiteralExpression {
    const matchesPosition = this.curryMatchesPosition(sourceFile, { start, end })
    const identifier = this.findChildNode(
      sourceFile,
      (node): node is ts.Identifier => matchesPosition(node) && this.ts.isIdentifier(node),
      `Could not find a node at pos ${start}:${end}`,
    )

    const { initializer } = this.findParentNode(
      identifier,
      this.ts.isPropertyAssignment,
      'Could not find a property assignment',
    )

    if (!initializer || !this.ts.isObjectLiteralExpression(initializer)) {
      throw new Error('No initializer for the given variable')
    }

    return initializer
  }
}
