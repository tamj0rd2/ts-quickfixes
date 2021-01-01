import { Logger } from '../providers/provider'

interface CtorArgs {
  program: ts.Program
  logger: Logger
}

export abstract class CodeFix {
  protected readonly program: ts.Program
  protected readonly typeChecker: ts.TypeChecker
  protected readonly logger: Logger

  constructor(args: CtorArgs) {
    this.program = args.program
    this.typeChecker = args.program.getTypeChecker()
    this.logger = args.logger
  }

  protected getSourceFile(filePath: string): ts.SourceFile {
    const sourceFile = this.program.getSourceFile(filePath)
    if (sourceFile) return sourceFile

    throw new Error(`expected to get a sourcefile for ${filePath}`)
  }

  protected findChildNode<T extends ts.Node>(
    rootNode: ts.Node,
    predicate: (node: ts.Node) => node is T,
    failureMessage = 'Node not found',
  ): T {
    if (predicate(rootNode)) return rootNode as T

    for (const childNode of rootNode.getChildren()) {
      try {
        const foundNode = this.findChildNode(childNode, predicate)
        if (foundNode) return foundNode as T
      } catch (err) {
        // ignore
      }
    }

    throw new Error(failureMessage)
  }

  protected findParentNode<T extends ts.Node>(
    startingNode: ts.Node,
    predicate: (node: ts.Node) => node is T,
  ): T {
    const parent = startingNode.parent
    if (!parent) {
      throw new Error('Could not find a matching parent node')
    }

    return predicate(parent) ? parent : this.findParentNode(parent, predicate)
  }

  protected curryMatchesPosition = (sourceFile: ts.SourceFile, position: { start: number; end: number }) => (
    node: ts.Node,
  ): boolean => {
    return [node.pos, node.getStart(sourceFile, true)].includes(position.start) && node.end === position.end
  }
}
