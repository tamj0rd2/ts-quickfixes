/** Typescript Helpers */
export namespace TSH {
  export type ts = typeof import('typescript/lib/tsserverlibrary')

  export interface NodePosition {
    start: number
    end: number
  }

  export function findChildNode<T extends ts.Node>(
    rootNode: ts.Node,
    predicate: (node: ts.Node) => node is T,
    failureMessage: string,
  ): T {
    let foundNode: T | undefined

    rootNode.forEachChild((child) => {
      if (foundNode) return
      if (predicate(child)) {
        foundNode = child
        return
      }

      try {
        foundNode = findChildNode(child, predicate, failureMessage)
      } catch {
        // ignore
      }
    })

    if (foundNode) return foundNode
    throw new Error(failureMessage)
  }

  export function findParentNode<T extends ts.Node>(
    startingNode: ts.Node,
    predicate: (node: ts.Node) => node is T,
    failureMessage = 'Node not found',
  ): T {
    const parent = startingNode.parent
    if (!parent) throw new Error(failureMessage ?? 'Could not find a matching parent node')
    return predicate(parent) ? parent : findParentNode(parent, predicate, failureMessage)
  }

  export function findNodeAtPosition(sourceFile: ts.SourceFile, { start, end }: NodePosition): ts.Node {
    return findChildNode(
      sourceFile,
      (node): node is ts.Node =>
        [node.pos, node.getStart(sourceFile, true)].includes(start) && node.end === end,
      `Could not find a node at position ${start},${end}`,
    )
  }

  export function getSourceFile(filePath: string, program: ts.Program): ts.SourceFile {
    const sourceFile = program.getSourceFile(filePath)
    if (sourceFile) return sourceFile
    throw new Error(`Could not find source file for ${filePath}`)
  }

  export function cast<T extends ts.Node>(
    node: ts.Node | undefined,
    assertion: { name: string } & ((node: ts.Node) => node is T),
  ): T {
    if (!node) throw new Error(`Casting failed - ${assertion.name} - the node is undefined`)
    if (!assertion(node)) throw new Error(`Casting failed - ${assertion.name}`)
    return node
  }

  export function deref(
    ts: TSH.ts,
    typeChecker: ts.TypeChecker,
    node: ts.TypeNode | ts.Identifier,
  ): ts.Symbol {
    if (ts.isIdentifier(node)) {
      const symbol = typeChecker.getSymbolAtLocation(node)
      if (symbol) return symbol
      throw new Error('Could not get symbol for identifier')
    }

    return typeChecker.getTypeFromTypeNode(node).symbol
  }

  export function assert<T extends ts.Node>(
    node: ts.Node | undefined,
    assertion: { name: string } & ((node: ts.Node) => node is T),
  ): asserts node is T {
    cast(node, assertion)
  }

  export function getInheritedMemberSymbols(
    ts: TSH.ts,
    typeChecker: ts.TypeChecker,
    symbol: ts.Symbol,
  ): ts.Symbol[] {
    const symbolDeclarationNode = symbol.valueDeclaration ?? symbol.declarations[0]
    const members: ts.Symbol[] = []

    if (ts.isInterfaceDeclaration(symbolDeclarationNode)) {
      const inheritedMemberSymbols = symbolDeclarationNode.heritageClauses
        ?.flatMap((clause) => clause.types.map((type) => type.expression))
        .filter(ts.isIdentifier)
        .map((s) => typeChecker.getTypeAtLocation(s).symbol)
        ?.filter((s): s is ts.Symbol => !!s)
        .flatMap((inheritedSymbol) => getInheritedMemberSymbols(ts, typeChecker, inheritedSymbol))

      members.push(...(inheritedMemberSymbols ?? []))
    }

    symbol.members?.forEach((s) => members.push(s))
    return members
  }

  export function getSymbolForCallArgument(
    ts: ts,
    typeChecker: ts.TypeChecker,
    callExpression: ts.CallExpression,
    argumentNode: ts.Node,
  ): ts.Symbol {
    const { symbol: identifierSymbol } = typeChecker.getTypeAtLocation(callExpression.expression)
    const functionDeclaration = identifierSymbol.valueDeclaration ?? identifierSymbol.declarations[0]

    if (ts.isFunctionDeclaration(functionDeclaration) || ts.isArrowFunction(functionDeclaration)) {
      const argumentIndex = callExpression.arguments.findIndex((arg) => arg === argumentNode)
      if (argumentIndex < 0) throw new Error('Invalid argument index')

      const expectedType = TSH.cast(functionDeclaration.parameters[argumentIndex]?.type, ts.isTypeNode)
      return deref(ts, typeChecker, expectedType)
    }

    throw new Error(`Can't get symbol for given call expression index`)
  }

