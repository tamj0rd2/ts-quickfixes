import { Member, Members, MemberType } from './member-parser'

export class MemberFormatter {
  // TODO: eventually get these from the user's preferences
  private readonly identSize = 2
  private readonly indentCharacter = ' '
  private readonly stringCharacter = '"'

  public format(initializer: string, members: Members): string {
    if (initializer === '{}') return this.formatMember(null, members)
    throw new Error('unhandled declaration type')
  }

  private formatMember(name: string | null, member: Member, indent = 0): string {
    const indentation = this.indentCharacter.repeat(indent * this.identSize)
    const prefix = `${indentation}${name}: `

    if (member !== null && typeof member === 'object') {
      const isTopLevelDeclaration = indent === 0
      const opening = isTopLevelDeclaration ? `${indentation}{` : `${prefix}{`
      const body = Object.entries(member)
        .map(([name, subMember]) => this.formatMember(name, subMember, indent + 1))
        .join('\n')
      const closing = isTopLevelDeclaration ? `${indentation}}` : `${indentation}},`
      return [opening, body, closing].join('\n')
    }

    const formattedMember = member === MemberType.String ? `'${member}'` : member
    return `${prefix}${formattedMember},`
  }
}
