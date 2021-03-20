/* eslint-disable */
import { Person } from '../another-file'

interface Employee extends Person {
  department: string
}

export const employee: Employee = {}

interface Account {
  accountNumber: string
  sortCode: string
  balance: number
}

export function withdrawMoney(account: Account, amount: number): number {
  return 0
}

export const newBalance = withdrawMoney({ balance: 200 }, 123)

export const sendMoney = (account: Account, amount: number): void => {
  return
}

sendMoney({ balance: 400 }, 200)

interface Job {
  name: string
  compensation: {
    salary: number
    includesHealthcare: boolean
  }
  responsibilities: { description: string }[]
}

export const job: Job = {
  name: 'todo',
  compensation: {},
  responsibilities: [{}],
}

class HttpClient {
  constructor(args: { timeout: number; baseUrl: string, operation: string }) {}
}

const baseUrl = 'https://www.example.com'
const client = new HttpClient({ timeout: 456 })
