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

  const parsers = [withinVariableDeclarationParser, catchAllParser]

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
    const passedNodes = collectNodesUpToFirstRelatedTypeDeclaration(args, initializer)
    const typeChecker = program.getTypeChecker()
    const expectedSymbol = deriveExpectedSymbolFromPassedNodes(args, typeChecker, passedNodes)
    if (!expectedSymbol) throw new Error('Could not figure out what the expected symbol is')

    return { initializer, symbol: expectedSymbol }
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

  /** this function returns them in reverse order (the initializer is last) because attempting to reverse it later on
   * casuses memory leaks */
  function collectNodesUpToFirstRelatedTypeDeclaration(
    { ts }: Args,
    initializer: ts.ObjectLiteralExpression,
  ): ts.Node[] {
    const collectedNodes: ts.Node[] = [initializer]

    while (collectedNodes[0].parent) {
      const previousNode = collectedNodes[0]
      const node = previousNode.parent
      collectedNodes.unshift(node)

      // TODO: when I redo function arguments, there'd be some extra logic here to break out
      if (ts.isVariableDeclaration(node)) break
    }

    return collectedNodes
  }

  function deriveExpectedSymbolFromPassedNodes(
    { ts }: Args,
    typeChecker: ts.TypeChecker,
    passedNodes: ts.Node[],
  ): ts.Symbol | undefined {
    return passedNodes.reduce<ts.Symbol | undefined>((trackedSymbol, node) => {
      // logger.logNode(node)

      if (ts.isVariableDeclaration(node)) {
        const typeReference = TSH.cast(node.type, ts.isTypeReferenceNode)
        return TSH.deref(ts, typeChecker, typeReference).symbol
      }

      if (ts.isPropertyAssignment(node)) {
        const propertyName = node.name.getText()
        const memberSymbol = trackedSymbol?.members?.get(propertyName as ts.__String)
        if (!memberSymbol) throw new Error(`Type ${trackedSymbol?.name} has no member ${propertyName}`)
        return memberSymbol
      }

      if (ts.isArrayLiteralExpression(node)) {
        const propertySignature = TSH.cast(trackedSymbol?.valueDeclaration, ts.isPropertySignature)
        const arrayType = TSH.cast(propertySignature.type, ts.isArrayTypeNode)
        const elementType = TSH.cast(arrayType.elementType, ts.isTypeReferenceNode)
        return TSH.deref(ts, typeChecker, elementType).symbol
      }

      return trackedSymbol
    }, undefined)
  }

  interface ObjectInfo {
    initializer: ts.ObjectLiteralExpression
    symbol: ts.Symbol
  }
}
