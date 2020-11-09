import { Member, Members, MemberType } from './member-parser'

export const LineEnding = {
  LF: '\n',
  CRLF: '\r\n',
} as const

export type LineEnding = typeof LineEnding[keyof typeof LineEnding]

export class MemberFormatter {
  // TODO: eventually get these from the user's preferences
  private readonly indentSize = 2
  private readonly indentCharacter = ' '

  public format(existingMembers: string[], members: Members, lineEnding: LineEnding): string {
    const indentLevel = 1
    const formattedExistingMembers = existingMembers.map((member) => this.formatExistingLine(member))
    const formattedMissingMembers = Object.entries(members).map(([name, member]) =>
      this.formatMember({ name, member, indentLevel, lineEnding }),
    )

    return ['{', ...formattedExistingMembers, ...formattedMissingMembers, '}'].join(lineEnding)
  }

  private formatExistingLine(line: string): string {
    const indentation = this.indentCharacter.repeat(this.indentSize)
    if (line.endsWith('{') || line.endsWith(',')) return `${indentation}${line}`
    return `${indentation}${line},`
  }

  private formatMember({ name, member, indentLevel, lineEnding }: FormatMemberArgs): string {
    const indentation = this.indentCharacter.repeat(indentLevel * this.indentSize)

    if (typeof member === 'object' && member !== null) {
      const opening = `${indentation}${name}: {`
      const body = Object.entries(member)
        .map(([name, subMember]) =>
          this.formatMember({ name, member: subMember, indentLevel: indentLevel + 1, lineEnding }),
        )
        .join(lineEnding)
      const closing = `${indentation}},`
      return [opening, body, closing].join(lineEnding)
    }

    const formattedMember = member === MemberType.String ? `'${member}'` : member
    return `${indentation}${name}: ${formattedMember},`
  }
}

interface FormatMemberArgs {
  name: string | null
  member: Member
  indentLevel: number
  lineEnding: LineEnding
}
