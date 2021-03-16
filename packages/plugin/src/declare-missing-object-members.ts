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

  export function createFix(args: Args): ts.CodeFixAction {
    const { program, ts } = args
    const typeChecker = program.getTypeChecker()
    const sourceFile = TSH.getSourceFile(args.filePath, program)
    const errorNode = TSH.findNodeAtPosition(sourceFile, args)

    const infoOrError = catchAllParser(args, errorNode)

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
    { ts, logger }: Args,
    typeChecker: ts.TypeChecker,
    passedNodes: ts.Node[],
  ): ts.Symbol | undefined {
    return passedNodes.reduce<ts.Symbol | undefined>((trackedSymbol, node) => {
      logger.logNode(node)
      const previousSymbolDeclaration = trackedSymbol?.valueDeclaration ?? trackedSymbol?.declarations[0]

      if (ts.isVariableDeclaration(node)) {
        const identifier = TSH.cast(node.name, ts.isIdentifier)
        return typeChecker.getSymbolAtLocation(identifier)
      }

      if (ts.isObjectLiteralExpression(node) && previousSymbolDeclaration) {
        if (ts.isVariableDeclaration(previousSymbolDeclaration)) {
          const typeReference = TSH.cast(previousSymbolDeclaration.type, ts.isTypeReferenceNode)
          return TSH.deref(ts, typeChecker, typeReference)
        }
      }

      if (ts.isPropertyAssignment(node)) {
        TSH.assert(previousSymbolDeclaration, ts.isInterfaceDeclaration)
        return trackedSymbol?.members?.get(node.name.getText() as ts.__String)
      }

      if (ts.isArrayLiteralExpression(node)) {
        const propertySignature = TSH.cast(previousSymbolDeclaration, ts.isPropertySignature)
        const arrayType = TSH.cast(propertySignature.type, ts.isArrayTypeNode)
        const elementType = TSH.cast(arrayType.elementType, ts.isTypeReferenceNode)
        const thingy = TSH.deref(ts, typeChecker, elementType)
        console.log(thingy)
        return thingy
      }

      // if (ts.isPropertyAssignment(node)) {
      //   const propertyName = node.name.getText()
      //   const memberSymbol = trackedSymbol?.members?.get(propertyName as ts.__String)
      //   if (!memberSymbol) throw new Error(`Type ${trackedSymbol?.name} has no member ${propertyName}`)

      //   const propertySignature = TSH.cast(memberSymbol.valueDeclaration, ts.isPropertySignature)
      //   if (!propertySignature.type) throw new Error(`Property signature for ${propertyName} has no type`)

      //   if (ts.isTypeReferenceNode(propertySignature.type)) {
      //     return TSH.deref(ts, typeChecker, propertySignature.type).symbol
      //   }

      //   if (ts.isArrayTypeNode(propertySignature.type)) {
      //     const typeReference = TSH.cast(propertySignature.type.elementType, ts.isTypeReferenceNode)
      //     return TSH.deref(ts, typeChecker, typeReference).symbol
      //   }

      //   throw new Error('Unhandled property assignment case')
      // }

      // if (ts.isArrayLiteralExpression(node)) {
      //   console.log(trackedSymbol?.name, trackedSymbol?.valueDeclaration.kind)
      //   throw new Error('wtf loool')
      //   // logger.logNode(trackedSymbol?.valueDeclaration!)

      //   // const propertySignature = TSH.cast(trackedSymbol?.valueDeclaration, ts.isPropertySignature)
      //   // const arrayType = TSH.cast(propertySignature.type, ts.isArrayTypeNode)
      //   // const elementType = TSH.cast(arrayType.elementType, ts.isTypeReferenceNode)
      //   // return TSH.deref(ts, typeChecker, elementType).symbol
      // }
      throw new Error(`Unhandled node kind ${ts.SyntaxKind[node.kind]}`)
    }, undefined)
  }

  interface ObjectInfo {
    initializer: ts.ObjectLiteralExpression
    symbol: ts.Symbol
  }
}
