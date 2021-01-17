import { Person } from './another-file'

interface Employee extends Person {
  department: string
}

export const employee: Employee = {}

interface Dog {
  age: number
  favourites: {
    toy: string
    food: string
  }
}

export const dog: Dog = {
  age: 5,
  favourites: {},
}

interface Account {
  accountNumber: string
  sortCode: string
  balance: number
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function withdrawMoney(account: Account, amount: number): number {
  return 0
}

export const newBalance = withdrawMoney({ balance: 200 }, 123)
