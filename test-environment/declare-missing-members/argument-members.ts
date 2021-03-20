/* eslint-disable */
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