  export namespace Generate {
    export function objectLiteral(
      ts: ts,
      typeChecker: ts.TypeChecker,
      sourceFile: ts.SourceFile,
      initializer: ts.ObjectLiteralExpression,
      expectedSymbol: ts.Symbol,
    ): string {
      if (!expectedSymbol.members) throw new Error('Symbol has no members property')
      const { symbol: initializerSymbol } = typeChecker.getTypeAtLocation(initializer)

      const newProperties = new Map<ts.__String, ts.PropertyAssignment>()
      function addNewPropertyAssignment(memberSymbol: ts.Symbol): void {
        const memberName = memberSymbol.name as ts.__String
        if (initializerSymbol.members?.has(memberName) || newProperties.has(memberName)) return
        newProperties.set(
          memberName,
          ts.factory.createPropertyAssignment(
            memberSymbol.name,
            expressionFromSymbol(memberSymbol, ts, typeChecker),
          ),
        )
      }

      expectedSymbol.members.forEach(addNewPropertyAssignment)
      const extras = getInheritedMemberSymbols(ts, typeChecker, expectedSymbol)
      extras.forEach(addNewPropertyAssignment)

      const replacedInitializer = ts.factory.createObjectLiteralExpression(
        [...initializer.properties, ...newProperties.values()],
        true,
      )

      return ts
        .createPrinter(
          { newLine: ts.NewLineKind.LineFeed },
          { substituteNode: (_, node) => (node === initializer ? replacedInitializer : node) },
        )
        .printNode(ts.EmitHint.Unspecified, initializer, sourceFile)
    }

    function expressionFromSymbol(
      memberSymbol: ts.Symbol,
      ts: ts,
      typeChecker: ts.TypeChecker,
    ): ts.Expression {
      const propertySignature = memberSymbol.valueDeclaration
      if (!ts.isPropertySignature(propertySignature))
        throw new Error('The given symbol is not a property signature')

      if (propertySignature.type && ts.isLiteralTypeNode(propertySignature.type)) {
        if (propertySignature.type.literal.kind === ts.SyntaxKind.TrueKeyword) {
          return ts.factory.createTrue()
        }

        if (propertySignature.type.literal.kind === ts.SyntaxKind.FalseKeyword) {
          return ts.factory.createFalse()
        }
      }

      if (propertySignature.type && ts.isArrayTypeNode(propertySignature.type)) {
        return ts.factory.createArrayLiteralExpression()
      }

      if (propertySignature.type && ts.isArrayTypeNode(propertySignature.type)) {
        return ts.factory.createArrayLiteralExpression()
      }

      const type = typeChecker.getTypeAtLocation(propertySignature)

      if (type.flags & ts.TypeFlags.String) {
        return ts.factory.createStringLiteral('todo', true)
      }

      if (type.flags & ts.TypeFlags.Number) {
        return ts.factory.createNumericLiteral(0)
      }

      if (type.flags & ts.TypeFlags.Boolean) {
        return ts.factory.createFalse()
      }

      if (type.flags & ts.TypeFlags.EnumLiteral && type.isUnionOrIntersection() && type.aliasSymbol) {
        const firstEnumMember = (type.aliasSymbol.exports?.keys().next().value as ts.__String)?.toString()

        return firstEnumMember
          ? ts.factory.createPropertyAccessExpression(
              ts.factory.createIdentifier(type.aliasSymbol.name),
              ts.factory.createIdentifier(firstEnumMember),
            )
          : ts.factory.createNull()
      }

      if (type.symbol) {
        const typeDeclaration = type.symbol.valueDeclaration ?? type.symbol.declarations[0]
        if (ts.isTypeLiteralNode(typeDeclaration) || ts.isInterfaceDeclaration(typeDeclaration)) {
          const properties: ts.PropertyAssignment[] = []
          type.symbol.members?.forEach((member) => {
            properties.push(
              ts.factory.createPropertyAssignment(member.name, expressionFromSymbol(member, ts, typeChecker)),
            )
          })
          return ts.factory.createObjectLiteralExpression(properties, true)
        }

        if (type.symbol.name === 'Date') {
          return ts.factory.createNewExpression(ts.factory.createIdentifier('Date'), undefined, [])
        }
      }

      return ts.factory.createNull()
    }
  }
}
