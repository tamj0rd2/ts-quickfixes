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

  const parsers = [directVariableDeclaration, nestedInsideVariableDeclaration]

  export function createFix(args: Args): ts.CodeFixAction {
    const { program, ts } = args
    const typeChecker = program.getTypeChecker()
    const sourceFile = TSH.getSourceFile(args.filePath, program)
    const errorNode = TSH.findNodeAtPosition(sourceFile, args)

    const infoOrError = parsers.reduce<ObjectInfo | Error>((result, parser) => {
      if (!(result instanceof Error)) return result

      try {
        return parser(args, errorNode)
      } catch (err) {
        return new Error(result.message + `\n${err.message}`)
      }
    }, new Error('Could not parse object info'))

    if (infoOrError instanceof Error) throw infoOrError
    const { initializer, symbol } = infoOrError

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

  function directVariableDeclaration({ program, ts }: Args, errorNode: ts.Node): ObjectInfo {
    const identifier = TSH.cast(errorNode, ts.isIdentifier)
    const variableDeclaration = TSH.cast(identifier.parent, ts.isVariableDeclaration)
    const typeReference = TSH.cast(variableDeclaration.type, ts.isTypeReferenceNode)
    const typeReferenceIdentifier = TSH.cast(typeReference.typeName, ts.isIdentifier)

    const typeChecker = program.getTypeChecker()
    const { symbol } = typeChecker.getTypeAtLocation(typeReferenceIdentifier)
    const initializer = TSH.cast(variableDeclaration.initializer, ts.isObjectLiteralExpression)

    return { initializer, symbol }
  }

  function nestedInsideVariableDeclaration({ program, ts }: Args, errorNode: ts.Node): ObjectInfo {
    const identifier = TSH.cast(errorNode, ts.isIdentifier)
    const propertyAssignment = TSH.cast(identifier.parent, ts.isPropertyAssignment)
    const propertyName = propertyAssignment.name.getText() as ts.__String
    const initializer = TSH.cast(propertyAssignment.initializer, ts.isObjectLiteralExpression)

    const variableDeclaration = TSH.cast(propertyAssignment.parent.parent, ts.isVariableDeclaration)
    const typeReference = TSH.cast(variableDeclaration.type, ts.isTypeReferenceNode)
    const typeReferenceIdentifier = TSH.cast(typeReference.typeName, ts.isIdentifier)

    const typeChecker = program.getTypeChecker()
    const { symbol: variableSymbol } = typeChecker.getTypeAtLocation(typeReferenceIdentifier)
    const memberSymbol = variableSymbol.members?.get(propertyName)
    if (!memberSymbol) {
      throw new Error(
        `The parent type ${variableSymbol.name} apparently doesn't have a member ${propertyName}`,
      )
    }

    const { symbol } = typeChecker.getTypeAtLocation(memberSymbol.valueDeclaration)

    return { initializer, symbol }
  }

  interface ObjectInfo {
    initializer: ts.ObjectLiteralExpression
    symbol: ts.Symbol
  }
}
