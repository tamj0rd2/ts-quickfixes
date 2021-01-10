import { CodeFix, CodeFixArgs, ObjectDeclarationLike } from './fix'

interface MissingArgumentMembersArgs extends CodeFixArgs {
  filePath: string
  start: number
  end: number
}

export class MissingArgumentMembersFix extends CodeFix {
  public static readonly supportedErrorCodes = [2345]
  public static supportsErrorCode = (code: number): boolean => {
    return MissingArgumentMembersFix.supportedErrorCodes.includes(code)
  }

  public readonly fixName = 'declareMissingArgumentMembers'
  public readonly description = 'Declare missing argument members'
  public readonly changes: ts.FileTextChanges[]

  constructor(args: MissingArgumentMembersArgs) {
    super(args)

    const sourceFile = this.getSourceFile(args.filePath)
    const { value, expectedType } = this.getArgumentInfo(sourceFile, args)
    const undeclaredMembers = this.getUndeclaredMemberSymbols(value, expectedType)

    const replacedInitializer = this.ts.factory.createObjectLiteralExpression(
      [...value.properties, ...undeclaredMembers.map(this.createMemberForSymbol)],
      false,
    )

    const newText = this.ts
      .createPrinter(
        { newLine: this.ts.NewLineKind.LineFeed },
        { substituteNode: (_, node) => (node === value ? replacedInitializer : node) },
      )
      .printNode(this.ts.EmitHint.Unspecified, value, sourceFile)

    this.changes = [
      {
        fileName: args.filePath,
        textChanges: [
          {
            newText: newText,
            span: { start: value.getStart(), length: value.getText().length },
          },
        ],
        isNewFile: false,
      },
    ]
  }

  private getArgumentInfo(
    sourceFile: ts.SourceFile,
    { start, end }: NodeRange,
  ): { value: ts.ObjectLiteralExpression; expectedType: ObjectDeclarationLike } {
    const matchesPosition = this.curryMatchesPosition(sourceFile, { start, end })
    const argumentValue = this.findChildNode(
      sourceFile,
      (node): node is ts.ObjectLiteralExpression =>
        matchesPosition(node) && this.ts.isObjectLiteralExpression(node),
    )

    const callExpression = this.findParentNode(argumentValue, this.ts.isCallExpression)
    const argumentIndex = callExpression.arguments.findIndex((arg) => arg === argumentValue)
    if (argumentIndex < 0) {
      TODO('Invalid argument index')
    }

    const { symbol: identifierSymbol } = this.typeChecker.getTypeAtLocation(callExpression.expression)
    if (
      !identifierSymbol.valueDeclaration ||
      !this.ts.isFunctionDeclaration(identifierSymbol.valueDeclaration)
    ) {
      TODO('no value declaration')
    }

    const functionDeclaration = identifierSymbol.valueDeclaration
    const expectedType = functionDeclaration.parameters[argumentIndex]?.type

    if (!expectedType) {
      TODO('could not find a matching parameter for that argument')
    }

    if (this.isObjectDeclarationLike(expectedType)) {
      return { value: argumentValue, expectedType }
    }

    if (this.ts.isTypeReferenceNode(expectedType) && this.ts.isIdentifier(expectedType.typeName)) {
      return { value: argumentValue, expectedType: this.getTypeByIdentifier(expectedType.typeName) }
    }

    throw new Error('found a paramter for that argument but it was an unsupported type')
  }
}

type NodeRange = Pick<MissingArgumentMembersArgs, 'start' | 'end'>

function TODO(prefix = ''): never {
  throw new Error(`not yet implemented - ${prefix}`)
}
