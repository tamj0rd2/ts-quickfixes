import ts from 'typescript/lib/tsserverlibrary'
import { CodeFix, CodeFixArgs, NodeRange, ObjectDeclarationLike } from './fix'

export interface MissingVariableMembersArgs extends CodeFixArgs {
  /** can either be the pos/fullstart or start of a node */
  start: number
  end: number
  filePath: string
}

export class MissingVariableMembersFix extends CodeFix {
  public static readonly supportedErrorCodes = [2739, 2740, 2741]
  public static supportsErrorCode = (code: number): boolean => {
    return MissingVariableMembersFix.supportedErrorCodes.includes(code)
  }

  public readonly fixName = 'declareMissingMembers'
  public readonly description = 'Declare missing members'
  public readonly changes: ts.FileTextChanges[]

  public constructor(args: MissingVariableMembersArgs) {
    super(args)

    const sourceFile = this.getSourceFile(args.filePath)
    const { initializer, type } = this.getVariableInfo(sourceFile, args)
    const undeclaredMembers = this.getUndeclaredMemberSymbols(initializer, type)
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
}
