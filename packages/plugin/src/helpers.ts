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
    if (!node) throw new Error(`Node assertion failed - ${assertion.name} - the node is undefined`)
    if (!assertion(node)) throw new Error(`Node assertion failed - ${assertion.name}`)
    return node
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

      const newProperties: ts.PropertyAssignment[] = []
      expectedSymbol.members.forEach((memberSymbol) => {
        if (initializerSymbol.members?.has(memberSymbol.name as ts.__String)) return
        newProperties.push(
          ts.factory.createPropertyAssignment(
            memberSymbol.name,
            expressionFromSymbol(memberSymbol, ts, typeChecker),
          ),
        )
      })

      const replacedInitializer = ts.factory.createObjectLiteralExpression(
        [...initializer.properties, ...newProperties],
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
        const firstEnumMember = type.aliasSymbol.exports?.keys().next().value.toString()

        return firstEnumMember
          ? ts.factory.createPropertyAccessExpression(
              ts.factory.createIdentifier(type.aliasSymbol.name),
              ts.factory.createIdentifier(firstEnumMember),
            )
          : ts.factory.createNull()
      }

      const typeDeclaration = type.getSymbol()?.valueDeclaration ?? type.getSymbol()?.declarations[0]
      if (
        typeDeclaration &&
        (ts.isTypeLiteralNode(typeDeclaration) || ts.isInterfaceDeclaration(typeDeclaration))
      ) {
        // const memberSymbols = getExpectedMemberSymbols(typeDeclaration)
        // return ts.factory.createObjectLiteralExpression(memberSymbols.map(createMemberForSymbol), true)
        return ts.factory.createObjectLiteralExpression()
      }

      if (type.getSymbol()?.name === 'Date') {
        return ts.factory.createNewExpression(ts.factory.createIdentifier('Date'), undefined, [])
      }

      return ts.factory.createNull()
    }
  }
}
