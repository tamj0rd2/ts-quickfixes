import { TSH } from './helpers'
import { Logger } from './providers/provider'

export namespace DeclareMissingObjectMembers {
  export const supportedErrorCodes: number[] = [2739, 2741]

  interface Args extends TSH.NodePosition {
    filePath: string
    program: ts.Program
    logger: Logger
    ts: TSH.ts
  }

  export function createFix({ program, ts, logger, ...args }: Args): ts.CodeFixAction {
    const sourceFile = TSH.getSourceFile(args.filePath, program)
    const errorNode = TSH.findNodeAtPosition(sourceFile, args)

    const identifier = TSH.cast(errorNode, ts.isIdentifier)
    const variableDeclaration = TSH.cast(identifier.parent, ts.isVariableDeclaration)
    const typeReference = TSH.cast(variableDeclaration.type, ts.isTypeReferenceNode)
    const typeReferenceIdentifier = TSH.cast(typeReference.typeName, ts.isIdentifier)

    const typeChecker = program.getTypeChecker()
    const { symbol } = typeChecker.getTypeAtLocation(typeReferenceIdentifier)
    const initializer = TSH.cast(variableDeclaration.initializer, ts.isObjectLiteralExpression)

    const newInitializer = TSH.Generate.objectLiteral(ts, typeChecker, sourceFile, initializer, symbol)

    return {
      description: 'Declare missing members',
      changes: [
        {
          fileName: args.filePath,
          textChanges: [
            {
              newText: newInitializer,
              span: { start: initializer.getStart(), length: initializer.getText().length },
            },
          ],
          isNewFile: false,
        },
      ],
      fixName: 'declareMissingMembers',
      commands: undefined,
      fixAllDescription: undefined,
      fixId: undefined,
    }
  }
}
