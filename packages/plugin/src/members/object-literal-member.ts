import ts from 'typescript/lib/tsserverlibrary'
import { Member } from './member'

export class ObjectLiteralMember extends Member {
  constructor(name: string, public readonly members: Member[] = []) {
    super(name)
  }

  public static createTopLevel(members?: Member[]): ObjectLiteralMember {
    return new ObjectLiteralMember('topLevel', members)
  }

  protected createInitializer(): ts.Expression {
    return ts.factory.createObjectLiteralExpression(
      this.toArray().map((member) => member.createPropertyAssignment()),
    )
  }

  public addMember(member: Member): void {
    this.members.push(member)
  }

  public concat(objectLiteral: ObjectLiteralMember): ObjectLiteralMember {
    return new ObjectLiteralMember(this.name, [...this.toArray(), ...objectLiteral.toArray()])
  }

  public toArray(): Member[] {
    return Object.values(this.members)
  }
}
