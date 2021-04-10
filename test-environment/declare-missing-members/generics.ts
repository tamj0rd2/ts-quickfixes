type ValuesUnion = 'top' | 'bottom'
interface AnInterfaceWithAUnion {
  keys: 'left' | 'right'
}

export const aRecord: Record<ValuesUnion, AnInterfaceWithAUnion['keys']> = {}
