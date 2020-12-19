import { EnumMember, GroupedMembers, Member, MemberType } from './member-parser'

export const LineEnding = {
  LF: '\n',
  CRLF: '\r\n',
} as const

export type LineEnding = typeof LineEnding[keyof typeof LineEnding]

const notNull = <T>(item: T | null): item is T => item !== null

export class MemberFormatter {
  // TODO: eventually get these from the user's preferences
  private readonly indentSize = 2
  private readonly indentCharacter = ' '

  public format(existingMembers: string[], { members }: GroupedMembers, lineEnding: LineEnding): string {
    const indentLevel = 1
    const formattedExistingMembers = existingMembers.map((member) => this.formatExistingLine(member))
    const formattedMissingMembers = Object.entries(members)
      .map(([name, member]) => this.formatMember({ name, member, indentLevel, lineEnding }))
      .filter(notNull)

    return ['{', ...formattedExistingMembers, ...formattedMissingMembers, '}'].join(lineEnding)
  }

  private formatExistingLine(line: string): string {
    const indentation = this.indentCharacter.repeat(this.indentSize)
    if (line.endsWith('{') || line.endsWith(',')) return `${indentation}${line}`
    return `${indentation}${line},`
  }

  private formatMember({ name, member, indentLevel, lineEnding }: FormatMemberArgs): string | null {
    const indentation = this.indentCharacter.repeat(indentLevel * this.indentSize)

    if (member instanceof GroupedMembers) {
      const opening = `${indentation}${name}: {`
      const body = Object.entries(member.members)
        .map(([name, subMember]) =>
          this.formatMember({ name, member: subMember, indentLevel: indentLevel + 1, lineEnding }),
        )
        .filter(notNull)
        .join(lineEnding)
      const closing = `${indentation}},`
      return [opening, body, closing].join(lineEnding)
    }

    const getSimpleMembers = (content: MemberType | string): string => `${indentation}${name}: ${content},`

    if (member instanceof EnumMember) {
      return getSimpleMembers(`${member.enumName}.${member.member}`)
    }

    switch (member) {
      case MemberType.Never:
        return null
      case MemberType.String:
        return getSimpleMembers(`'${member}'`)
      case MemberType.Boolean:
      case MemberType.BuiltIn:
      case MemberType.Number:
      case MemberType.Union:
      case MemberType.Array:
        return getSimpleMembers(member)
    }
  }
}

interface FormatMemberArgs {
  name: string | null
  member: Member
  indentLevel: number
  lineEnding: LineEnding
}
