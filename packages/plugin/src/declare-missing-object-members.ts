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

  const parsers = [variableDeclarationParser, withinVariableDeclarationParser, catchAllParser]

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
    const initializer = TSH.cast(propertyAssignment.initializer, ts.isObjectLiteralExpression)
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

  function catchAllParser(args: Args, errorNode: ts.Node): ObjectInfo {
    const { program, ts } = args
    const initializer = findInitializer(ts, errorNode)
    const passedNodes = climbUpFromInitializerAndCollectNodes(args, initializer)
    const typeChecker = program.getTypeChecker()
    return { initializer, symbol: stepDown(ts, typeChecker, [...passedNodes].reverse()) }
  }

  function findInitializer(ts: TSH.ts, errorNode: ts.Node): ts.ObjectLiteralExpression {
    if (
      ts.isIdentifier(errorNode) &&
      (ts.isVariableDeclaration(errorNode.parent) || ts.isPropertyAssignment(errorNode.parent))
    ) {
      return TSH.cast(errorNode.parent.initializer, ts.isObjectLiteralExpression)
    }

    if (ts.isObjectLiteralExpression(errorNode)) {
      return errorNode
    }

    throw new Error(`Unhandled errorNode type ${ts.SyntaxKind[errorNode.kind]}`)
  }

  function climbUpFromInitializerAndCollectNodes(
    { ts }: Args,
    initializer: ts.ObjectLiteralExpression,
  ): ts.Node[] {
    const collectedNodes: ts.Node[] = [initializer]

    while (collectedNodes[0].parent) {
      const previousNode = collectedNodes[0]
      const node = previousNode.parent
      collectedNodes.unshift(node)

      if (ts.isVariableDeclaration(node)) break
    }

    return collectedNodes
  }

  function stepDown(ts: TSH.ts, typeChecker: ts.TypeChecker, passedNodes: ts.Node[]): ts.Symbol {
    let pointer = passedNodes.length - 1
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let capturedSymbol: ts.Symbol | undefined

    while (pointer >= 0) {
      const currentIndex = pointer
      pointer -= 1

      const node = passedNodes[currentIndex]

      if (ts.isVariableDeclaration(node)) {
        const nextNode = passedNodes[currentIndex - 1]
        TSH.assert(nextNode, ts.isObjectLiteralExpression)
        const typeReference = TSH.cast(node.type, ts.isTypeReferenceNode)
        capturedSymbol = TSH.deref(ts, typeChecker, typeReference).symbol
        pointer -= 1 // skipping past the object literal
        continue
      }

      if (!capturedSymbol) throw new Error('No top level symbol somehow...')

      if (ts.isPropertyAssignment(node)) {
        const propertyName = node.name.getText()
        const memberSymbol = capturedSymbol.members?.get(propertyName as ts.__String)
        if (!memberSymbol) throw new Error(`Type ${capturedSymbol.name} has no member ${propertyName}`)
        capturedSymbol = memberSymbol
        continue
      }

      if (ts.isArrayLiteralExpression(node)) {
        const propertySignature = TSH.cast(capturedSymbol.valueDeclaration, ts.isPropertySignature)
        const arrayType = TSH.cast(propertySignature.type, ts.isArrayTypeNode)
        const elementType = TSH.cast(arrayType.elementType, ts.isTypeReferenceNode)
        capturedSymbol = TSH.deref(ts, typeChecker, elementType).symbol
        continue
      }

      // end of the road
      if (ts.isObjectLiteralExpression(node) && currentIndex === 0) {
        return capturedSymbol
      }

      throw new Error('unhandled path')
    }

    throw new Error('nay')
  }

  interface ObjectInfo {
    initializer: ts.ObjectLiteralExpression
    symbol: ts.Symbol
  }
}
