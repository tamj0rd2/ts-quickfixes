import ts from 'typescript/lib/tsserverlibrary'
import { Member } from './member'

export class EnumMember extends Member {
  constructor(name: string, public readonly enumName: string, public readonly enumMember: string) {
    super(name)
  }

  protected createInitializer(): ts.Expression {
    return ts.factory.createPropertyAccessExpression(
      ts.factory.createIdentifier(this.enumName),
      ts.factory.createIdentifier(this.enumMember),
    )
  }
}

export class StringMember extends Member {
  public constructor(name: string, public readonly value = '') {
    super(name)
  }

  protected createInitializer(): ts.Expression {
    return ts.factory.createStringLiteral(this.value)
  }
}

export class NumberMember extends Member {
  public constructor(name: string, public readonly value = 0) {
    super(name)
  }

  protected createInitializer(): ts.Expression {
    return ts.factory.createNumericLiteral(this.value)
  }
}

export class BooleanMember extends Member {
  public constructor(name: string, public readonly value = false) {
    super(name)
  }

  protected createInitializer(): ts.Expression {
    return this.value ? ts.factory.createTrue() : ts.factory.createFalse()
  }
}

export class ArrayMember extends Member {
  protected createInitializer(): ts.Expression {
    return ts.factory.createArrayLiteralExpression()
  }
}

export class UnimplementedMember extends Member {
  protected createInitializer(): ts.Expression {
    return ts.factory.createNull()
  }
}
