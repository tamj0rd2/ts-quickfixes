import { CodeFixAction } from 'typescript/lib/tsserverlibrary'
// import { MemberFormatter } from './formatter'
// import { MemberParser } from './member-parser'
// import TsWrapper from './ts-wrapper'

/* eslint-disable @typescript-eslint/no-explicit-any */
function init(modules: Modules): { create: CreateFn } {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const ts = modules.typescript

  function create(info: ts.server.PluginCreateInfo): ts.LanguageService {
    const log = (message: string): void =>
      info.project.projectService.logger.info(`ts-quickfixes-plugin: ${message}`)

    log('Hello world!')

    // const memberParser = new MemberParser(
    //   info.project.getCompilationSettings(),
    //   info.project.getRootFiles(),
    //   new TsWrapper(),
    // )
    // const memberFormatter = new MemberFormatter()

    // log('Created a member parser')

    // TODO: refactor to use a spread because it's just much nicer
    const originalLanguageService = info.languageService
    const wrapOrig = <N extends keyof ts.LanguageService>(name: N) => (...args: unknown[]) => {
      log(`${name} Args: ${JSON.stringify(args)}`)
      // @ts-expect-error lol get rid of this soon
      const response = originalLanguageService[name](...(args as any))
      log(`${name} Response: ${JSON.stringify(response)}`)
      return response
    }

    return {
      ...originalLanguageService,
      getApplicableRefactors: wrapOrig('getApplicableRefactors'),
      getCodeFixesAtPosition: (fileName, start, end, errorCodes, formatOptions, preferences) => {
        const codeFixes: CodeFixAction[] = []
        log(`getCodeFixesAtPosition ${JSON.stringify({ start, end, errorCodes })}`)

        codeFixes.push(
          ...originalLanguageService.getCodeFixesAtPosition(
            fileName,
            start,
            end,
            errorCodes,
            formatOptions,
            preferences,
          ),
        )

        if (errorCodes.includes(2739) || errorCodes.includes(2740)) {
          const implementMissingMembers: CodeFixAction = {
            fixName: 'implementMissingMembers',
            description: 'Implement missing members',
            changes: [
              {
                fileName,
                textChanges: [
                  {
                    newText: 'nice meme LOL',
                    span: {
                      start: 5,
                      length: 0,
                    },
                  },
                ],
              },
            ],
          }

          codeFixes.push(implementMissingMembers)
        }

        log(`getCodeFixesAtPosition Response: ${JSON.stringify(codeFixes)}`)
        return codeFixes
      },
      // getCodeFixesAtPosition: (fileName, start, end, errorCodes, formatOptions, preferences) => {
      //   return []
      // },
      // getCodeFixesAtPosition: (fileName, start, end, errorCodes, formatOptions, preferences) => {
      //   const originalResults = originalLanguageService.getCodeFixesAtPosition(
      //     fileName,
      //     start,
      //     end,
      //     errorCodes,
      //     formatOptions,
      //     preferences,
      //   )

      //   const implementMissingMembers: CodeFixAction = {
      //     fixName: 'implementMissingMembers',
      //     description: 'Implement missing members',
      //     changes: [
      //       {
      //         fileName,
      //         textChanges: [
      //           {
      //             newText: 'nice meme LOL',
      //             span: {
      //               start: 5,
      //               length: 0,
      //             },
      //           },
      //         ],
      //       },
      //     ],
      //   }

      //   return [...originalResults, implementMissingMembers]
      // },
    }
  }

  return { create }
}

export = init

interface Modules {
  typescript: typeof import('typescript/lib/tsserverlibrary')
}

type CreateFn = (info: ts.server.PluginCreateInfo) => ts.LanguageService
