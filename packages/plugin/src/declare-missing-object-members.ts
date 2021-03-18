import { TSH } from './helpers'
import { Logger } from './providers/provider'

export namespace DeclareMissingObjectMembers {
  export const supportedErrorCodes: number[] = [2345, 2739, 2740, 2741]
  export const supportsErrorCode = (code: number): boolean => supportedErrorCodes.includes(code)

  export interface Args extends TSH.NodePosition {
    filePath: string
    program: ts.Program
    logger: Logger
    ts: TSH.ts
    typeChecker: ts.TypeChecker
  }

  export function createFix(args: Args): ts.CodeFixAction {
    const { program, ts } = args
    const typeChecker = program.getTypeChecker()
    const sourceFile = TSH.getSourceFile(args.filePath, program)
    const errorNode = TSH.findNodeAtPosition(sourceFile, args)

    const initializer = findInitializer(ts, errorNode)
    const { relevantNodes, topLevelSymbol } = collectNodesUpToFirstRelatedTypeDeclaration(args, initializer)
    const symbol = deriveExpectedSymbolFromPassedNodes(args, topLevelSymbol, relevantNodes)

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
    args: Args,
    initializer: ts.ObjectLiteralExpression,
  ): { topLevelSymbol: ts.Symbol; relevantNodes: ts.Node[] } {
    const { ts, typeChecker } = args
    const relevantNodes: ts.Node[] = [initializer]

    while (relevantNodes[0].parent) {
      const previousNode = relevantNodes[0]
      const node = previousNode.parent

      if (ts.isVariableDeclaration(node)) {
        const identifier = TSH.cast(node.name, ts.isIdentifier)
        return { relevantNodes, topLevelSymbol: TSH.deref(ts, typeChecker, identifier) }
      }

      if (ts.isCallExpression(node)) {
        const identifier = TSH.cast(node.expression, ts.isIdentifier)
        return {
          relevantNodes,
          topLevelSymbol: TSH.deref(ts, typeChecker, identifier),
        }
      }

      relevantNodes.unshift(node)
    }

    throw new Error('Could find first related type declaration')
  }

  function deriveExpectedSymbolFromPassedNodes(
    { ts, typeChecker }: Args,
    topLevelSymbol: ts.Symbol,
    relevantNodes: ts.Node[],
  ): ts.Symbol {
    return relevantNodes.reduce<ts.Symbol>((trackedSymbol, node, index): ts.Symbol => {
      const trackedDeclaration = trackedSymbol.valueDeclaration ?? trackedSymbol.declarations[0]
      if (!trackedDeclaration) throw new Error('No declaration for the tracked symbol')

      if (ts.isPropertyAssignment(node)) {
        const memberName = node.name.getText() as ts.__String
        const member = trackedSymbol.members?.get(memberName)
        if (member) return member

        const inheritedMembers = TSH.getInheritedMemberSymbols(ts, typeChecker, trackedSymbol)
        const inheritedMember = inheritedMembers.find((m) => m.name === memberName)
        if (!inheritedMember) throw new Error(`Could not find member ${memberName}`)
        return inheritedMember
      }

      if (ts.isArrayLiteralExpression(node)) {
        if (ts.isPropertySignature(trackedDeclaration)) {
          return TSH.deref(ts, typeChecker, trackedDeclaration.type)
        }

        if (ts.isFunctionDeclaration(trackedDeclaration)) {
          return TSH.getTypeForFunctionArgument(ts, typeChecker, trackedDeclaration, node)
        }
      }

      if (ts.isObjectLiteralExpression(node)) {
        if (
          (ts.isVariableDeclaration(trackedDeclaration) || ts.isPropertySignature(trackedDeclaration)) &&
          trackedDeclaration.type
        ) {
          return TSH.deref(ts, typeChecker, trackedDeclaration.type)
        }

        if (ts.isFunctionDeclaration(trackedDeclaration)) {
          return TSH.getTypeForFunctionArgument(ts, typeChecker, trackedDeclaration, node)
        }

        if (index === relevantNodes.length - 1) return trackedSymbol
      }

      throw new Error(`Unhandled path for node kind ${ts.SyntaxKind[node.kind]}`)
    }, topLevelSymbol)
  }
}
