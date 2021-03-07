import { TSH } from './helpers'
import { Logger } from './providers/provider'

export namespace DeclareMissingObjectMembers {
  export const supportedErrorCodes: number[] = [2739, 2741]
  export const supportsErrorCode = (code: number): boolean => supportedErrorCodes.includes(code)

  interface Args extends TSH.NodePosition {
    filePath: string
    program: ts.Program
    logger: Logger
    ts: TSH.ts
  }

  const parsers = [
    forVariableDeclaration,
    // nestedInsideVariableDeclaration,
    withinVariableDeclaration,
  ]

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

  function forVariableDeclaration({ program, ts }: Args, errorNode: ts.Node): ObjectInfo {
    const identifier = TSH.cast(errorNode, ts.isIdentifier)
    const variableDeclaration = TSH.cast(identifier.parent, ts.isVariableDeclaration)
    const typeReference = TSH.cast(variableDeclaration.type, ts.isTypeReferenceNode)
    const typeReferenceIdentifier = TSH.cast(typeReference.typeName, ts.isIdentifier)

    const typeChecker = program.getTypeChecker()
    const { symbol } = typeChecker.getTypeAtLocation(typeReferenceIdentifier)
    const initializer = TSH.cast(variableDeclaration.initializer, ts.isObjectLiteralExpression)

    return { initializer, symbol }
  }

  function withinVariableDeclaration({ program, ts }: Args, errorNode: ts.Node): ObjectInfo {
    const identifier = TSH.cast(errorNode, ts.isIdentifier)
    const propertyAssignment = TSH.cast(identifier.parent, ts.isPropertyAssignment)
    const wantedPropertyName = propertyAssignment.name.getText()
    const parentPropertyNames = getParentPropertyNames(ts, propertyAssignment)

    const variableDeclaration = TSH.findParentNode(propertyAssignment, ts.isVariableDeclaration)
    const typeReference = TSH.cast(variableDeclaration.type, ts.isTypeReferenceNode)
    const typeReferenceIdentifier = TSH.cast(typeReference.typeName, ts.isIdentifier)

    const typeChecker = program.getTypeChecker()
    const { symbol: variableSymbol } = typeChecker.getTypeAtLocation(typeReferenceIdentifier)

    const symbol = [wantedPropertyName, ...parentPropertyNames].reduceRight((parentSymbol, propertyName) => {
      const memberSymbol = parentSymbol.members?.get(propertyName as ts.__String)
      if (!memberSymbol) throw new Error(`Type ${parentSymbol.name} has no member ${propertyName}`)

      return typeChecker.getTypeAtLocation(memberSymbol.valueDeclaration).symbol
    }, variableSymbol)
    const initializer = TSH.cast(propertyAssignment.initializer, ts.isObjectLiteralExpression)

    return { initializer, symbol }
  }

  function getParentPropertyNames(ts: TSH.ts, propertyAssignment: ts.PropertyAssignment): ts.__String[] {
    const propertyNames: ts.__String[] = []

    let nodePointer: ts.Node = propertyAssignment
    while (ts.isObjectLiteralExpression(nodePointer.parent)) {
      const objectLiteral = nodePointer.parent
      nodePointer = objectLiteral.parent

      if (ts.isPropertyAssignment(nodePointer)) {
        propertyNames.push(nodePointer.name.getText() as ts.__String)
        continue
      }

      if (ts.isVariableDeclaration(nodePointer)) {
        break
      }

      throw new Error(`Unhandled case where the initializer is not within a variable declaration`)
    }

    return propertyNames
  }

  interface ObjectInfo {
    initializer: ts.ObjectLiteralExpression
    symbol: ts.Symbol
  }
}
