import { TSH } from './helpers'
import { createTestProgram, FsMocker, getNodeRange } from './test-helpers'

describe('Helpers', () => {
  afterEach(() => FsMocker.reset())

  describe('findNodeAtPosition', () => {
    it('finds the node that has an error at a specific location', () => {
      const initializer = '{ greeting: "hello" }'
      const [filePath, fileContent] = FsMocker.addFile(`
        interface TargetType {
          greeting: string
        }
        export const target: TargetType = ${initializer}
      `)
      const errorPosition = getNodeRange(fileContent, initializer)

      const program = createTestProgram([filePath])
      const errorNode = TSH.findNodeAtPosition(program.getSourceFile(filePath)!, errorPosition)

      expect(errorNode.getText()).toBe(initializer)
    })
  })
})
