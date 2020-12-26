import ts from 'typescript/lib/tsserverlibrary'

export const MemberType = {
  String: 'todo',
  Number: 0,
  Union: null,
  BuiltIn: null,
  Boolean: false,
  Never: 'never',
  Array: '[]',
} as const
export type MemberType = typeof MemberType[keyof typeof MemberType]

export abstract class Member {
  constructor(public readonly name: string) {}

  public createPropertyAssignment(): ts.PropertyAssignment {
    return ts.factory.createPropertyAssignment(this.name, this.createInitializer())
  }

  protected abstract createInitializer(): ts.Expression
}
