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

  public format(initializer: string, members: Members, lineEnding: LineEnding): string {
    if (initializer === '{}') {
      const formattedMembers = Object.entries(members)
        .map(([name, member]) => this.formatMember({ name, member, indentLevel: 1, lineEnding }))
        .join(lineEnding)

      return ['{', formattedMembers, '}'].join(lineEnding)
    }

    const lines = initializer.split(lineEnding)
    const lastIndentedLine = [...lines].reverse().find((line) => line.startsWith(this.indentCharacter))
    if (!lastIndentedLine) throw new Error('Inline variable initializers are not yet supported')

    const indentLevel = this.getIndentSize(lastIndentedLine)
    const formattedMembers = Object.entries(members).map(([name, member]) =>
      this.formatMember({ name, member, indentLevel: indentLevel, lineEnding }),
    )

    return [
      ...lines.slice(0, lines.length - 2),
      `${lastIndentedLine},`,
      ...formattedMembers,
      lines[lines.length - 1],
    ].join(lineEnding)
  }

  private formatMember({ name, member, indentLevel, lineEnding }: FormatMemberArgs): string {
    const indentation = this.indentCharacter.repeat(indentLevel * this.indentSize)
    const prefix = `${indentation}${name}: `

    if (member !== null && typeof member === 'object') {
      const opening = `${prefix}{`
      const body = Object.entries(member)
        .map(([name, subMember]) =>
          this.formatMember({ name, member: subMember, indentLevel: indentLevel + 1, lineEnding }),
        )
        .join(lineEnding)
      const closing = `${indentation}},`
      return [opening, body, closing].join(lineEnding)
    }

    const formattedMember = member === MemberType.String ? `'${member}'` : member
    return `${prefix}${formattedMember},`
  }

  private getIndentSize(line: string): number {
    let indentCharCount = 0
    for (const char of line.split('')) {
      if (char === this.indentCharacter) indentCharCount += 1
      else break
    }
    return Math.floor(indentCharCount / this.indentSize)
  }
}

interface FormatMemberArgs {
  name: string | null
  member: Member
  indentLevel: number
  lineEnding: LineEnding
}
