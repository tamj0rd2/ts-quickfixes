/* eslint-disable */
export interface Person {
  firstName: string
  lastName: string
  birthday: Date
  age: number
  address: { city: string; postcode: string }
  getPaymentDetails(): { cardNumber: string }
}

interface Employee extends Person {
  department: string
}

export const employee: Employee = {}
