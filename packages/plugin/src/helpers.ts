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

  export function castToOneOf<T extends ts.Node>(
    node: ts.Node | undefined,
    ...assertions: ({ name: string } & ((node: ts.Node) => node is T))[]
  ): T {
    if (!node) throw new Error(`Cannot cast because the node is undefined`)
    if (assertions.some((assertion) => assertion(node))) return node as T
    throw new Error(`All casts failed`)
  }

  export function deref(
    ts: TSH.ts,
    typeChecker: ts.TypeChecker,
    node: ts.TypeNode | ts.Identifier | undefined,
  ): ts.Symbol {
    if (!node) throw new Error('Cannot deref undefined node')

    if (ts.isIdentifier(node)) {
      const symbol = typeChecker.getSymbolAtLocation(node)
      if (symbol) return symbol
      throw new Error('Could not get symbol for identifier')
    }

    if (ts.isArrayTypeNode(node)) {
      return TSH.deref(ts, typeChecker, node.elementType)
    }

    const type = typeChecker.getTypeFromTypeNode(node)

    if (ts.isTypeReferenceNode(node)) {
      const { aliasSymbol } = type as ts.TypeReference
      if (aliasSymbol) return aliasSymbol
    }

    return type.symbol
  }

  export function assert<T extends ts.Node>(
    node: ts.Node | undefined,
    assertion: { name: string } & ((node: ts.Node) => node is T),
  ): asserts node is T {
    cast(node, assertion)
  }

  interface Member {
    symbol: ts.Symbol
    type: ts.Type
  }

  export function getMembers(symbol: ts.Symbol, typeChecker: ts.TypeChecker): Collection<string, Member> {
    const declaration = symbol.valueDeclaration ?? symbol.getDeclarations()?.[0]
    if (!declaration) throw new Error(`Could not find a declaration node for ${symbol.name}`)

    return typeChecker
      .getPropertiesOfType(typeChecker.getTypeAtLocation(declaration))
      .reduce((members, symbol) => {
        const type = typeChecker.getTypeOfSymbolAtLocation(symbol, declaration)
        members.set(symbol.name, { symbol, type })
        return members
      }, new Collection<string, Member>())
  }

  // make this throw useful errors instead of returning a bool
  export function assertSymbolsAreCompatible(
    ts: ts,
    typeChecker: ts.TypeChecker,
    expectedSymbol: ts.Symbol,
    symbolToCompare: ts.Symbol,
  ): void {
    const topLevelExpectedMembers = getMembers(expectedSymbol, typeChecker)
    const topLevelCompareMembers = getMembers(symbolToCompare, typeChecker)

    for (const { symbol: expectedSymbol } of topLevelExpectedMembers.toArray()) {
      const symbolToCompare = topLevelCompareMembers.get(expectedSymbol.name)?.symbol
      if (!symbolToCompare) {
        if (expectedSymbol.flags & ts.SymbolFlags.Optional) continue
        throw new Error(`Required member "${expectedSymbol.name}" missing`)
      }

      const memberType = typeChecker.getTypeAtLocation(expectedSymbol.valueDeclaration)
      const compareType = typeChecker.getTypeAtLocation(symbolToCompare.valueDeclaration)
      if (compareType.flags !== memberType.flags)
        throw new Error(`Symbol flags for "${expectedSymbol.name}" do not match`)

      assertSymbolsAreCompatible(ts, typeChecker, expectedSymbol, symbolToCompare)
    }
  }

  export function areSymbolsCompatible(
    ts: ts,
    typeChecker: ts.TypeChecker,
    expectedSymbol: ts.Symbol,
    symbolToCompare: ts.Symbol,
  ): boolean {
    try {
      assertSymbolsAreCompatible(ts, typeChecker, expectedSymbol, symbolToCompare)
      return true
    } catch (err) {
      return false
    }
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

  export function getTypeForCallArgument(
    ts: ts,
    typeChecker: ts.TypeChecker,
    signatureDeclaration: ts.SignatureDeclaration,
    argument: ts.Node,
  ): ts.Symbol {
    const expression = TSH.castToOneOf<ts.CallExpression | ts.NewExpression>(
      argument.parent,
      ts.isCallExpression,
      ts.isNewExpression,
    )
    const argumentIndex = expression.arguments?.findIndex((arg) => arg === argument) ?? -1
    if (argumentIndex < 0) throw new Error('why oh why')

    const parameter = signatureDeclaration.parameters[argumentIndex]
    return TSH.deref(ts, typeChecker, parameter.type)
  }

  export namespace Generate {
    export function isMatchingIdentifierInScope(
      ts: ts,
      typeChecker: ts.TypeChecker,
      member: ts.Symbol,
      symbolsInScope: ts.Symbol[],
    ): boolean {
      const symbolInScope = symbolsInScope.find((s) => s.name === member.name)
      if (!symbolInScope) return false
      if (areSymbolsCompatible(ts, typeChecker, member, symbolInScope)) return true

      // you could also get it from the type of the variable, if there is one. or figure it out... so many ways to do this
      if (
        ts.isVariableDeclaration(symbolInScope.valueDeclaration) &&
        symbolInScope.valueDeclaration.initializer
      ) {
        const initializerSymbol = typeChecker
          .getTypeAtLocation(symbolInScope.valueDeclaration.initializer)
          .getSymbol()
        return !!initializerSymbol && areSymbolsCompatible(ts, typeChecker, member, initializerSymbol)
      }

      return false
    }

    export function objectLiteral(
      ts: ts,
      typeChecker: ts.TypeChecker,
      sourceFile: ts.SourceFile,
      initializer: ts.ObjectLiteralExpression,
      expectedSymbol: ts.Symbol,
    ): string {
      const expectedMembers = getMembers(expectedSymbol, typeChecker)
      if (!expectedMembers.size) throw new Error('Symbol has no members')

      const { symbol: initializerSymbol } = typeChecker.getTypeAtLocation(initializer)
      const symbolsInScope = typeChecker
        .getSymbolsInScope(initializer, ts.SymbolFlags.ModuleMember)
        .filter((s) => s.valueDeclaration?.getSourceFile() === sourceFile)

      const additionalProperties = getMembers(expectedSymbol, typeChecker)
        .toArray()
        .reduce((additionalProperties, member) => {
          const memberName = member.symbol.name
          if (
            initializerSymbol.members?.has(memberName as ts.__String) ||
            additionalProperties.has(memberName)
          )
            return additionalProperties

          additionalProperties.set(
            memberName,
            createPropertyAssignment(ts, typeChecker, symbolsInScope, member),
          )
          return additionalProperties
        }, new Collection<string, ts.PropertyAssignment>())

      const replacedInitializer = ts.factory.createObjectLiteralExpression(
        [...initializer.properties, ...additionalProperties.toArray()],
        true,
      )

      return ts
        .createPrinter(
          { newLine: ts.NewLineKind.LineFeed },
          { substituteNode: (_, node) => (node === initializer ? replacedInitializer : node) },
        )
        .printNode(ts.EmitHint.Unspecified, initializer, sourceFile)
    }

    function createPropertyAssignment(
      ts: TSH.ts,
      typeChecker: ts.TypeChecker,
      symbolsInScope: ts.Symbol[],
      member: Member,
    ): ts.PropertyAssignment {
      const name = member.symbol.name
      const nameNode = name.includes(' ') ? ts.factory.createStringLiteral(name, true) : name
      const initializerNode = isMatchingIdentifierInScope(ts, typeChecker, member.symbol, symbolsInScope)
        ? ts.factory.createIdentifier(member.symbol.name)
        : expressionFromMember(member, ts, typeChecker, symbolsInScope)

      return ts.factory.createPropertyAssignment(nameNode, initializerNode)
    }

    function expressionFromMember(
      member: Member,
      ts: ts,
      typeChecker: ts.TypeChecker,
      symbolsInScope: ts.Symbol[],
    ): ts.Expression {
      const { symbol, type } = member
      const declaration: ts.Declaration | undefined = symbol.valueDeclaration ?? symbol.getDeclarations()?.[0]

      if (declaration && ts.isPropertySignature(declaration) && declaration.type) {
        if (ts.isLiteralTypeNode(declaration.type)) {
          if (declaration.type.literal.kind === ts.SyntaxKind.TrueKeyword) {
            return ts.factory.createTrue()
          }

          if (declaration.type.literal.kind === ts.SyntaxKind.FalseKeyword) {
            return ts.factory.createFalse()
          }
        }

        if (ts.isArrayTypeNode(declaration.type)) {
          return ts.factory.createArrayLiteralExpression()
        }

        if (ts.isTypeReferenceNode(declaration.type)) {
          const symbol = deref(ts, typeChecker, declaration.type)
          const type = typeChecker.getTypeFromTypeNode(declaration.type)
          return expressionFromMember({ symbol, type }, ts, typeChecker, symbolsInScope)
        }

        if (ts.isTypeLiteralNode(declaration.type)) {
          const type = typeChecker.getTypeFromTypeNode(declaration.type)
          return expressionFromMember({ symbol: type.symbol, type }, ts, typeChecker, symbolsInScope)
        }
      }

      if (type.isStringLiteral()) return ts.factory.createStringLiteral(type.value, true)
      if (type.isNumberLiteral()) return ts.factory.createNumericLiteral(type.value)

      if (type.flags & ts.TypeFlags.String) return ts.factory.createStringLiteral('todo', true)
      if (type.flags & ts.TypeFlags.Number) return ts.factory.createNumericLiteral(0)
      if (type.flags & ts.TypeFlags.Boolean) return ts.factory.createFalse()

      if (type.flags & ts.TypeFlags.EnumLiteral && type.isUnionOrIntersection() && type.aliasSymbol) {
        const firstEnumMember = (type.aliasSymbol.exports?.keys().next().value as ts.__String)?.toString()

        return firstEnumMember
          ? ts.factory.createPropertyAccessExpression(
              ts.factory.createIdentifier(type.aliasSymbol.name),
              ts.factory.createIdentifier(firstEnumMember),
            )
          : ts.factory.createNull()
      }

      if (declaration && (ts.isTypeLiteralNode(declaration) || ts.isInterfaceDeclaration(declaration))) {
        const properties: ts.PropertyAssignment[] = []
        getMembers(symbol, typeChecker)
          .toArray()
          .forEach((member) => {
            properties.push(createPropertyAssignment(ts, typeChecker, symbolsInScope, member))
          })
        return ts.factory.createObjectLiteralExpression(properties, true)
      }

      if (symbol.name === 'Date') {
        return ts.factory.createNewExpression(ts.factory.createIdentifier('Date'), undefined, [])
      }

      return ts.factory.createNull()
    }
  }

  type CollectionKey = string | number | symbol

  export class Collection<K extends CollectionKey, V = unknown> {
    private readonly internalMap: Map<K, V>

    public constructor(entries?: readonly (readonly [K, V])[] | null) {
      this.internalMap = new Map<K, V>(entries)
    }

    public static FromRecord<K extends string, Item>(entries: Record<K, Item>): Collection<K, Item> {
      return new Collection(Object.entries(entries) as [K, Item][])
    }

    public static fromArray<K extends CollectionKey, Item>(
      items: Item[],
      getKey: (item: Item) => K,
    ): Collection<K, Item> {
      const entries = items.map<[K, Item]>((item) => [getKey(item), item])
      return new Collection<K, Item>(entries)
    }

    public toArray(): V[] {
      return Array.from(this.internalMap.values())
    }

    public toEntries(): [K, V][] {
      return Array.from(this.internalMap.entries())
    }

    public toRecord(): Record<K, V> {
      return this.toEntries().reduce(
        (accum, [key, value]) => ({ ...accum, [key]: value }),
        {} as Record<K, V>,
      )
    }

    public serialize(): Record<K, V> {
      return this.toRecord()
    }

    public set(key: K, value: V): this {
      this.internalMap.set(key, value)
      return this
    }

    public get(key: K): V | undefined {
      return this.internalMap.get(key)
    }

    public has(key: K): boolean {
      return this.internalMap.has(key)
    }

    public delete(key: K): boolean {
      return this.internalMap.delete(key)
    }

    public map<T>(fn: (item: V) => T): Collection<K, T> {
      return this.reduce((accum, [id, item]) => {
        accum.set(id, fn(item))
        return accum
      }, new Collection<K, T>())
    }

    public reduce<T>(fn: (accum: T, entry: [K, V], index: number) => T, defaultValue: T): T {
      return this.toEntries().reduce(fn, defaultValue)
    }

    public forEach(fn: (entry: [K, V], index: number) => void): void {
      return this.toEntries().forEach(fn)
    }

    public get size(): number {
      return this.internalMap.size
    }

    public find(predicate: (value: V) => boolean): V | undefined {
      return this.toArray().find(predicate)
    }

    public [Symbol.iterator](): IterableIterator<[K, V]> {
      return this.internalMap.entries()
    }
  }
}
