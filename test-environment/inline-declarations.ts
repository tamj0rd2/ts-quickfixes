interface Account {
  accountNumber: string
  sortCode: string
  balance: number
  blah: string
  something: Date
  else: boolean
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function withdrawMoney(account: Account, amount: number): number {
  return 0
}

export const newBalance = withdrawMoney({ balance: 200 }, 123)
