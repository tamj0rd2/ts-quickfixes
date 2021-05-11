import ts from 'typescript/lib/tsserverlibrary'
import { DeclareMissingObjectMembers } from './declare-missing-object-members'
import { TSH } from '../helpers'
import {
  createDummyLogger,
  createImportStatement,
  createTestProgram,
  FsMocker,
  getNodeRange,
} from '../test-helpers'

describe('declareMissingObjectMembers', () => {
  afterEach(() => FsMocker.instance.reset())

  it('works for a variable declaration', () => {
    const initializer = `{ name: 'tam' }`
    const [filePath, fileContent] = FsMocker.instance.addFile(/* ts */ `
        interface Goodbye {
          'sweet-planet': string
        }

        interface TargetType {
          greeting: string
          name: string
          age: number
          hello: { 'my/dear': string }
          goodbye: Goodbye
        }
        
        export const target: TargetType = ${initializer}
      `)

    const newText = getNewText({
      filePath,
      initializerPos: getNodeRange(fileContent, initializer),
      errorPos: getNodeRange(fileContent, 'target'),
    })

    expect(newText).toMatchInitializer({
      name: 'tam',
      greeting: 'todo',
      age: 0,
      hello: null,
      goodbye: null,
    })
  })

  it('works for a nested object inside a variable declaration', () => {
    const initializer = '{}'
    const [filePath, fileContent] = FsMocker.instance.addFile(/* ts */ `
        interface TargetType {
          greeting: string
          name: string
        }
  
        interface GrandParentType {
          parent: { target: TargetType }
        }
        
        export const grandParent: GrandParentType = { parent: { target: ${initializer} } }
      `)

    const newText = getNewText({
      filePath,
      initializerPos: getNodeRange(fileContent, initializer),
      errorPos: getNodeRange(fileContent, 'target', { index: 1 }),
    })

    expect(newText).toMatchInitializer({ greeting: 'todo', name: 'todo' })
  })

  it('works for a deeply nested object inside a variable declaration', () => {
    const initializer = '{}'
    const [filePath, fileContent] = FsMocker.instance.addFile(/* ts */ `
        interface TargetType {
          greeting: string
          name: string
        }
  
        interface GreatGrandParentType {
          grandParent: { parent: { target: TargetType } }
        }
        
        export const greatGrandParent: GreatGrandParentType = { grandParent: { parent: { target: ${initializer} } } }
      `)

    const newText = getNewText({
      filePath,
      initializerPos: getNodeRange(fileContent, initializer),
      errorPos: getNodeRange(fileContent, 'target', { index: 1 }),
    })

    expect(newText).toMatchInitializer({ greeting: 'todo', name: 'todo' })
  })

  it('works for missing inherited members', () => {
    const initializer = `{ name: 'tam' }`
    const [importedFilePath] = FsMocker.instance.addFile(/* ts */ `
      export interface GrandParentType {
        age: number
      }

      export interface ParentType extends GrandParentType {
        name: string
      }
    `)

    const [targetFilePath, fileContent] = FsMocker.instance.addFile(/* ts */ `
      ${createImportStatement('ParentType', importedFilePath)}

      interface SiblingType {
        isAlive: boolean
      }

      interface TargetType extends ParentType, SiblingType {
        greeting: string
      }
      
      export const target: TargetType = ${initializer}
    `)

    const newText = getNewText({
      filePath: targetFilePath,
      initializerPos: getNodeRange(fileContent, initializer),
      errorPos: getNodeRange(fileContent, 'target'),
      additionalFiles: [importedFilePath],
    })

    expect(newText).toMatchInitializer({
      name: 'tam',
      greeting: 'todo',
      age: 0,
      isAlive: false,
    })
  })

  it(`works for a nested object that's missing inherited members`, () => {
    const initializer = '{}'
    const [otherFilePath] = FsMocker.instance.addFile(/* ts */ `
      export interface Person {
        address: { city: string; postcode: string }
      }
    `)
    const [filePath, fileContent] = FsMocker.instance.addFile(/* ts */ `
      ${createImportStatement('Person', otherFilePath)}

      interface Employee extends Person {
        jobTitle: string
      }
      
      export const employee: Employee = { jobTitle: 'thingy', address: ${initializer} }
    `)

    const newText = getNewText({
      filePath,
      initializerPos: getNodeRange(fileContent, initializer),
      errorPos: getNodeRange(fileContent, 'address'),
    })

    expect(newText).toMatchInitializer({ city: 'todo', postcode: 'todo' })
  })

  it('works for an object inside an array', () => {
    const initializer = '{}'
    const [filePath, fileContent] = FsMocker.instance.addFile(/* ts */ `
      interface TargetType {
        greeting: string
        name: string
      }

      interface ParentType {
        target: TargetType[]
      }
      
      export const parent: ParentType = { target: [${initializer}] }
    `)

    const newText = getNewText({
      filePath,
      initializerPos: getNodeRange(fileContent, initializer),
    })

    expect(newText).toMatchInitializer({ greeting: 'todo', name: 'todo' })
  })

  it('works for function arguments', () => {
    const initializer = '{}'
    const [filePath, fileContent] = FsMocker.instance.addFile(/* ts */ `
      interface TargetType {
        greeting: string
        name: string
      }

      function doSomething(target: TargetType) {}
      
      doSomething(${initializer})
    `)

    const newText = getNewText({
      filePath,
      initializerPos: getNodeRange(fileContent, initializer, { index: 1 }),
    })

    expect(newText).toMatchInitializer({ greeting: 'todo', name: 'todo' })
  })

  it('works for const arrow function arguments', () => {
    const initializer = '{}'
    const [filePath, fileContent] = FsMocker.instance.addFile(/* ts */ `
      interface TargetType {
        greeting: string
        name: string
      }

      const doSomething = (target: TargetType) => {}
      
      doSomething(${initializer})
    `)

    const newText = getNewText({
      filePath,
      initializerPos: getNodeRange(fileContent, initializer, { index: 1 }),
    })

    expect(newText).toMatchInitializer({ greeting: 'todo', name: 'todo' })
  })

  it('works for const function arguments', () => {
    const initializer = '{}'
    const [filePath, fileContent] = FsMocker.instance.addFile(/* ts */ `
      interface TargetType {
        greeting: string
        name: string
      }

      const doSomething = function (target: TargetType) {}
      
      doSomething(${initializer})
    `)

    const newText = getNewText({
      filePath,
      initializerPos: getNodeRange(fileContent, initializer, { index: 1 }),
    })

    expect(newText).toMatchInitializer({ greeting: 'todo', name: 'todo' })
  })

  it('works for objects that are nested inside a function argument', () => {
    const initializer = '{}'
    const [filePath, fileContent] = FsMocker.instance.addFile(/* ts */ `
      interface TargetType {
        greeting: string
        name: string
      }

      interface ParentType {
        target: TargetType[]
      }

      function doSomething(parent: ParentType) {}
      
      doSomething({ target: [${initializer}] })
    `)

    const newText = getNewText({
      filePath,
      initializerPos: getNodeRange(fileContent, initializer, { index: 1 }),
    })

    expect(newText).toMatchInitializer({ greeting: 'todo', name: 'todo' })
  })

  it('works for objects inside an array inside a function argument', () => {
    const initializer = '{}'
    const [filePath, fileContent] = FsMocker.instance.addFile(/* ts */ `
      interface TargetType {
        greeting: string
        name: string
      }

      function doSomething(targets: TargetType[]) {}
      
      doSomething([${initializer}])
    `)

    const newText = getNewText({
      filePath,
      initializerPos: getNodeRange(fileContent, initializer, { index: 1 }),
    })

    expect(newText).toMatchInitializer({ greeting: 'todo', name: 'todo' })
  })

  it('works for class constructors', () => {
    const initializer = '{}'
    const [filePath, fileContent] = FsMocker.instance.addFile(/* ts */ `
      interface TargetType {
        greeting: string
        name: string
      }

      class MyClass {
        constructor(target: TargetType) {}
      }

      new MyClass(${initializer})
    `)

    const newText = getNewText({
      filePath,
      initializerPos: getNodeRange(fileContent, initializer, { index: 1 }),
    })

    expect(newText).toMatchInitializer({ greeting: 'todo', name: 'todo' })
  })

  it('works for method calls', () => {
    const initializer = '{}'
    const [filePath, fileContent] = FsMocker.instance.addFile(/* ts */ `
      interface TargetType {
        greeting: string
        name: string
      }

      class MyClass {
        public method(targetType: TargetType) {}
      }

      new MyClass().method(${initializer})
    `)

    const newText = getNewText({
      filePath,
      initializerPos: getNodeRange(fileContent, initializer, { index: 1 }),
    })

    expect(newText).toMatchInitializer({ greeting: 'todo', name: 'todo' })
  })

  it.todo('works for function and method returns')

  describe('scope', () => {
    it('can use locals that are in scope', () => {
      const initializer = '{}'
      const [filePath, fileContent] = FsMocker.instance.addFile(/* ts */ `
        interface TargetType {
          greeting: string
          name: string
        }
        
        interface ParentType {
          target: TargetType
        }
        
        const target = { greeting: 'hello', name: 'John Doe' }
        
        const something: ParentType = ${initializer}
      `)

      const newText = getNewText({
        filePath,
        initializerPos: getNodeRange(fileContent, initializer),
        errorPos: getNodeRange(fileContent, 'something'),
      })

      expect(newText).toMatchInitializer({ target: 'target' }, { doNotFormatStrings: true })
    })

    it('does not use a local in scope if the type is not sufficient', () => {
      const initializer = '{}'
      const [filePath, fileContent] = FsMocker.instance.addFile(/* ts */ `
        interface TargetType {
          greeting: string
          name: string
        }
        
        interface ParentType {
          target: TargetType
        }
        
        const target = { woah: 'This is so wrong' }
        
        const something: ParentType = ${initializer}
      `)

      const newText = getNewText({
        filePath,
        initializerPos: getNodeRange(fileContent, initializer),
        errorPos: getNodeRange(fileContent, 'something'),
      })

      expect(newText).toMatchInitializer({ target: null })
    })
  })

  describe('generics', () => {
    it('works for records with basic values', () => {
      const initializer = '{}'
      const [filePath, fileContent] = FsMocker.instance.addFile(/* ts */ `
        export const target: Record<'greeting' | 'name', string> = {}
      `)

      const newText = getNewText({
        filePath,
        initializerPos: getNodeRange(fileContent, initializer),
      })

      expect(newText).toMatchInitializer({ greeting: 'todo', name: 'todo' })
    })

    it('works for records with conditional values', () => {
      const initializer = '{}'
      const [filePath, fileContent] = FsMocker.instance.addFile(/* ts */ `
        type TargetType = {[K in 'A' | 'B']: K extends 'A' ? 'yay' : 101 }
        export const target: TargetType = {}
      `)

      const newText = getNewText({
        filePath,
        initializerPos: getNodeRange(fileContent, initializer),
      })

      expect(newText).toMatchInitializer({ A: 'yay', B: 101 })
    })

    it('works with union type keys', () => {
      const initializer = '{}'
      const [filePath, fileContent] = FsMocker.instance.addFile(/* ts */ `
        type TargetType = Record<'Hello world' | 'Cya', string>
        export const target: TargetType = {}
      `)

      const newText = getNewText({
        filePath,
        initializerPos: getNodeRange(fileContent, initializer),
      })

      expect(newText).toMatchInitializer({ 'Hello world': 'todo', Cya: 'todo' })
    })
  })
})

interface GetNewText {
  errorPos?: TSH.NodePosition
  initializerPos: TSH.NodePosition
  filePath: string
  additionalFiles?: string[]
}

function getNewText(args: GetNewText): string {
  const { additionalFiles, errorPos, filePath, initializerPos } = args
  const program = createTestProgram(
    [filePath, ...(additionalFiles ?? [])],
    DeclareMissingObjectMembers.supportedErrorCodes,
  )
  const fix = DeclareMissingObjectMembers.createFix({
    ts,
    filePath,
    program: program,
    typeChecker: program.getTypeChecker(),
    logger: createDummyLogger(true),
    ...(errorPos ?? initializerPos),
  })
  return fix.changes[0].textChanges[0].newText
}
