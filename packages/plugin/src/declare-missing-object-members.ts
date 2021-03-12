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

  const parsers = [variableDeclarationParser, withinVariableDeclarationParser, withinArray]

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
        return new Error(result.message + `\n${err.message} (${parser.name})`)
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

  function variableDeclarationParser({ program, ts }: Args, errorNode: ts.Node): ObjectInfo {
    const identifier = TSH.cast(errorNode, ts.isIdentifier)
    const variableDeclaration = TSH.cast(identifier.parent, ts.isVariableDeclaration)
    const typeReference = TSH.cast(variableDeclaration.type, ts.isTypeReferenceNode)
    const typeReferenceIdentifier = TSH.cast(typeReference.typeName, ts.isIdentifier)

    const typeChecker = program.getTypeChecker()
    const { symbol } = typeChecker.getTypeAtLocation(typeReferenceIdentifier)
    const initializer = TSH.cast(variableDeclaration.initializer, ts.isObjectLiteralExpression)

    return { initializer, symbol }
  }

  function withinVariableDeclarationParser({ program, ts }: Args, errorNode: ts.Node): ObjectInfo {
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

  function withinArray({ program, ts }: Args, errorNode: ts.Node): ObjectInfo {
    // chase up the chain until you reach a stop point (e.g variable declaration)
    const initializer = TSH.cast(errorNode, ts.isObjectLiteralExpression)
    const arrayLiteral = TSH.cast(initializer.parent, ts.isArrayLiteralExpression)
    const propertyAssignment = TSH.cast(arrayLiteral.parent, ts.isPropertyAssignment)
    const objectLiteral = TSH.cast(propertyAssignment.parent, ts.isObjectLiteralExpression)
    const variableDeclaration = TSH.cast(objectLiteral.parent, ts.isVariableDeclaration)

    const parents = [initializer, arrayLiteral, propertyAssignment, objectLiteral, variableDeclaration]

    // once at the stop point, chase back down the tree using the types
    const typeChecker = program.getTypeChecker()
    const variableType = extractType(ts, typeChecker, variableDeclaration)

    // use data collected to chase down the time back to the original

    throw new Error('nay')
  }

  function extractType(ts: TSH.ts, typeChecker: ts.TypeChecker, node: ts.Node): ts.Type {
    if (ts.isVariableDeclaration(node)) {
      const typeReference = TSH.cast(node.type, ts.isTypeReferenceNode)
      const typeReferenceIdentifier = TSH.cast(typeReference.typeName, ts.isIdentifier)
      return typeChecker.getTypeAtLocation(typeReferenceIdentifier)
    }

    throw new Error(`Not implemented for kind ${ts.SyntaxKind[node.kind]}`)
  }

  interface ObjectInfo {
    initializer: ts.ObjectLiteralExpression
    symbol: ts.Symbol
  }
}
