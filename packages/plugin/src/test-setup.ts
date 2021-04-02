export type ObjectProperties = { [K in string]: ObjectProperties | string | boolean | null | number }
export interface BuildOpts {
  doNotFormatStrings?: boolean
}

export class ObjectBuilder {
  private readonly lines: string[] = []
  private readonly indent = ' '.repeat(4)

  constructor(private readonly depth = 0) {}

  public static from(properties: ObjectProperties, opts: BuildOpts = {}): ObjectBuilder {
    const builder = new ObjectBuilder()
    Object.entries(properties).forEach(([key, value]) => builder.with(key, value, opts))
    return builder
  }

  public toString(): string {
    return this.build(0)
  }

  private with(name: string, value: ObjectProperties[string], opts: BuildOpts): ObjectBuilder {
    this.lines.push(`${this.indent}${name}: ${this.formatValue(value, opts)}`)
    return this
  }

  private build(depth: number): string {
    if (!this.lines.length) return '{}'
    const extraIndent = this.indent.repeat(depth)

    return ['{\n', ...this.lines.map((line) => extraIndent + line).join(',\n'), `\n${extraIndent}}`].join('')
  }

  private formatValue(value: ObjectProperties[string], opts: BuildOpts): string {
    if (value === null) return 'null'
    if (typeof value === 'object') return ObjectBuilder.from(value).build(this.depth + 1)
    if (typeof value === 'string' && !opts.doNotFormatStrings) return `'${value}'`
    return value as string
  }
}

declare global {
  namespace jest {
    interface Matchers<R> {
      toMatchInitializer(expectedProperties: ObjectProperties, opts?: BuildOpts): R
    }
  }
}

expect.extend({
  toMatchInitializer: function blah(
    this: jest.MatcherContext,
    received: string,
    expectedProperties: ObjectProperties,
    buildOpts?: BuildOpts,
  ) {
    try {
      // eslint-disable-next-line jest/no-standalone-expect
      expect(received).toBe(ObjectBuilder.from(expectedProperties, buildOpts).toString())
      return { pass: true, message: 'nothing to see here' }
    } catch (err) {
      if (err.matcherResult) return err.matcherResult
      throw err
    }
  },
})
